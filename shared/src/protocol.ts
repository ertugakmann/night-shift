import type { Intent, PublicState } from './engine';
import type { ScreenId } from './screens';

/** What every client receives at 10 Hz. */
export interface Snapshot extends PublicState {
  codeVisible: boolean;
  controllers: number;
  viewers: number;
}

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

/** How the screens stand in the room, sent once on connect. */
export interface WallInfo {
  /** Screen ids, left to right (ROOM_ORDER). */
  order: ScreenId[];
}

export type CodeResult = { ok: boolean; message: string };

export interface ServerToClientEvents {
  snapshot: (snapshot: Snapshot) => void;
  control: (info: ControlInfo) => void;
  notice: (text: string) => void;
  wall: (info: WallInfo) => void;
}

export interface ClientToServerEvents {
  hello: (hello: Hello, ack: (role: Role) => void) => void;
  intent: (intent: Intent) => void;
  enterCode: (code: string, ack: (result: CodeResult) => void) => void;
}
