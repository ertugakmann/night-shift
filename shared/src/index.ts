// Shared types and the Phase 1 placeholder state logic.
// Pure TypeScript, no I/O. The real engine replaces `advance`/`applyIntent` in Phase 3.

export const TICK_HZ = 10;
export const TICK_MS = 1000 / TICK_HZ;

// ---------- Screens ----------

export type ScreenId = 1 | 2 | 3 | 4 | 5;

export const SCREENS: Record<ScreenId, { name: string }> = {
  1: { name: 'Lobby and Offices' },
  2: { name: 'Security Office' },
  3: { name: 'West Wing' },
  4: { name: 'East Wing' },
  5: { name: 'The Vault' },
};

/** Building screens shown as monitors along the top of /wall, left to right. */
export const WALL_TOP_ROW: ScreenId[] = [1, 3, 4, 5];

export function parseScreenId(value: string | undefined): ScreenId | null {
  const n = Number(value);
  return n === 1 || n === 2 || n === 3 || n === 4 || n === 5 ? n : null;
}

// ---------- Game state (placeholder) ----------

export type Phase = 'idle' | 'running' | 'paused';

export interface GameState {
  phase: Phase;
  /** Time the round has been running, excluding pauses. */
  elapsedMs: number;
  /** Shared counter that controllers can increment. */
  counter: number;
  reality: boolean;
  debug: boolean;
}

/** What every client receives at 10 Hz. Contains nothing secret. */
export interface Snapshot extends GameState {
  codeVisible: boolean;
  controllers: number;
  viewers: number;
}

export function initialState(): GameState {
  return { phase: 'idle', elapsedMs: 0, counter: 0, reality: false, debug: false };
}

export function advance(state: GameState, dtMs: number): GameState {
  if (state.phase !== 'running') return state;
  return { ...state, elapsedMs: state.elapsedMs + dtMs };
}

// ---------- Intents ----------

export const INTENT_TYPES = [
  'start',
  'togglePause',
  'reset',
  'toggleReality',
  'toggleDebug',
  'toggleCode',
  'increment',
] as const;

export type IntentType = (typeof INTENT_TYPES)[number];
export type Intent = { type: IntentType };

/** Only the presenter page can start, reset or hand over control. */
export const PRESENTER_ONLY: readonly IntentType[] = ['start', 'reset', 'toggleCode'];

export function isIntent(value: unknown): value is Intent {
  return (
    typeof value === 'object' &&
    value !== null &&
    INTENT_TYPES.includes((value as { type: unknown }).type as IntentType)
  );
}

export type ApplyResult = { state: GameState; error?: string };

/** Applies a game intent. `toggleCode` is handled by the server's control layer, not here. */
export function applyIntent(state: GameState, intent: Intent): ApplyResult {
  switch (intent.type) {
    case 'start':
      if (state.phase === 'running') return { state, error: 'Already running.' };
      return { state: { ...state, phase: 'running' } };
    case 'togglePause':
      if (state.phase === 'idle') return { state, error: 'Not started yet. Press S.' };
      return { state: { ...state, phase: state.phase === 'running' ? 'paused' : 'running' } };
    case 'reset':
      return { state: initialState() };
    case 'toggleReality':
      return { state: { ...state, reality: !state.reality } };
    case 'toggleDebug':
      return { state: { ...state, debug: !state.debug } };
    case 'increment':
      return { state: { ...state, counter: state.counter + 1 } };
    case 'toggleCode':
      return { state };
  }
}

// ---------- Control ----------

export type Role = 'presenter' | 'controller' | 'watcher';

/** Sent privately to each client. `code` is only ever filled in for presenters. */
export interface ControlInfo {
  role: Role;
  code: string | null;
}

export interface Hello {
  presenterKey: string | null;
  code: string | null;
}

export type CodeResult = { ok: boolean; message: string };

// ---------- Socket.IO event maps ----------

export interface ServerToClientEvents {
  snapshot: (snapshot: Snapshot) => void;
  control: (info: ControlInfo) => void;
  notice: (text: string) => void;
}

export interface ClientToServerEvents {
  hello: (hello: Hello) => void;
  intent: (intent: Intent) => void;
  enterCode: (code: string, ack: (result: CodeResult) => void) => void;
}

// ---------- Helpers ----------

export function formatClock(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
