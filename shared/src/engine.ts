// The NIGHT SHIFT game engine. Pure TypeScript, no I/O, no clocks, no Math.random.
// The simulation runs in fixed 100 ms steps, so the result depends only on the seed and the
// player's actions, never on how the server's timer happens to fire.
import { dispatchLine, emptyLine, foundLine, replyLine } from './lines';
import {
  DEMO,
  IMPACT_TYPES,
  WINGS,
  WING_NAMES,
  clockToMs,
  roomsByDistance,
  shortestPath,
  theRoom,
  world,
  type ImpactType,
  type RoomId,
  type Wing,
  type World,
} from './scenario';

export const STEP_MS = 100;
/** Longest stretch simulated in one call (e.g. after the server was suspended). */
const MAX_CATCH_UP_MS = 1000;

export type Phase = 'idle' | 'running' | 'paused' | 'ended';
export type ActionKind = 'patrol' | 'lock' | 'evict' | 'repair' | 'candlelight';
export const ACTIONS: readonly ActionKind[] = ['patrol', 'lock', 'evict', 'repair', 'candlelight'];

export interface RoomState {
  locked: boolean;
  /** Exhibits vandalised (reality: systems encrypted). */
  dark: boolean;
  /** How long intruders have been in the room without a break. */
  occupiedMs: number;
  /** Guard whose flashlight is on in here. */
  litBy: string | null;
}

export interface Group {
  id: number;
  room: RoomId;
  enteredMs: number;
  /** Seen by a patrol: flees at the next spread tick unless the room is locked. */
  spotted: boolean;
  visited: RoomId[];
}

export interface Task {
  action: ActionKind;
  room: RoomId;
  /** Walking route, current room first. */
  path: RoomId[];
  walkMs: number;
  workMs: number;
  elapsedMs: number;
  arrived: boolean;
  /** Patrol only: intruders were seen during this patrol. */
  found: boolean;
}

export interface Guard {
  id: string;
  name: string;
  /** Room the guard is in right now (changes while walking). */
  room: RoomId;
  task: Task | null;
}

export type LogKind = 'radio' | 'staff' | 'cctv' | 'rex' | 'event';

export interface LogEntry {
  id: number;
  atMs: number;
  kind: LogKind;
  speaker: string | null;
  text: string;
  /** Reality-view wording, where it differs. */
  real: string | null;
  room: RoomId | null;
  /** Clues only: did it point at a real intrusion? Hidden from players, used for debug and the report. */
  truth: boolean | null;
}

/** Short-lived visual cue for the screens (star burst, sparkle...). Never affects the game. */
export interface Fx {
  id: number;
  kind: 'spotted' | 'evicted' | 'repaired' | 'vandalised' | 'locked';
  room: RoomId;
  atMs: number;
}

/** How many recent effects are kept. */
const FX_KEEP = 12;

export interface Outcome {
  result: 'won' | 'lost';
  reason: string;
  real: string;
  atMs: number;
}

export interface GameState {
  scenarioId: string;
  phase: Phase;
  /** Simulated time since 00:00 on the game clock, in real ms. */
  timeMs: number;
  /** Time received but not yet simulated (less than one step). */
  accMs: number;
  rng: number;
  reality: boolean;
  debug: boolean;

  rooms: Record<RoomId, RoomState>;
  groups: Group[];
  nextGroupId: number;
  guards: Guard[];
  candlelight: Record<Wing, boolean>;

  brokenIn: boolean;
  nextSpreadMs: number;
  masterKeys: boolean;
  bypassUsed: boolean;
  backupsLost: boolean;

  care: number;
  lowestCare: number;
  impact: Record<ImpactType, number>;

  rex: {
    /** Confidence 0–100 that intruders are in each room. Updated every spread tick. */
    estimates: Record<RoomId, number>;
    mistake: { room: RoomId; untilMs: number } | null;
    mistakeDone: boolean;
    /** Rooms Rex is barking at whose bark the player has already acted on. */
    followed: RoomId[];
  };

