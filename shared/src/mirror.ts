import { DEMO } from './scenario';
import type { Role } from './protocol';

/**
 * What the presenter is doing on the desk, mirrored live to every watching desk (/screen/2, /wall):
 * the room picked (its action menu), the room hovered, and the mouse or finger. Not game state: the
 * engine never sees it, so it can never change the seeded night. Watchers only see it, never click it.
 */
export interface PresenterPointer {
  /** The room whose action menu is open. */
  selected: string | null;
  /** The room under the mouse on the desk map. */
  hover: string | null;
  /** The mouse or finger in desk units (1600×900), null when it is off the desk. */
  cursor: { x: number; y: number; touch: boolean } | null;
}

export const DESK_W = 1600;
export const DESK_H = 900;
export const NO_POINTER: PresenterPointer = { selected: null, hover: null, cursor: null };

const ROOM_IDS = new Set(DEMO.rooms.map((r) => r.id));
const room = (v: unknown): string | null => (typeof v === 'string' && ROOM_IDS.has(v) ? v : null);
const clamp = (v: number, max: number) => Math.round(Math.max(0, Math.min(max, v)));

/** Untrusted input from a socket: anything odd becomes null, the cursor is kept on the desk. */
export function parsePointer(raw: unknown): PresenterPointer | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  let cursor: PresenterPointer['cursor'] = null;
  const c = r.cursor as Record<string, unknown> | null | undefined;
  if (c && typeof c === 'object' && typeof c.x === 'number' && typeof c.y === 'number' && Number.isFinite(c.x) && Number.isFinite(c.y)) {
    cursor = { x: clamp(c.x, DESK_W), y: clamp(c.y, DESK_H), touch: c.touch === true };
  }
  return { selected: room(r.selected), hover: room(r.hover), cursor };
}

/** The room a page shows as picked: a watcher sees the presenter's, anyone with control their own. */
export function shownSelection(role: Role, local: string | null, pointer: PresenterPointer | null): string | null {
  return role === 'watcher' ? (pointer?.selected ?? null) : local;
}
