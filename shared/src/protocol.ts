import type { Intent, PublicState } from './engine';
import type { MorningReport } from './report';
import type { PresenterPointer } from './mirror';
import type { ScreenId } from './screens';

/** What every client receives at 10 Hz. */
export interface Snapshot extends PublicState {
  codeVisible: boolean;
  controllers: number;
  viewers: number;
  /** The player's own record (the server keeps it across nights; R never clears it). */
  record: {
    /** The best night's care score so far. */
    best: number | null;
    /** The best before the night that just ended: beat it, and the card says "New record!". */
    previous: number | null;
  };
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
  /** The morning report of the night that just ended (null while there is none). */
  report: (report: MorningReport | null) => void;
  /** The presenter's selection, hover and cursor on the desk (null: no presenter). Watchers mirror it. */
  pointer: (pointer: PresenterPointer | null) => void;
}

export interface ClientToServerEvents {
  hello: (hello: Hello, ack: (role: Role) => void) => void;
  intent: (intent: Intent) => void;
  enterCode: (code: string, ack: (result: CodeResult) => void) => void;
  /** Presenter only: what the presenter is pointing at (see PresenterPointer). Ignored from anyone else. */
  pointer: (pointer: unknown) => void;
}
