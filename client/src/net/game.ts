import { useSyncExternalStore } from 'react';
import { io, type Socket } from 'socket.io-client';
import { DEFAULT_ROOM_ORDER, NO_POINTER, shownSelection, type MorningReport, type PresenterPointer, type ScreenId } from '@night-shift/shared';
import type {
  ClientToServerEvents,
  CodeResult,
  Intent,
  Role,
  ServerToClientEvents,
  Snapshot,
} from '@night-shift/shared';

/** Client-side view of the shared game. The server is authoritative; we only render and send intents. */
export interface GameView {
  connected: boolean;
  snapshot: Snapshot | null;
  role: Role;
  /** The control code, only known to presenter pages. */
  code: string | null;
  notice: { id: number; text: string } | null;
  /** 'websocket' once upgraded, 'polling' while (or if stuck) on HTTP long-polling. */
  transport: string | null;
  /** Room whose action menu is open: picked on this tab, or (watching) the presenter's, mirrored. */
  selected: string | null;
  /** What the presenter is doing on the desk (selection, hover, cursor), mirrored on watching pages. */
  pointer: PresenterPointer | null;
  /** How the screens stand in the room, left to right (ROOM_ORDER, sent by the server). */
  roomOrder: readonly ScreenId[];
  /** The morning report of the night that just ended, once the server has written it. */
  report: MorningReport | null;
  /** The report arrived while this page was watching the end of the night: type it out. After a refresh: show it whole. */
  reportLive: boolean;
}

const CODE_STORAGE_KEY = 'night-shift:control-code';
const PRESENTER_STORAGE_KEY = 'night-shift:presenter-key';

// sessionStorage: survives a refresh of this tab, but a fresh tab starts as a watcher.
function readStored(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStored(key: string, value: string | null): void {
  try {
    if (value) sessionStorage.setItem(key, value);
    else sessionStorage.removeItem(key);
  } catch {
    /* storage unavailable: control just won't survive refresh */
  }
}
const readCode = () => readStored(CODE_STORAGE_KEY);
const writeCode = (code: string | null) => writeStored(CODE_STORAGE_KEY, code);

/**
 * ?presenter=<PRESENTER_KEY> is read once, kept in this tab's sessionStorage and removed from the
 * address bar, so the key is not visible on the projector or in screen shares and in-app links
 * don't need to carry it.
 */
function takePresenterKey(): string | null {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('presenter')) return readStored(PRESENTER_STORAGE_KEY);
  const fromUrl = rawQueryParam(url.search, 'presenter');
  url.searchParams.delete('presenter');
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  writeStored(PRESENTER_STORAGE_KEY, fromUrl);
  return fromUrl;
}
/**
 * Like URLSearchParams.get, but keeps '+' as '+'. Render's generated keys are base64 (with + / =),
 * and URLSearchParams would turn '+' into a space, so a pasted key would never match.
 */
function rawQueryParam(search: string, name: string): string {
  for (const part of search.replace(/^\?/, '').split('&')) {
    const eq = part.indexOf('=');
    const key = eq === -1 ? part : part.slice(0, eq);
    if (key !== name) continue;
    const value = eq === -1 ? '' : part.slice(eq + 1);
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return '';
}

let presenterKey = takePresenterKey();

let view: GameView = {
  connected: false,
  snapshot: null,
  role: 'watcher',
  code: null,
  notice: null,
  transport: null,
  selected: null,
  pointer: null,
  roomOrder: DEFAULT_ROOM_ORDER,
  report: null,
  reportLive: false,
};

let localSelected: string | null = null;

/** Pick a room on this tab. A watcher cannot: it shows the presenter's pick instead. */
export function selectRoom(room: string | null): void {
  if (view.role === 'watcher') return;
  localSelected = room;
  set({ selected: room });
  reportPointer({ selected: room });
}

function reselect(): void {
  const selected = shownSelection(view.role, localSelected, view.pointer);
  if (selected !== view.selected) set({ selected });
}

// The presenter's own pointer, sent at most every 50 ms (the last change always goes out).
let mine: PresenterPointer = NO_POINTER;
let pointerTimer: ReturnType<typeof setTimeout> | undefined;
let pointerSentAt = 0;
function flushPointer(): void {
  pointerTimer = undefined;
  if (view.role !== 'presenter' || !socket.connected) return;
  pointerSentAt = Date.now();
  socket.emit('pointer', mine);
}
/** Presenter pages report what they point at; on every other page this does nothing. */
export function reportPointer(patch: Partial<PresenterPointer>): void {
  mine = { ...mine, ...patch };
  if (view.role !== 'presenter' || pointerTimer) return;
  pointerTimer = setTimeout(flushPointer, Math.max(0, 50 - (Date.now() - pointerSentAt)));
}
const listeners = new Set<() => void>();

function set(patch: Partial<GameView>): void {
  view = { ...view, ...patch };
  for (const l of listeners) l();
}

let noticeId = 0;
let noticeTimer: ReturnType<typeof setTimeout> | undefined;
export function showNotice(text: string): void {
  clearTimeout(noticeTimer);
  set({ notice: { id: ++noticeId, text } });
  noticeTimer = setTimeout(() => set({ notice: null }), 3000);
}

const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io();

socket.on('connect', () => {
  const engine = socket.io.engine;
  set({ connected: true, transport: engine.transport.name });
  engine.once('upgrade', () => set({ transport: engine.transport.name }));
  socket.emit('hello', { presenterKey, code: readCode() }, (role) => {
    if (presenterKey && role !== 'presenter') {
      // Wrong key: forget it so refreshes don't keep retrying it.
      presenterKey = null;
      writeStored(PRESENTER_STORAGE_KEY, null);
      showNotice('Presenter key not accepted. You are watching.');
    }
  });
});
socket.on('disconnect', () => set({ connected: false, transport: null }));
socket.on('snapshot', (snapshot) => set({ snapshot }));
socket.on('control', ({ role, code }) => {
  if (role === 'watcher') writeCode(null);
  if (role !== view.role) localSelected = null;
  set({ role, code });
  reselect();
  if (role === 'presenter') reportPointer({ selected: localSelected });
});
socket.on('pointer', (pointer) => {
  set({ pointer });
  reselect();
});
socket.on('notice', showNotice);
socket.on('wall', ({ order }) => set({ roomOrder: order }));
// On connect the server sends the current report before the first snapshot, so a report that exists
// already (a refresh after the end) is not live; one that arrives later is.
socket.on('report', (report) => set({ report, reportLive: report !== null && view.snapshot !== null }));

/** Be told about every change, outside React (the sound cues). Returns the unsubscribe. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The latest state, for handlers outside React (the keyboard). */
export function currentView(): GameView {
  return view;
}

export function sendIntent(intent: Intent): void {
  // Never queue intents while the connection is down: socket.io would replay them all on reconnect
  // (three R presses during a blip would reset three times later). Say so instead.
  if (!socket.connected) {
    if (intent.type !== 'aim') showNotice('Connection lost, reconnecting… Try again in a moment.');
    return;
  }
  socket.emit('intent', intent);
}

export function enterCode(code: string): Promise<CodeResult> {
  return new Promise((resolve) => {
    if (!socket.connected) {
      resolve({ ok: false, message: 'Not connected.' });
      return;
    }
    socket.emit('enterCode', code, (result) => {
      if (result.ok) writeCode(code);
      resolve(result);
    });
  });
}

export function useGame(): GameView {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => view,
  );
}
