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

/**
 * How the five screens physically stand in the room, left to right (ROOM_ORDER on the server).
 * Default: the desk on the far left, then the building from the lobby to the Vault.
 */
export const DEFAULT_ROOM_ORDER: readonly ScreenId[] = [2, 1, 3, 4, 5];

/** The plan order, 1 to 5: used by /wall and /preview, which are not the physical wall. */
export const PLAN_ORDER: readonly ScreenId[] = [1, 2, 3, 4, 5];

/** Parses "2,1,3,4,5". Every screen must appear exactly once; anything else gives null. */
export function parseRoomOrder(text: string | undefined): ScreenId[] | null {
  if (!text) return null;
  const ids = text.split(',').map((part) => parseScreenId(part.trim()));
  if (ids.length !== 5 || ids.some((id) => id === null)) return null;
  if (new Set(ids).size !== 5) return null;
  return ids as ScreenId[];
}
