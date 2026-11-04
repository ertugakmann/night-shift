// Where everything sits in the one continuous building. Presentation only: the game rules live in
// shared/scenario/demo.json. The building is 4 slices of 1600×900 laid side by side; each building
// screen shows its own slice, so anything crossing a border leaves one screen and enters the next.
import type { ScreenId } from '@night-shift/shared';

export const SLICE_W = 1600;
export const SLICE_H = 900;

export type BuildingScreenId = 1 | 3 | 4 | 5;
export const SLICE_INDEX: Record<BuildingScreenId, number> = { 1: 0, 3: 1, 4: 2, 5: 3 };

export function isBuildingScreen(id: ScreenId): id is BuildingScreenId {
  return id !== 2;
}

export interface Pt {
  x: number;
  y: number;
}
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type ExhibitKind =
  | 'letters'
  | 'turnstile'
  | 'keys'
  | 'lamps'
  | 'microscopes'
  | 'clockwork'
  | 'apothecary'
  | 'scales'
  | 'clock'
  | 'beacons'
  | 'musicbox'
  | 'lanterns'
  | 'theatre'
  | 'lens'
  | 'scrolls'
  | 'ledger';

export interface ExhibitLayout extends Pt {
  kind: ExhibitKind;
  /** Drawing scale (1 = base size). */
  scale?: number;
}

export interface RoomLayout {
  rect: Rect;
  /** Where guards stand when they are in the room. */
  anchor: Pt;
  /** Where intruder groups lurk (first free spot is used). */
  spots: Pt[];
  exhibits: Record<string, ExhibitLayout>;
  corridor?: boolean;
  /** x positions of picture frames hanging on the top wall. */
  frames?: number[];
  /** Stone columns in the corners. */
  columns?: boolean;
  /** Carpet runners on the floor (corridors get one automatically). */
  runners?: Rect[];
  /** Busts on plinths, purely decorative. */
  statues?: Pt[];
  /** Brass letterbox on the left wall, with letters on the floor (the phishing way in). */
  letterbox?: Pt;
  /** The museum front door in the bottom wall. */
  frontDoor?: Pt;
}

/** A door in a vertical wall ('v', walk through it left/right) or a horizontal wall ('h', up/down). */
export interface DoorLayout extends Pt {
  a: string;
  b: string;
  orient: 'h' | 'v';
}

export const ROOMS: Record<string, RoomLayout> = {
  // ---------- Screen 1: Lobby and Offices (x 0–1600) ----------
  'mail-room': {
    rect: { x: 8, y: 8, w: 620, h: 432 },
    anchor: { x: 500, y: 405 },
    spots: [{ x: 200, y: 395 }, { x: 420, y: 410 }, { x: 110, y: 230 }],
    exhibits: { 'letter-press': { kind: 'letters', x: 300, y: 285, scale: 1.35 } },
    frames: [440],
    columns: true,
    letterbox: { x: 16, y: 228 },
  },
  'entrance-hall': {
    rect: { x: 628, y: 8, w: 964, h: 884 },
    anchor: { x: 1330, y: 830 },
    spots: [{ x: 800, y: 650 }, { x: 760, y: 850 }, { x: 1470, y: 560 }],
    exhibits: { turnstiles: { kind: 'turnstile', x: 1110, y: 640, scale: 1.3 } },
    frames: [1330],
    columns: true,
    // The corridor carpet starts at the front door and runs on into the West Corridor.
    runners: [
      { x: 1060, y: 432, w: 100, h: 460 },
      { x: 1060, y: 432, w: 560, h: 76 },
    ],
    statues: [{ x: 820, y: 400 }, { x: 1440, y: 390 }],
    frontDoor: { x: 1110, y: 892 },
  },
  'key-room': {
    rect: { x: 8, y: 440, w: 620, h: 452 },
    anchor: { x: 490, y: 860 },
    spots: [{ x: 200, y: 860 }, { x: 420, y: 860 }, { x: 110, y: 640 }],
    exhibits: { 'key-cabinet': { kind: 'keys', x: 290, y: 735, scale: 1.3 } },
    columns: true,
  },

  // ---------- Screen 3: West Wing (x 1600–3200) ----------
  'west-corridor': {
    rect: { x: 1600, y: 380, w: 1600, h: 180 },
    anchor: { x: 2520, y: 524 },
    spots: [{ x: 2240, y: 528 }, { x: 2900, y: 528 }, { x: 1980, y: 528 }],
    exhibits: { 'west-lamps': { kind: 'lamps', x: 2400, y: 470 } },
    corridor: true,
  },
  lab: {
    rect: { x: 1608, y: 8, w: 1584, h: 372 },
    anchor: { x: 1900, y: 330 },
    spots: [{ x: 2720, y: 340 }, { x: 2260, y: 345 }, { x: 3090, y: 345 }],
    exhibits: {
      microscopes: { kind: 'microscopes', x: 2440, y: 205, scale: 1.4 },
      clockwork: { kind: 'clockwork', x: 2960, y: 200, scale: 1.35 },
    },
    frames: [2070],
    columns: true,
  },
  pharmacy: {
    rect: { x: 1608, y: 560, w: 1584, h: 332 },
    anchor: { x: 2930, y: 840 },
    spots: [{ x: 1860, y: 850 }, { x: 2420, y: 865 }, { x: 3080, y: 760 }],
    exhibits: {
      apothecary: { kind: 'apothecary', x: 2210, y: 712, scale: 1.35 },
      'golden-scales': { kind: 'scales', x: 2650, y: 712, scale: 1.35 },
    },
    frames: [2975],
    columns: true,
  },

  // ---------- Screen 4: East Wing (x 3200–4800) ----------
  'east-corridor': {
    rect: { x: 3200, y: 380, w: 1540, h: 180 },
    anchor: { x: 3900, y: 524 },
    spots: [{ x: 3700, y: 528 }, { x: 4250, y: 528 }, { x: 3450, y: 528 }],
    exhibits: { 'east-lamps': { kind: 'lamps', x: 3970, y: 470 } },
    corridor: true,
  },
  ward4: {
    rect: { x: 3280, y: 70, w: 680, h: 310 },
    anchor: { x: 3620, y: 290 },
    spots: [{ x: 3420, y: 150 }, { x: 3820, y: 160 }, { x: 3400, y: 300 }],
    exhibits: {
      'music-boxes': { kind: 'musicbox', x: 3480, y: 180 },
      lanterns: { kind: 'lanterns', x: 3800, y: 200 },
    },
  },
  emergency: {
    rect: { x: 3960, y: 70, w: 840, h: 310 },
    anchor: { x: 4360, y: 290 },
    spots: [{ x: 4120, y: 150 }, { x: 4600, y: 300 }, { x: 4700, y: 140 }],
    exhibits: {
      'great-clock': { kind: 'clock', x: 4180, y: 200 },
      'signal-beacons': { kind: 'beacons', x: 4580, y: 170 },
    },
  },
  radiology: {
    rect: { x: 3280, y: 560, w: 1520, h: 270 },
    anchor: { x: 4000, y: 610 },
    spots: [{ x: 3500, y: 720 }, { x: 4400, y: 760 }, { x: 4650, y: 640 }],
    exhibits: {
      'shadow-theatre': { kind: 'theatre', x: 3560, y: 690 },
      'great-lens': { kind: 'lens', x: 4300, y: 700 },
    },
  },

  // ---------- Screen 5: The Vault (x 4800–6400) ----------
  vault: {
    rect: { x: 4800, y: 70, w: 1520, h: 450 },
    anchor: { x: 5000, y: 260 },
    spots: [{ x: 5560, y: 300 }, { x: 5800, y: 220 }, { x: 5300, y: 380 }],
    exhibits: { 'crown-ledger': { kind: 'ledger', x: 5560, y: 290 } },
  },
  archive: {
    rect: { x: 4800, y: 520, w: 960, h: 310 },
    anchor: { x: 5000, y: 690 },
    spots: [{ x: 5400, y: 720 }, { x: 5600, y: 640 }, { x: 5200, y: 760 }],
    exhibits: { 'copy-scrolls': { kind: 'scrolls', x: 5450, y: 680 } },
  },
};

