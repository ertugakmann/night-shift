// Test players, for checking that the care score means something: a careful player ends in the 80s–90s,
// a careless one in the 40s–50s, and a night where nobody does anything is lost at the Vault, early.
// They play like a person at the desk: they only know what the screens show (clues, lit rooms, spotted
// intruders), take a few seconds between decisions, walk, wait for padlocks and play the mini games.
// Used by tests only (not exported from the package).
import { advance, applyIntent, initialState, miniGameBusy, padlocks, type ActionKind, type GameState, type Intent } from './engine';
import { world } from './scenario';

export type BotStyle = 'idle' | 'good' | 'careless';

interface Habits {
  /** Seconds of game time between decisions. */
  everyMs: number;
  /** Calls the letters right. */
  readsLetters: boolean;
  /** Plays the catch and the change-the-locks code well. */
  quickHands: boolean;
  /** Repairs dark rooms, reopens empty locked ones, lights candles. */
  tidiesUp: boolean;
}

const HABITS: Record<Exclude<BotStyle, 'idle'>, Habits> = {
  good: { everyMs: 4000, readsLetters: true, quickHands: true, tidiesUp: true },
  careless: { everyMs: 9000, readsLetters: false, quickHands: false, tidiesUp: false },
};

function started(): GameState {
  return applyIntent(applyIntent(initialState(), { type: 'start' }).state, { type: 'skipIntro' }).state;
}

function tryIntent(s: GameState, intent: Intent): GameState {
  const r = applyIntent(s, intent);
  return r.error ? s : r.state;
}

function busyWith(s: GameState, action: ActionKind, room: string): boolean {
  return s.guards.some((g) => g.task?.action === action && g.task.room === room);
}

function freeGuard(s: GameState): boolean {
  return s.guards.some((g) => !g.task);
}

/** The mini games: answered as soon as they show up (well, or badly). */
function playMiniGames(s: GameState, h: Habits): GameState {
  if (s.letter && s.letter.result === null) s = tryIntent(s, { type: 'letter', answer: h.readsLetters === s.letter.phishing ? 'phishing' : 'safe' });
  if (s.keys && s.keys.result === null && h.quickHands) {
    const code = s.keys.code.replace('-', '');
    for (const ch of code.slice(s.keys.typed)) s = tryIntent(s, { type: 'code', char: ch });
  }
  if (s.wires && s.wires.result === null) {
    const { left, right } = s.wires;
    left.forEach((colour, from) => {
      if (!s.wires!.connected.includes(colour)) s = tryIntent(s, { type: 'wire', from, to: right.indexOf(colour) });
    });
  }
  if (s.catch && s.catch.result === null && h.quickHands) {
    for (const f of s.catch.figures.filter((f) => f.kind === 'intruder' && !f.caught)) s = tryIntent(s, { type: 'catch', figure: f.id });
  }
  return s;
}

/** How far back the player looks at the clues (Rex, cameras, staff on the radio). */
const CLUES_MS = 15_000;

/**
 * One decision round: clues point to a room and a guard patrols it; a group seen there is locked in and
 * caught; then (a tidy player) closed rooms are repaired or reopened and candles go up where a wing hurts.
 */
function move(s: GameState, h: Habits, patrolledAt: Map<string, number>): GameState {
  const w = world(s.scenarioId);
  s = playMiniGames(s, h);
  // What can be seen: groups in a lit room, or spotted by a patrol.
  for (const g of s.groups) {
    const r = g.room;
    const rs = s.rooms[r];
    if (!g.spotted && !rs.litBy) continue;
    if (!rs.locked) {
      if (!busyWith(s, 'lock', r) && padlocks(s).free > 0 && freeGuard(s)) s = tryIntent(s, { type: 'action', action: 'lock', room: r });
    } else if (g.spotted && !miniGameBusy(s) && !s.guards.some((x) => x.task?.action === 'evict') && freeGuard(s)) {
      s = tryIntent(s, { type: 'action', action: 'evict', room: r });
    }
  }
  // What the clues say: patrol the rooms they point at, most recent first.
  const clues = s.log.filter((e) => e.room && (e.kind === 'rex' || e.kind === 'cctv' || e.kind === 'staff') && s.timeMs - e.atMs <= CLUES_MS).reverse();
  for (const e of clues) {
    const r = e.room!;
    if (!freeGuard(s)) break;
    if (s.rooms[r].locked || s.rooms[r].litBy || busyWith(s, 'patrol', r)) continue;
    if (s.timeMs - (patrolledAt.get(r) ?? -Infinity) < 10_000) continue;
    const next = tryIntent(s, { type: 'action', action: 'patrol', room: r });
    if (next !== s) patrolledAt.set(r, s.timeMs);
    s = next;
  }
  if (!h.tidiesUp) return s;
  // Rooms left closed with nobody inside: repair them (or just reopen), so their padlock and exhibits come back.
  for (const room of w.sc.rooms) {
    const rs = s.rooms[room.id];
    if (!rs.locked || s.groups.some((g) => g.room === room.id) || !freeGuard(s)) continue;
    if (busyWith(s, 'repair', room.id) || busyWith(s, 'unlock', room.id)) continue;
    if (rs.dark && !s.backupsLost) {
      if (!miniGameBusy(s) && !s.guards.some((x) => x.task?.action === 'repair')) s = tryIntent(s, { type: 'action', action: 'repair', room: room.id });
    } else if (!rs.dark) s = tryIntent(s, { type: 'action', action: 'unlock', room: room.id });
  }
  // Dark but open rooms the gang has left: lock them, to repair them.
  for (const room of w.sc.rooms) {
    const rs = s.rooms[room.id];
    if (rs.dark && !rs.locked && !s.groups.some((g) => g.room === room.id) && !s.backupsLost && padlocks(s).free > 1 && freeGuard(s) && !busyWith(s, 'lock', room.id)) {
      s = tryIntent(s, { type: 'action', action: 'lock', room: room.id });
    }
  }
  // Candles in any wing with a closed or dark room.
  for (const room of w.sc.rooms) {
    const rs = s.rooms[room.id];
    if ((rs.locked || rs.dark) && !s.candlelight[room.wing] && freeGuard(s) && !s.guards.some((g) => g.task?.action === 'candlelight')) {
      s = tryIntent(s, { type: 'action', action: 'candlelight', room: room.id });
    }
  }
  return s;
}

/** Play a whole night in one style. */
export function playNight(style: BotStyle): GameState {
  let s = started();
  let next = 0;
  const patrolledAt = new Map<string, number>();
  while (s.phase === 'running') {
    if (style !== 'idle' && s.timeMs >= next) {
      const h = HABITS[style];
      s = move(s, h, patrolledAt);
      next = s.timeMs + h.everyMs;
    }
    s = advance(s, 100);
  }
  return s;
}
