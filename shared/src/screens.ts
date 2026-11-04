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