export const DOORS: DoorLayout[] = [
  { a: 'mail-room', b: 'entrance-hall', x: 628, y: 250, orient: 'v' },
  { a: 'entrance-hall', b: 'key-room', x: 628, y: 680, orient: 'v' },
  { a: 'entrance-hall', b: 'west-corridor', x: 1600, y: 500, orient: 'v' },
  { a: 'west-corridor', b: 'lab', x: 2040, y: 380, orient: 'h' },
  { a: 'west-corridor', b: 'pharmacy', x: 2760, y: 560, orient: 'h' },
  { a: 'west-corridor', b: 'east-corridor', x: 3200, y: 500, orient: 'v' },
  { a: 'east-corridor', b: 'emergency', x: 4360, y: 380, orient: 'h' },
  { a: 'east-corridor', b: 'ward4', x: 3620, y: 380, orient: 'h' },
  { a: 'east-corridor', b: 'radiology', x: 4000, y: 560, orient: 'h' },
  { a: 'radiology', b: 'archive', x: 4800, y: 690, orient: 'v' },
  { a: 'emergency', b: 'vault', x: 4800, y: 250, orient: 'v' },
  { a: 'archive', b: 'vault', x: 5000, y: 520, orient: 'h' },
];

export const DOOR_WIDTH = 96;

export function sliceRect(screen: BuildingScreenId): Rect {
  return { x: SLICE_INDEX[screen] * SLICE_W, y: 0, w: SLICE_W, h: SLICE_H };
}

export function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export function contains(r: Rect, p: Pt): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

export function findDoor(a: string, b: string): DoorLayout {
  const door = DOORS.find((d) => (d.a === a && d.b === b) || (d.a === b && d.b === a));
  if (!door) throw new Error(`No door drawn between ${a} and ${b}`);
  return door;
}

/** Corridors are walked along a line near their lower wall, so characters fit inside. */
export function walkY(room: string): number {
  const r = ROOMS[room].rect;
  return r.y + r.h - 36;
}

/** The point just inside `room` on each side of a door. */
export function doorSide(door: DoorLayout, room: string): Pt {
  const r = ROOMS[room].rect;
  if (ROOMS[room].corridor) {
    const x = door.orient === "v" ? (door.x < r.x + r.w / 2 ? door.x + 70 : door.x - 70) : door.x;
    return { x, y: walkY(room) };
  }
  const options =
    door.orient === 'v'
      ? [{ x: door.x - 70, y: door.y }, { x: door.x + 70, y: door.y }]
      : [{ x: door.x, y: door.y - 70 }, { x: door.x, y: door.y + 70 }];
  return options.find((p) => contains(r, p)) ?? options[0];
}