  stats: {
    dispatches: number;
    patrols: number;
    locks: number;
    evicted: number;
    repairs: number;
    spotted: number;
    barks: number;
    wrongBarks: number;
    rexFollowed: number;
    rexFollowedWrong: number;
  };

  log: LogEntry[];
  nextLogId: number;
  fx: Fx[];
  nextFxId: number;
  outcome: Outcome | null;
}

// ---------- Setup ----------

export function initialState(scenarioId: string = DEMO.id): GameState {
  const w = world(scenarioId);
  const { sc } = w;
  const perRoom = <T>(make: () => T) => Object.fromEntries(sc.rooms.map((r) => [r.id, make()])) as Record<RoomId, T>;
  return {
    scenarioId,
    phase: 'idle',
    timeMs: 0,
    accMs: 0,
    rng: sc.seed >>> 0,
    reality: false,
    debug: false,
    rooms: perRoom(() => ({ locked: false, dark: false, occupiedMs: 0, litBy: null })),
    groups: [],
    nextGroupId: 1,
    guards: sc.guards.map((g) => ({ id: g.id, name: g.name, room: g.startRoom, task: null })),
    candlelight: Object.fromEntries(WINGS.map((wing) => [wing, false])) as Record<Wing, boolean>,
    brokenIn: false,
    nextSpreadMs: 0,
    masterKeys: false,
    bypassUsed: false,
    backupsLost: false,
    care: 100,
    lowestCare: 100,
    impact: Object.fromEntries(IMPACT_TYPES.map((t) => [t, 0])) as Record<ImpactType, number>,
    rex: { estimates: perRoom(() => 0), mistake: null, mistakeDone: false, followed: [] },
    stats: {
      dispatches: 0,
      patrols: 0,
      locks: 0,
      evicted: 0,
      repairs: 0,
      spotted: 0,
      barks: 0,
      wrongBarks: 0,
      rexFollowed: 0,
      rexFollowedWrong: 0,
    },
    log: [],
    nextLogId: 1,
    fx: [],
    nextFxId: 1,
    outcome: null,
  };
}

function clone(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}

