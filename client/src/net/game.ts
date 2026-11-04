import { useSyncExternalStore } from 'react';
import { io, type Socket } from 'socket.io-client';
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
}

const CODE_STORAGE_KEY = 'night-shift:control-code';
const presenterKey = new URLSearchParams(window.location.search).get('presenter');

// sessionStorage: survives a refresh of this tab, but a fresh tab starts as a watcher.
function readCode(): string | null {
  try {
    return sessionStorage.getItem(CODE_STORAGE_KEY);
  } catch {
    return null;
  }
}
function writeCode(code: string | null): void {
  try {
    if (code) sessionStorage.setItem(CODE_STORAGE_KEY, code);
    else sessionStorage.removeItem(CODE_STORAGE_KEY);
  } catch {
    /* storage unavailable: control just won't survive refresh */
  }
}

let view: GameView = { connected: false, snapshot: null, role: 'watcher', code: null, notice: null };
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
  set({ connected: true });
  socket.emit('hello', { presenterKey, code: readCode() });
});
socket.on('disconnect', () => set({ connected: false }));
socket.on('snapshot', (snapshot) => set({ snapshot }));
socket.on('control', ({ role, code }) => {
  if (role === 'watcher') writeCode(null);
  set({ role, code });
});
socket.on('notice', showNotice);

export function sendIntent(intent: Intent): void {
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