/** mulberry32: small, fast, and identical on every machine. */
function rand(s: GameState): number {
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function log(s: GameState, entry: Omit<LogEntry, 'id' | 'atMs' | 'speaker' | 'real' | 'room' | 'truth'> & Partial<LogEntry>) {
  s.log.push({ speaker: null, real: null, room: null, truth: null, ...entry, id: s.nextLogId++, atMs: s.timeMs });
}

function fx(s: GameState, kind: Fx['kind'], room: RoomId): void {
  s.fx.push({ id: s.nextFxId++, kind, room, atMs: s.timeMs });
  if (s.fx.length > FX_KEEP) s.fx.splice(0, s.fx.length - FX_KEEP);
}

// ---------- Time ----------

/** Advance the simulation by `dtMs` of real time. Only a running game moves. */
export function advance(state: GameState, dtMs: number): GameState {
  if (state.phase !== 'running' || !(dtMs > 0)) return state;
  const s = clone(state);
  s.accMs += Math.min(dtMs, MAX_CATCH_UP_MS);
  while (s.accMs >= STEP_MS && s.phase === 'running') {
    s.accMs -= STEP_MS;
    tick(s, world(s.scenarioId));
  }
  return s;
}

/** step(state, dt, intents) → state: apply intents in order, then advance. Errors are returned per intent. */
export function step(state: GameState, dtMs: number, intents: Intent[] = []): { state: GameState; errors: string[] } {
  const errors: string[] = [];
  let s = state;
  for (const intent of intents) {
    const result = applyIntent(s, intent);
    s = result.state;
    if (result.error) errors.push(result.error);
  }
  return { state: advance(s, dtMs), errors };
}

function tick(s: GameState, w: World): void {
  const { sc, ms } = w;
  const before = s.timeMs;
  s.timeMs += STEP_MS;
  const now = s.timeMs;
  const reached = (at: number) => before < at && at <= now;
  const hour = sc.night.realSecondsPerGameHour;

  // Scheduled events.
  if (!s.brokenIn && now >= ms.breakIn) {
    s.brokenIn = true;
    addGroup(s, sc.intruders.entryRoom, [sc.intruders.entryRoom]);
    s.nextSpreadMs = ms.breakIn + ms.spreadTick;
  }
  for (const d of sc.clues.decoyChatter) {
    if (reached(clockToMs(d.at, hour))) log(s, { kind: 'staff', speaker: d.speaker, text: d.text, truth: false });
  }
  for (const f of sc.clues.falseCctv) {
    if (reached(clockToMs(f.at, hour))) cctv(s, w, f.room, false);
  }

  updateGuards(s, w);
  updateRooms(s, w);
  if (s.phase !== 'running') return;

  if (s.brokenIn && now >= s.nextSpreadMs) {
    spread(s, w);
    for (const room of sc.rooms) {
      if (occupied(s, room.id) && rand(s) < sc.clues.cctvChancePerTick) cctv(s, w, room.id, true);
    }
    updateRex(s, w);
    s.nextSpreadMs += s.masterKeys ? ms.masterKeysTick : ms.spreadTick;
  }

  revealLitRooms(s, w);
  updateCare(s, w);

  if (now >= ms.night) {
    end(s, 'won', 'Dawn breaks. The Vault is safe.', 'Incident window closed. Patient records protected.');
  }
}

// ---------- Intruders ----------

function addGroup(s: GameState, room: RoomId, visited: RoomId[]): void {
  s.groups.push({ id: s.nextGroupId++, room, enteredMs: s.timeMs, spotted: false, visited });
}

function occupied(s: GameState, room: RoomId): boolean {
  return s.groups.some((g) => g.room === room);
}

function spread(s: GameState, w: World): void {
  const { intruders } = w.sc;
  for (const g of [...s.groups]) {
    if (g.spotted) {
      const dest = pickDestination(s, w, g, true);
      if (dest) moveGroup(s, g, dest);
      continue;
    }
    if (g.room === w.vault) continue;
    if (s.timeMs - g.enteredMs < w.ms.minStay) continue;
    if (rand(s) >= intruders.moveChance) continue;
    const dest = pickDestination(s, w, g, false);
    if (!dest) continue;
    if (s.groups.length < intruders.maxGroups && rand(s) < intruders.splitChance) {
      // Split: part of the gang moves on, the rest stays behind and keeps the room dark.
      addGroup(s, dest, [...g.visited, dest]);
      g.enteredMs = s.timeMs;
    } else {
      moveGroup(s, g, dest);
    }
  }
}

function moveGroup(s: GameState, g: Group, dest: RoomId): void {
  g.room = dest;
  g.enteredMs = s.timeMs;
  g.spotted = false;
  if (!g.visited.includes(dest)) g.visited.push(dest);
}

/** Weighted choice of a neighbouring room. Locked doors stop the gang, unless they have unused master keys. */
function pickDestination(s: GameState, w: World, g: Group, fleeing: boolean): RoomId | null {
  const { intruders } = w.sc;
  const here = g.room;
  const options: { room: RoomId; weight: number; bypass: boolean }[] = [];
  for (const n of w.neighbours.get(here)!) {
    const blocked = s.rooms[here].locked || s.rooms[n].locked;
    if (blocked && !(s.masterKeys && !s.bypassUsed)) continue;
    if (fleeing && s.guards.some((guard) => guard.room === n)) continue;
    let weight = w.room.get(n)!.lure;
    if (w.distToVault.get(n)! < w.distToVault.get(here)!) weight *= intruders.towardVaultFactor;
    if (g.visited.includes(n)) weight *= intruders.revisitFactor;
    options.push({ room: n, weight, bypass: blocked });
  }
  if (options.length === 0) return null;

  let r = rand(s) * options.reduce((sum, o) => sum + o.weight, 0);
  let choice = options[options.length - 1];
  for (const o of options) {
    r -= o.weight;
    if (r < 0) {
      choice = o;
      break;
    }
  }
  if (choice.bypass) {
    s.bypassUsed = true;
    log(s, {
      kind: 'event',
      room: choice.room,
      text: 'The gang used the master keys on a locked door!',
      real: 'Isolation bypassed with stolen admin credentials.',
    });
  }
  return choice.room;
}

function updateRooms(s: GameState, w: World): void {
  for (const room of w.sc.rooms) {
    const rs = s.rooms[room.id];
    if (occupied(s, room.id)) rs.occupiedMs += STEP_MS;
    else rs.occupiedMs = 0;

    if (room.special === 'vault' && rs.occupiedMs >= w.ms.vaultLose) {
      end(s, 'lost', 'The gang cracked the Vault.', 'Major incident declared: patient records encrypted, ambulances diverted.');
      return;
    }
    if (!rs.dark && rs.occupiedMs >= w.ms.vandalise) vandalise(s, w, room.id);
  }
}

function vandalise(s: GameState, w: World, roomId: RoomId): void {
  const room = w.room.get(roomId)!;
  s.rooms[roomId].dark = true;
  fx(s, 'vandalised', roomId);
  log(s, {
    kind: 'event',
    room: roomId,
    text: `Exhibits went dark in ${theRoom(room.name)}.`,
    real: `Systems encrypted: ${room.real}.`,
  });
  for (const ex of room.exhibits) {
    log(s, { kind: 'staff', speaker: ex.report.speaker, text: ex.report.text, room: roomId, truth: true });
  }
  if (room.special === 'masterKeys' && !s.masterKeys) {
    s.masterKeys = true;
    log(s, {
      kind: 'event',
      room: roomId,
      text: 'The gang took the master keys. They move faster and can open one locked door.',
      real: 'Admin credentials stolen: faster spread, one isolation can be bypassed.',
    });
  }
  if (room.special === 'backups' && !s.backupsLost) {
    s.backupsLost = true;
    log(s, {
      kind: 'event',
      room: roomId,
      text: 'The Archive is wrecked. Repairs are no longer possible tonight.',
      real: 'Backups destroyed: restore is unavailable.',
    });
  }
}

// ---------- Clues ----------

function cctv(s: GameState, w: World, roomId: RoomId, truth: boolean): void {
  const room = w.room.get(roomId)!;
  log(s, { kind: 'cctv', room: roomId, text: room.cctv.game, real: room.cctv.reality, truth });
}

function updateRex(s: GameState, w: World): void {
  const { rex: cfg } = w.sc;
  const busy = new Set(s.groups.map((g) => g.room));
  const previous = s.rex.estimates;
  const next: Record<RoomId, number> = {};

  for (const room of w.sc.rooms) {
    const near = w.neighbours.get(room.id)!.some((n) => busy.has(n));
    if (busy.has(room.id)) next[room.id] = 70 + Math.floor(rand(s) * 26);
    else if (near) next[room.id] = 15 + Math.floor(rand(s) * 20);
    else next[room.id] = Math.floor(rand(s) * 8);
  }

  // Rex is deliberately wrong once: a confident bark at an empty room.
  let mistakeStarts: RoomId | null = null;
  if (!s.rex.mistakeDone && s.timeMs >= w.ms.rexMistakeFrom) {
    const room = roomsByDistance(w, cfg.mistake.room).find((id) => !busy.has(id) && id !== w.vault);
    if (room) {
      s.rex.mistake = { room, untilMs: s.timeMs + w.ms.rexMistakeHold };
      s.rex.mistakeDone = true;
      mistakeStarts = room;
    }
  }
  if (s.rex.mistake) {
    if (s.timeMs < s.rex.mistake.untilMs) next[s.rex.mistake.room] = Math.max(next[s.rex.mistake.room], cfg.mistake.confidence);
    else s.rex.mistake = null;
  }

  for (const room of w.sc.rooms) {
    const barking = next[room.id] >= cfg.barkThreshold;
    const wasBarking = previous[room.id] >= cfg.barkThreshold;
    // The mistake always gets its own bark, even if Rex was still on edge about that room.
    if (barking && (!wasBarking || room.id === mistakeStarts)) {
      const truth = busy.has(room.id);
      s.stats.barks++;
      if (!truth) s.stats.wrongBarks++;
      s.rex.followed = s.rex.followed.filter((id) => id !== room.id);
      log(s, {
        kind: 'rex',
        speaker: 'Rex',
        room: room.id,
        text: `Woof! Rex is sure about ${theRoom(room.name)} (${next[room.id]}%).`,
        real: `AI copilot: likely compromise in ${room.real} (${next[room.id]}% confidence).`,
        truth,
      });
    }
  }
  s.rex.estimates = next;
}

// ---------- Guards ----------

function updateGuards(s: GameState, w: World): void {
  for (const guard of s.guards) {
    const task = guard.task;
    if (!task) continue;
    task.elapsedMs += STEP_MS;
    guard.room = task.path[Math.min(task.path.length - 1, Math.floor(task.elapsedMs / w.ms.walkPerRoom))];
    if (!task.arrived && task.elapsedMs >= task.walkMs) {
      task.arrived = true;
      guard.room = task.room;
      if (task.action === 'patrol') s.rooms[task.room].litBy = guard.id;
    }
    if (task.arrived && task.elapsedMs >= task.walkMs + task.workMs) {
      guard.task = null;
      complete(s, w, guard, task);
    }
  }
}

/** Intruders in a room lit by a patrol are seen, and try to flee. */
function revealLitRooms(s: GameState, w: World): void {
  for (const g of s.groups) {
    const guardId = s.rooms[g.room].litBy;
    if (!guardId || g.spotted) continue;
    g.spotted = true;
    s.stats.spotted++;
    fx(s, 'spotted', g.room);
    const guard = s.guards.find((x) => x.id === guardId)!;
    if (guard.task && !guard.task.found) {
      guard.task.found = true;
      say(s, guard, foundLine(guard.id, s.stats.spotted, theRoom(w.room.get(g.room)!.name)), g.room);
    }
  }
}

function say(s: GameState, guard: Guard, text: string, room: RoomId | null): void {
  log(s, { kind: 'radio', speaker: guard.name, text, room });
}

function complete(s: GameState, w: World, guard: Guard, task: Task): void {
  const room = w.room.get(task.room)!;
  const rs = s.rooms[task.room];
  const name = theRoom(room.name);
  const Name = name.charAt(0).toUpperCase() + name.slice(1);
  const inside = s.groups.filter((g) => g.room === task.room);

  switch (task.action) {
    case 'patrol':
      if (rs.litBy === guard.id) rs.litBy = null;
      s.stats.patrols++;
      if (!task.found) say(s, guard, emptyLine(guard.id, s.stats.patrols, name), task.room);
      break;

    case 'lock':
      if (!rs.locked) {
        rs.locked = true;
        s.stats.locks++;
        fx(s, 'locked', task.room);
      }
      say(s, guard, `${Name} is locked.`, task.room);
      break;

    case 'evict':
      if (!rs.locked) {
        say(s, guard, `The doors are open, I can't corner anyone in ${name}.`, task.room);
        break;
      }
      if (inside.length === 0) {
        say(s, guard, `Nobody in ${name}, chief.`, task.room);
        break;
      }
      s.groups = s.groups.filter((g) => g.room !== task.room);
      s.stats.evicted += inside.length;
      fx(s, 'evicted', task.room);
      say(s, guard, `Out they go! ${Name} is clear.`, task.room);
      if (s.groups.length === 0) {
        end(s, 'won', 'Every intruder has been shown the door.', 'All malware eradicated. Incident contained.');
      }
      break;

    case 'repair':
      if (inside.length > 0) {
        say(s, guard, `Someone's still in ${name}! Clear them out first.`, task.room);
        break;
      }
      if (rs.dark && s.backupsLost) {
        say(s, guard, `The Archive is wrecked, chief. Can't fix ${name}.`, task.room);
        break;
      }
      rs.dark = false;
      rs.locked = false;
      rs.occupiedMs = 0;
      s.stats.repairs++;
      fx(s, 'repaired', task.room);
      say(s, guard, `${Name} is back on and open.`, task.room);
      break;

    case 'candlelight':
      s.candlelight[room.wing] = true;
      say(s, guard, `Candles lit in the ${WING_NAMES[room.wing].name}. Staff are on paper.`, task.room);
      break;
  }
}

// ---------- Care ----------

function updateCare(s: GameState, w: World): void {
  const { sc } = w;
  let loss = 0;
  for (const room of sc.rooms) {
    const rs = s.rooms[room.id];
    if (!rs.locked && !rs.dark) continue;
    const factor = s.candlelight[room.wing] ? sc.actions.candlelightModifier : 1;
    for (const ex of room.exhibits) {
      loss += ex.criticality * factor;
      if (ex.impact) s.impact[ex.impact] += (sc.impactPerGameHour[ex.impact] * factor * STEP_MS) / w.ms.gameHour;
    }
  }
  s.care = Math.max(0, Math.min(100, 100 - loss));
  s.lowestCare = Math.min(s.lowestCare, s.care);
}

function end(s: GameState, result: Outcome['result'], reason: string, real: string): void {
  if (s.phase === 'ended') return;
  s.phase = 'ended';
  s.outcome = { result, reason, real, atMs: s.timeMs };
  for (const rs of Object.values(s.rooms)) rs.litBy = null;
  log(s, { kind: 'event', text: reason, real });
}

// ---------- Intents ----------

export const INTENT_TYPES = ['start', 'togglePause', 'reset', 'toggleReality', 'toggleDebug', 'toggleCode', 'action'] as const;
export type IntentType = (typeof INTENT_TYPES)[number];

export type Intent =
  | { type: Exclude<IntentType, 'action'> }
  | { type: 'action'; action: ActionKind; room: RoomId; guard?: string };

/** Only the presenter page can start, reset or hand over control. */
export const PRESENTER_ONLY: readonly IntentType[] = ['start', 'reset', 'toggleCode'];

export function isIntent(value: unknown): value is Intent {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (!INTENT_TYPES.includes(v.type as IntentType)) return false;
  if (v.type !== 'action') return true;
  return (
    ACTIONS.includes(v.action as ActionKind) &&
    typeof v.room === 'string' &&
    (v.guard === undefined || typeof v.guard === 'string')
  );
}

export type ApplyResult = { state: GameState; error?: string };

/** Applies an intent. `toggleCode` belongs to the server's control layer and is a no-op here. */
export function applyIntent(state: GameState, intent: Intent): ApplyResult {
  switch (intent.type) {
    case 'start':
      if (state.phase === 'running') return { state, error: 'Already running.' };
      if (state.phase === 'ended') return { state, error: 'The night is over. Press R to reset.' };
      return { state: { ...state, phase: 'running' } };
    case 'togglePause':
      if (state.phase === 'idle') return { state, error: 'Not started yet. Press S.' };
      if (state.phase === 'ended') return { state, error: 'The night is over. Press R to reset.' };
      return { state: { ...state, phase: state.phase === 'running' ? 'paused' : 'running' } };
    case 'reset': {
      const fresh = initialState(state.scenarioId);
      return { state: { ...fresh, reality: state.reality, debug: state.debug } };
    }
    case 'toggleReality':
      return { state: { ...state, reality: !state.reality } };
    case 'toggleDebug':
      return { state: { ...state, debug: !state.debug } };
    case 'toggleCode':
      return { state };
    case 'action':
      return dispatch(state, intent);
  }
}

const WORK_SEC: Record<ActionKind, (w: World) => number> = {
  patrol: (w) => w.sc.actions.patrolSec,
  lock: (w) => w.sc.actions.lockSec,
  evict: (w) => w.sc.actions.evictSec,
  repair: (w) => w.sc.actions.repairSec,
  candlelight: (w) => w.sc.actions.candlelightSec,
};

function dispatch(state: GameState, intent: Extract<Intent, { type: 'action' }>): ApplyResult {
  const fail = (error: string): ApplyResult => ({ state, error });
  const w = world(state.scenarioId);
  const room = w.room.get(intent.room);
  if (!room) return fail('Unknown room.');
  if (state.phase === 'idle') return fail('The night has not started yet.');
  if (state.phase === 'paused') return fail('Paused. Press Space to continue.');
  if (state.phase === 'ended') return fail('The night is over.');

  const rs = state.rooms[room.id];
  const name = theRoom(room.name);
  const busyWith = (action: ActionKind, target: (t: Task) => boolean) =>
    state.guards.find((g) => g.task?.action === action && target(g.task));

  switch (intent.action) {
    case 'patrol': {
      const other = busyWith('patrol', (t) => t.room === room.id);
      if (other) return fail(`${other.name} is already checking ${name}.`);
      break;
    }
    case 'lock': {
      if (rs.locked) return fail(`${upper(name)} is already locked.`);
      const other = busyWith('lock', (t) => t.room === room.id);
      if (other) return fail(`${other.name} is already locking ${name}.`);
      break;
    }
    case 'evict': {
      if (!rs.locked) return fail(`Lock ${name} first, so they can't slip away.`);
      const other = busyWith('evict', (t) => t.room === room.id);
      if (other) return fail(`${other.name} is already clearing ${name}.`);
      break;
    }
    case 'repair': {
      if (!rs.locked) return fail(rs.dark ? `Lock and clear ${name} before repairing it.` : `Nothing to repair in ${name}.`);
      if (rs.dark && state.backupsLost) return fail('The Archive is wrecked. Repairs are disabled tonight.');
      const other = busyWith('repair', (t) => t.room === room.id);
      if (other) return fail(`${other.name} is already repairing ${name}.`);
      break;
    }
    case 'candlelight': {
      const wingName = `the ${WING_NAMES[room.wing].name}`;
      if (state.candlelight[room.wing]) return fail(`Candles are already lit in ${wingName}.`);
      const anyClosed = w.sc.rooms.some((r) => r.wing === room.wing && (state.rooms[r.id].locked || state.rooms[r.id].dark));
      if (!anyClosed) return fail(`Everything in ${wingName} is running. No need for candles yet.`);
      if (busyWith('candlelight', (t) => w.room.get(t.room)!.wing === room.wing)) return fail(`Someone is already lighting ${wingName}.`);
      break;
    }
  }

  // Pick the guard: the one asked for, or the nearest free one.
  let guard: Guard | undefined;
  if (intent.guard) {
    guard = state.guards.find((g) => g.id === intent.guard);
    if (!guard) return fail('Unknown guard.');
    if (guard.task) return fail(`${guard.name} is busy.`);
  } else {
    const free = state.guards.filter((g) => !g.task);
    if (free.length === 0) return fail('All three guards are busy.');
    guard = free.reduce((best, g) =>
      shortestPath(w, g.room, room.id).length < shortestPath(w, best.room, room.id).length ? g : best,
    );
  }

  const s = clone(state);
  const g = s.guards.find((x) => x.id === guard.id)!;
  const path = shortestPath(w, g.room, room.id);
  g.task = {
    action: intent.action,
    room: room.id,
    path,
    walkMs: (path.length - 1) * w.ms.walkPerRoom,
    workMs: WORK_SEC[intent.action](w) * 1000,
    elapsedMs: 0,
    arrived: false,
    found: false,
  };
  s.stats.dispatches++;

  // Trust analysis: acting on a room Rex is barking at counts as following him (once per bark).
  if (intent.action !== 'candlelight' && intent.action !== 'repair') {
    const barking = s.rex.estimates[room.id] >= w.sc.rex.barkThreshold;
    if (barking && !s.rex.followed.includes(room.id)) {
      s.rex.followed.push(room.id);
      s.stats.rexFollowed++;
      if (!occupied(s, room.id)) s.stats.rexFollowedWrong++;
    }
  }

  const target = intent.action === 'candlelight' ? `the ${WING_NAMES[room.wing].name}` : name;
  log(s, { kind: 'radio', speaker: 'You', text: dispatchLine(g.name, intent.action, target), room: room.id });
  say(s, g, replyLine(g.id, s.stats.dispatches), room.id);
  return { state: s };
}

function upper(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ---------- Snapshot helpers ----------

/** How many log entries clients receive. The full log stays on the server for the morning report. */
export const LOG_TAIL = 30;

export type PublicState = GameState;

export function publicState(state: GameState): PublicState {
  return state.log.length <= LOG_TAIL ? state : { ...state, log: state.log.slice(-LOG_TAIL) };
}
