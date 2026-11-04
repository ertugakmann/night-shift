// The NIGHT SHIFT game engine. Pure TypeScript, no I/O, no clocks, no Math.random.
// The simulation runs in fixed 100 ms steps, so the result depends only on the seed and the
// player's actions, never on how the server's timer happens to fire.
import {
  candlesLine,
  dispatchLine,
  emptyLine,
  evictEmptyLine,
  evictedLine,
  foundLine,
  lockedLine,
  repairedLine,
  replyLine,
} from './lines';
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

export type Phase = 'idle' | 'intro' | 'running' | 'paused' | 'ended';
export type ActionKind = 'patrol' | 'lock' | 'unlock' | 'evict' | 'repair' | 'candlelight';
export const ACTIONS: readonly ActionKind[] = ['patrol', 'lock', 'unlock', 'evict', 'repair', 'candlelight'];

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

/** End-of-night numbers, fixed the moment the night ends. All times are game-clock ms since 00:00. */
export interface NightSummary {
  /** Care continuity: the care score averaged over the whole night, 0–100. After a lost night the hours left until dawn count as 0. */
  careContinuity: number;
  /** Mean time to detect: break-in until the gang is first spotted. Null if never spotted. */
  mttdMs: number | null;
  /** Mean time to respond: first spotted until the gang is stopped (all trapped or evicted). Null if never stopped. */
  mttrMs: number | null;
}

export interface Outcome {
  result: 'won' | 'lost';
  reason: string;
  real: string;
  atMs: number;
  summary: NightSummary;
}

/** Someone in the "Catch the intruders" scene. x, y in 0–1 across the scene. */
export interface CatchFigure {
  id: number;
  kind: 'intruder' | 'innocent';
  /** Which character (or process name) to draw. */
  look: number;
  x: number;
  y: number;
  caught: boolean;
  /** When a wrong click hit this innocent (for the "Hey!" animation). */
  oopsAtMs: number | null;
}

/**
 * Evict as a mini game: when the guard reaches the room, the gang hides among innocent visitors.
 * Click every intruder before the time runs out. Shared by every screen, played by whoever has control.
 */
export interface Catch {
  id: number;
  room: RoomId;
  guard: string;
  startedMs: number;
  /** Time runs out here; every wrong click brings it closer. */
  endsMs: number;
  figures: CatchFigure[];
  wrong: number;
  /** caught: all thrown out. held: time ran out, but the room is locked and they are still inside. escaped: they fled to `to`. */
  result: 'caught' | 'held' | 'escaped' | null;
  to: RoomId | null;
  resultAtMs: number | null;
}

/** How long the result of a catch stays on screen. */
export const CATCH_RESULT_MS = 1800;

export interface DoneAction {
  guard: string;
  action: ActionKind;
  room: RoomId;
  atMs: number;
  hit: boolean;
}

export interface GameState {
  scenarioId: string;
  phase: Phase;
  /** How far the shift-start intro has played (real ms). The game clock waits at 00:00 meanwhile. */
  introMs: number;
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
  /** The next spread tick is the first one, where the gang splits up. */
  entrySplit: boolean;
  nextSpreadMs: number;
  masterKeys: boolean;
  backupsLost: boolean;

  care: number;
  lowestCare: number;
  impact: Record<ImpactType, number>;

  rex: {
    /** Confidence 0–100 that intruders are in each room. Updated every spread tick. */
    estimates: Record<RoomId, number>;
    mistake: { room: RoomId; untilMs: number } | null;
    mistakeDone: boolean;
    /**
     * Barks waiting for the player's decision: a patrol sent there before `untilMs` follows Rex,
     * otherwise the bark counts as ignored. `truth`: the gang really was there when he barked.
     */
    pending: { room: RoomId; truth: boolean; untilMs: number }[];
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
    /** Barks that ended without the player acting on them, and how many of those were right. */
    rexIgnored: number;
    rexIgnoredRight: number;
    /** Game time the gang broke in, was first spotted, and was last fully stopped (null while any group roams free). */
    brokenInMs: number | null;
    firstSpottedMs: number | null;
    containedMs: number | null;
    /** Care score integrated over time (score × ms), for care continuity. */
    careMs: number;
  };

  log: LogEntry[];
  nextLogId: number;
  fx: Fx[];
  nextFxId: number;
  outcome: Outcome | null;
  /** Every finished guard action, for the morning report. `hit`: it did what it was for (found, evicted, restored...). */
  done: DoneAction[];
  /** The "Catch the intruders" mini game in progress (or just finished, while its result shows). */
  catch: Catch | null;
  nextCatchId: number;
}

// ---------- Setup ----------

export function initialState(scenarioId: string = DEMO.id): GameState {
  const w = world(scenarioId);
  const { sc } = w;
  const perRoom = <T>(make: () => T) => Object.fromEntries(sc.rooms.map((r) => [r.id, make()])) as Record<RoomId, T>;
  return {
    scenarioId,
    phase: 'idle',
    introMs: 0,
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
    entrySplit: false,
    nextSpreadMs: 0,
    masterKeys: false,
    backupsLost: false,
    care: 100,
    lowestCare: 100,
    impact: Object.fromEntries(IMPACT_TYPES.map((t) => [t, 0])) as Record<ImpactType, number>,
    rex: { estimates: perRoom(() => 0), mistake: null, mistakeDone: false, pending: [] },
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
      rexIgnored: 0,
      rexIgnoredRight: 0,
      brokenInMs: null,
      firstSpottedMs: null,
      containedMs: null,
      careMs: 0,
    },
    log: [],
    nextLogId: 1,
    fx: [],
    nextFxId: 1,
    outcome: null,
    done: [],
    catch: null,
    nextCatchId: 1,
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

/** Advance the simulation by `dtMs` of real time. Only a running game moves (or the intro plays). */
export function advance(state: GameState, dtMs: number): GameState {
  if (!(dtMs > 0)) return state;
  if (state.phase === 'intro') return playIntro(state, Math.min(dtMs, MAX_CATCH_UP_MS));
  if (state.phase !== 'running') return state;
  const s = clone(state);
  s.accMs += Math.min(dtMs, MAX_CATCH_UP_MS);
  while (s.accMs >= STEP_MS && s.phase === 'running') {
    s.accMs -= STEP_MS;
    tick(s, world(s.scenarioId));
  }
  return s;
}

/** The shift-start intro: radio check on cue, then the clock starts. Uses no randomness. */
function playIntro(state: GameState, dtMs: number): GameState {
  const s = clone(state);
  const w = world(s.scenarioId);
  const before = s.introMs;
  s.introMs = Math.min(w.ms.intro, s.introMs + dtMs);
  radioCheck(s, w, before, s.introMs);
  if (s.introMs >= w.ms.intro) s.phase = 'running';
  return s;
}

/** Log the radio-check lines whose cue falls in (from, to]. */
function radioCheck(s: GameState, w: World, from: number, to: number): void {
  for (const line of w.sc.intro.radioCheck) {
    const at = line.atSec * 1000;
    if (from < at && at <= to) {
      const guard = s.guards.find((g) => g.id === line.guard);
      if (guard) say(s, guard, line.text, null, 'Status check: no alerts on my segment.');
    }
  }
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
  // A locked door keeps everyone out, the gang too. Mail Room locked: they try the front door instead
  // (reality: phishing blocked, so they come in over the VPN). Both locked: they wait outside.
  if (!s.brokenIn && now >= ms.breakIn) {
    const front = sc.intruders.frontDoor;
    const entry = !s.rooms[sc.intruders.entryRoom].locked ? sc.intruders.entryRoom : !s.rooms[front.room].locked ? front.room : null;
    if (entry) {
      s.brokenIn = true;
      s.stats.brokenInMs = now;
      addGroup(s, entry, [entry]);
      s.entrySplit = true;
      s.nextSpreadMs = now + ms.firstSplit;
      if (entry === front.room) {
        const guard = s.guards.find((g) => g.id === front.guard);
        if (guard) say(s, guard, front.text, entry, front.real);
      }
    }
  }
  for (const d of sc.clues.decoyChatter) {
    if (reached(clockToMs(d.at, hour))) log(s, { kind: 'staff', speaker: d.speaker, text: d.text, truth: false });
  }
  for (const f of sc.clues.falseCctv) {
    if (reached(clockToMs(f.at, hour))) cctv(s, w, f.room, false);
  }

  updateGuards(s, w);
  updateCatch(s, w);
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
  expireBarks(s);
  updateContainment(s);
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
  if (s.entrySplit) {
    s.entrySplit = false;
    // Right after getting in, the gang splits up: some stay, the rest slip into the next room
    // (firstSplitTo). Finding one group is never enough. Like every move, a locked door stops it.
    // Three draws, exactly as an ordinary move-and-split, so the seeded night stays the same.
    const g = s.groups[0];
    if (g) {
      rand(s); // move?
      rand(s); // which door
      rand(s); // split?
      const dest = g.room === intruders.frontDoor.room ? intruders.frontDoor.splitTo : intruders.firstSplitTo;
      if (!s.rooms[g.room].locked && !s.rooms[dest].locked) {
        addGroup(s, dest, [...g.visited, dest]);
        g.enteredMs = s.timeMs;
      }
    }
    return;
  }
  for (const g of [...s.groups]) {
    if (s.catch && s.catch.result === null && g.room === s.catch.room) continue; // busy hiding from the guard
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

/** Weighted choice of a neighbouring room. Locked doors always stop the gang. */
function pickDestination(s: GameState, w: World, g: Group, fleeing: boolean): RoomId | null {
  const { intruders } = w.sc;
  const here = g.room;
  const options: { room: RoomId; weight: number }[] = [];
  for (const n of w.neighbours.get(here)!) {
    const blocked = s.rooms[here].locked || s.rooms[n].locked;
    if (blocked) continue; // nobody gets in or out of a locked room
    if (fleeing && s.guards.some((guard) => guard.room === n)) continue;
    let weight = w.room.get(n)!.lure;
    if (w.distToVault.get(n)! < w.distToVault.get(here)!) weight *= intruders.towardVaultFactor;
    if (g.visited.includes(n)) weight *= intruders.revisitFactor;
    options.push({ room: n, weight });
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

  return choice.room;
}

function updateRooms(s: GameState, w: World): void {
  for (const room of w.sc.rooms) {
    const rs = s.rooms[room.id];
    if (occupied(s, room.id)) rs.occupiedMs += STEP_MS;
    else rs.occupiedMs = 0;

    if (room.special === 'vault' && rs.occupiedMs >= w.ms.vaultLose) {
      end(s, 'lost', 'The gang cracked the Vault.', 'Major incident declared: ambulances diverted.');
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
      text: 'The gang took the master keys. They move faster now.',
      real: 'Admin credentials stolen: faster spread.',
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
    const barking = next[room.id] > cfg.barkThreshold;
    const wasBarking = previous[room.id] > cfg.barkThreshold;
    // The mistake always gets its own bark, even if Rex was still on edge about that room.
    const fresh = barking && (!wasBarking || room.id === mistakeStarts);
    if (fresh) {
      const truth = busy.has(room.id);
      s.stats.barks++;
      if (!truth) s.stats.wrongBarks++;
      // Each bark is one decision for the player: patrol there soon (follow) or not (ignore).
      s.rex.pending = s.rex.pending.filter((p) => p.room !== room.id);
      s.rex.pending.push({ room: room.id, truth, untilMs: s.timeMs + w.ms.followWindow });
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

/** Trust analysis: a bark nobody patrolled within the window counts as ignored. */
function expireBarks(s: GameState): void {
  for (const p of s.rex.pending) {
    if (s.timeMs < p.untilMs) continue;
    s.stats.rexIgnored++;
    if (p.truth) s.stats.rexIgnoredRight++;
  }
  s.rex.pending = s.rex.pending.filter((p) => s.timeMs < p.untilMs);
}

/** The gang is stopped when every group is trapped behind locked doors. Escaping (master keys) undoes it. */
function updateContainment(s: GameState): void {
  if (!s.brokenIn || s.groups.length === 0) return;
  const trapped = s.groups.every((g) => s.rooms[g.room].locked);
  if (!trapped) s.stats.containedMs = null;
  else if (s.stats.containedMs === null) s.stats.containedMs = s.timeMs;
}

// ---------- Catch the intruders (Evict) ----------

function arriveToEvict(s: GameState, w: World, guard: Guard, task: Task): void {
  const room = w.room.get(task.room)!;
  const inside = s.groups.filter((g) => g.room === task.room);
  if (inside.length === 0) {
    guard.task = null;
    s.done.push({ guard: guard.id, action: 'evict', room: task.room, atMs: s.timeMs, hit: false });
    say(s, guard, evictEmptyLine(guard.id, s.nextLogId, theRoom(room.name)), task.room, `Nothing to eradicate in ${room.real}.`);
    return;
  }
  startCatch(s, w, guard, task.room, inside.length);
}

function startCatch(s: GameState, w: World, guard: Guard, roomId: RoomId, groups: number): void {
  const room = w.room.get(roomId)!;
  const intruders = Math.min(5, 2 + groups);
  const total = Math.min(9, intruders + w.sc.actions.catchInnocents);
  // Shuffle who stands where on a 3×3 grid, with a little jitter, so nothing gives the gang away.
  const kinds: CatchFigure['kind'][] = Array.from({ length: total }, (_, i) => (i < intruders ? 'intruder' : 'innocent'));
  const cells = Array.from({ length: 9 }, (_, i) => i);
  const shuffle = <T>(a: T[]) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand(s) * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
  };
  shuffle(kinds);
  shuffle(cells);
  let intruderLook = 0;
  let innocentLook = 0;
  const round = (v: number) => Math.round(v * 1000) / 1000;
  const figures: CatchFigure[] = kinds.map((kind, i) => ({
    id: i + 1,
    kind,
    look: kind === 'intruder' ? intruderLook++ : innocentLook++,
    x: round(0.17 + (cells[i] % 3) * 0.33 + (rand(s) - 0.5) * 0.12),
    y: round(0.24 + Math.floor(cells[i] / 3) * 0.27 + (rand(s) - 0.5) * 0.08),
    caught: false,
    oopsAtMs: null,
  }));
  s.catch = {
    id: s.nextCatchId++,
    room: roomId,
    guard: guard.id,
    startedMs: s.timeMs,
    endsMs: s.timeMs + w.ms.catch,
    figures,
    wrong: 0,
    result: null,
    to: null,
    resultAtMs: null,
  };
  s.rooms[roomId].litBy = guard.id; // the guard's lantern lights the scene
  say(s, guard, `Lanterns up in ${theRoom(room.name)}! Where are they hiding?`, roomId, `Hunting malicious processes on ${room.real}.`);
}

function clickCatch(state: GameState, figureId: number): ApplyResult {
  const c = state.catch;
  if (state.phase === 'paused') return { state, error: 'Paused. Press Space to continue.' };
  if (state.phase !== 'running' || !c || c.result !== null) return { state, error: 'No catch in progress.' };
  const f = c.figures.find((x) => x.id === figureId);
  if (!f || f.caught) return { state };
  const s = clone(state);
  const w = world(s.scenarioId);
  const cc = s.catch!;
  const ff = cc.figures.find((x) => x.id === figureId)!;
  if (ff.kind === 'intruder') {
    ff.caught = true;
    if (cc.figures.every((x) => x.kind !== 'intruder' || x.caught)) resolveCatch(s, w, true);
  } else {
    // An innocent visitor: "Hey!" and precious seconds lost.
    ff.oopsAtMs = s.timeMs;
    cc.wrong++;
    cc.endsMs = Math.max(s.timeMs, cc.endsMs - w.ms.catchPenalty);
  }
  return { state: s };
}

function updateCatch(s: GameState, w: World): void {
  const c = s.catch;
  if (!c) return;
  if (c.result === null && s.timeMs >= c.endsMs) resolveCatch(s, w, false);
  else if (c.result !== null && s.timeMs >= (c.resultAtMs ?? 0) + CATCH_RESULT_MS) s.catch = null;
}

function resolveCatch(s: GameState, w: World, won: boolean): void {
  const c = s.catch!;
  const guard = s.guards.find((g) => g.id === c.guard)!;
  const room = w.room.get(c.room)!;
  const name = theRoom(room.name);
  const rs = s.rooms[c.room];
  const inside = s.groups.filter((g) => g.room === c.room);
  c.resultAtMs = s.timeMs;
  guard.task = null;
  if (rs.litBy === guard.id) rs.litBy = null;
  s.done.push({ guard: guard.id, action: 'evict', room: c.room, atMs: s.timeMs, hit: won });

  if (won) {
    c.result = 'caught';
    s.groups = s.groups.filter((g) => g.room !== c.room);
    s.stats.evicted += inside.length;
    fx(s, 'evicted', c.room);
    say(s, guard, evictedLine(guard.id, s.nextLogId, name), c.room, `Ransomware eradicated from ${room.real}.`);
    if (s.groups.length === 0) end(s, 'won', 'Every intruder has been shown the door.', 'All malware eradicated. Incident contained.');
    return;
  }
  if (rs.locked) {
    // The lock holds: they are still in there, hiding. Try again.
    c.result = 'held';
    say(s, guard, `They're hiding behind the exhibits in ${name}. Again, chief?`, c.room, `Eradication incomplete: malicious processes still running on ${room.real}. Retry.`);
    return;
  }
  // The doors were open: they slip away into a neighbouring room (never into a locked one).
  let to: RoomId | null = null;
  for (const g of inside) {
    const dest = pickDestination(s, w, g, true);
    if (dest) {
      moveGroup(s, g, dest);
      to ??= dest;
    }
  }
  c.result = to ? 'escaped' : 'held';
  c.to = to;
  if (to) {
    const where = w.room.get(to)!;
    say(s, guard, `They slipped past me into ${theRoom(where.name)}!`, c.room, `Eradication failed: ransomware moved to ${where.real}.`);
  } else {
    say(s, guard, `They're hiding behind the exhibits in ${name}. Again, chief?`, c.room, `Eradication incomplete: malicious processes still running on ${room.real}. Retry.`);
  }
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
      if (task.action === 'evict') {
        arriveToEvict(s, w, guard, task);
        continue;
      }
    }
    if (task.action === 'evict') continue; // the catch frees the guard
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
    if (s.stats.firstSpottedMs === null) s.stats.firstSpottedMs = s.timeMs;
    fx(s, 'spotted', g.room);
    const guard = s.guards.find((x) => x.id === guardId)!;
    if (guard.task && !guard.task.found) {
      guard.task.found = true;
      say(s, guard, foundLine(guard.id, s.stats.spotted, theRoom(w.room.get(g.room)!.name)), g.room, `EDR detection: ransomware active in ${w.room.get(g.room)!.real}.`);
    }
  }
}

/** A guard on the radio. `real` is the same message in SOC terms, for the reality view. */
function say(s: GameState, guard: Guard, text: string, room: RoomId | null, real: string | null = null): void {
  log(s, { kind: 'radio', speaker: guard.name, text, room, real });
}

/** SOC wording for what each action does, used in the reality view. */
export const ACTION_REAL: Record<ActionKind, string> = {
  patrol: 'EDR scan',
  lock: 'Isolate',
  evict: 'Eradicate',
  repair: 'Restore from backup',
  candlelight: 'Downtime procedures',
  unlock: 'Reconnect',
};

function complete(s: GameState, w: World, guard: Guard, task: Task): void {
  const room = w.room.get(task.room)!;
  const rs = s.rooms[task.room];
  const name = theRoom(room.name);
  const inside = s.groups.filter((g) => g.room === task.room);
  /** Varies the wording from line to line, without touching the RNG. */
  const n = s.nextLogId;
  const hit =
    task.action === 'patrol'
      ? task.found
      : task.action === 'evict'
        ? rs.locked && inside.length > 0
        : task.action === 'repair'
          ? inside.length === 0 && !(rs.dark && s.backupsLost)
          : true;
  s.done.push({ guard: guard.id, action: task.action, room: task.room, atMs: s.timeMs, hit });

  switch (task.action) {
    case 'patrol':
      if (rs.litBy === guard.id) rs.litBy = null;
      s.stats.patrols++;
      if (!task.found) say(s, guard, emptyLine(guard.id, s.stats.patrols, name), task.room, `EDR scan clean: ${room.real}.`);
      break;

    case 'lock':
      if (!rs.locked) {
        rs.locked = true;
        s.stats.locks++;
        fx(s, 'locked', task.room);
      }
      say(s, guard, lockedLine(guard.id, n, name), task.room, `${room.real} isolated from the network.`);
      break;

    case 'evict':
      break; // handled by the catch (see resolveCatch)

    case 'repair':
      if (inside.length > 0) {
        say(s, guard, `Someone's still in ${name}! Clear them out first.`, task.room, `Cannot restore: ransomware still active in ${room.real}.`);
        break;
      }
      if (rs.dark && s.backupsLost) {
        say(s, guard, `The Archive is wrecked, chief. Can't fix ${name}.`, task.room, `Cannot restore ${room.real}: backups destroyed.`);
        break;
      }
      rs.dark = false;
      rs.locked = false;
      rs.occupiedMs = 0;
      s.stats.repairs++;
      fx(s, 'repaired', task.room);
      say(s, guard, repairedLine(guard.id, n, name), task.room, `${room.real} restored from backup and back online.`);
      break;

    case 'unlock':
      rs.locked = false;
      say(s, guard, `Padlock off. ${upper(name)} is open again.`, task.room, `${room.real} reconnected to the network.`);
      break;

    case 'candlelight':
      s.candlelight[room.wing] = true;
      say(s, guard, candlesLine(guard.id, n, `the ${WING_NAMES[room.wing].name}`), task.room, `Downtime procedures active: ${WING_NAMES[room.wing].real} on paper.`);
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
  s.stats.careMs += s.care * STEP_MS;
}

function end(s: GameState, result: Outcome['result'], reason: string, real: string): void {
  if (s.phase === 'ended') return;
  s.phase = 'ended';
  s.rex.pending = []; // barks still inside their window were never decided
  s.catch = null;
  if (s.groups.length === 0 && s.stats.containedMs === null) s.stats.containedMs = s.timeMs;
  s.outcome = { result, reason, real, atMs: s.timeMs, summary: summarise(s, result) };
  for (const rs of Object.values(s.rooms)) rs.litBy = null;
  log(s, { kind: 'event', text: reason, real });
}

function summarise(s: GameState, result: Outcome['result']): NightSummary {
  const night = world(s.scenarioId).ms.night;
  // An early win keeps the current care until dawn; a major incident means none until dawn.
  const rest = Math.max(0, night - s.timeMs) * (result === 'won' ? s.care : 0);
  const { brokenInMs, firstSpottedMs, containedMs } = s.stats;
  return {
    careContinuity: Math.round((s.stats.careMs + rest) / night),
    mttdMs: brokenInMs !== null && firstSpottedMs !== null ? firstSpottedMs - brokenInMs : null,
    mttrMs: firstSpottedMs !== null && containedMs !== null ? Math.max(0, containedMs - firstSpottedMs) : null,
  };
}

// ---------- Intents ----------

export const INTENT_TYPES = ['start', 'skipIntro', 'togglePause', 'reset', 'toggleReality', 'toggleDebug', 'toggleCode', 'action', 'catch'] as const;
export type IntentType = (typeof INTENT_TYPES)[number];

export type Intent =
  | { type: Exclude<IntentType, 'action' | 'catch'> }
  | { type: 'action'; action: ActionKind; room: RoomId; guard?: string }
  /** A click on someone in the "Catch the intruders" scene. */
  | { type: 'catch'; figure: number };

/** Only the presenter page can start (or skip the intro), reset or hand over control. */
export const PRESENTER_ONLY: readonly IntentType[] = ['start', 'skipIntro', 'reset', 'toggleCode'];

export function isIntent(value: unknown): value is Intent {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (!INTENT_TYPES.includes(v.type as IntentType)) return false;
  if (v.type === 'catch') return typeof v.figure === 'number' && Number.isInteger(v.figure);
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
    case 'catch':
      return clickCatch(state, intent.figure);
    case 'start':
      if (state.phase === 'running') return { state, error: 'Already running.' };
      if (state.phase === 'intro') return { state, error: 'The shift is starting. Press Enter to skip.' };
      if (state.phase === 'ended') return { state, error: 'The night is over. Press R to reset.' };
      if (state.phase === 'paused') return { state: { ...state, phase: 'running' } };
      return { state: { ...state, phase: 'intro', introMs: 0 } };
    case 'skipIntro': {
      if (state.phase !== 'intro') return { state, error: 'No intro playing.' };
      const s = clone(state);
      const w = world(s.scenarioId);
      radioCheck(s, w, s.introMs, w.ms.intro); // the radio check still happens, just all at once
      s.introMs = w.ms.intro;
      s.phase = 'running';
      return { state: s };
    }
    case 'togglePause':
      if (state.phase === 'idle') return { state, error: 'Not started yet. Press S.' };
      if (state.phase === 'intro') return { state, error: 'The shift is starting. Press Enter to skip.' };
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
  unlock: (w) => w.sc.actions.lockSec,
  evict: () => 0, // the catch decides when it ends
  repair: (w) => w.sc.actions.repairSec,
  candlelight: (w) => w.sc.actions.candlelightSec,
};

function dispatch(state: GameState, intent: Extract<Intent, { type: 'action' }>): ApplyResult {
  const fail = (error: string): ApplyResult => ({ state, error });
  const w = world(state.scenarioId);
  const room = w.room.get(intent.room);
  if (!room) return fail('Unknown room.');
  if (state.phase === 'idle') return fail('The night has not started yet.');
  if (state.phase === 'intro') return fail('The shift is starting. Press Enter to skip.');
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
      if (padlocks(state).free === 0) return fail(`All ${w.sc.actions.maxLocks} padlocks are in use. Unlock or repair a room to free one.`);
      break;
    }
    case 'unlock': {
      if (!rs.locked) return fail(`${upper(name)} is not locked.`);
      const other = busyWith('unlock', (t) => t.room === room.id);
      if (other) return fail(`${other.name} is already unlocking ${name}.`);
      break;
    }
    case 'evict': {
      // Works in any room. Locked first is the safe way: if the catch fails, they cannot slip away.
      const other = busyWith('evict', () => true);
      if (other) return fail(`${other.name} is already chasing intruders. One catch at a time!`);
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

  // Trust analysis: a patrol sent to a room Rex barked at, within the window, follows him (once per bark).
  if (intent.action === 'patrol') {
    const bark = s.rex.pending.find((p) => p.room === room.id);
    if (bark) {
      s.rex.pending = s.rex.pending.filter((p) => p !== bark);
      s.stats.rexFollowed++;
      if (!bark.truth) s.stats.rexFollowedWrong++;
    }
  }

  const target = intent.action === 'candlelight' ? `the ${WING_NAMES[room.wing].name}` : name;
  const realTarget = intent.action === 'candlelight' ? WING_NAMES[room.wing].real : room.real;
  log(s, {
    kind: 'radio',
    speaker: 'You',
    text: dispatchLine(g.name, intent.action, target, s.stats.dispatches - 1),
    real: `${g.name}: ${ACTION_REAL[intent.action]}, ${realTarget}.`,
    room: room.id,
  });
  say(s, g, replyLine(g.id, s.stats.dispatches - 1), room.id, 'Acknowledged.');
  return { state: s };
}

function upper(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * The padlocks on the desk: at most `maxLocks` rooms locked at once. A lock on its way counts as used;
 * an unlock or a repair gives its padlock back once it is done.
 */
export function padlocks(state: GameState): { max: number; used: number; free: number } {
  const max = world(state.scenarioId).sc.actions.maxLocks;
  const locked = Object.values(state.rooms).filter((r) => r.locked).length;
  const coming = state.guards.filter((g) => g.task?.action === 'lock' && !state.rooms[g.task.room].locked).length;
  const used = Math.min(max, locked + coming);
  return { max, used, free: max - used };
}

// ---------- Snapshot helpers ----------

/** How many log entries clients receive. The full log stays on the server for the morning report. */
export const LOG_TAIL = 30;

export type PublicState = GameState;

export function publicState(state: GameState): PublicState {
  return state.log.length <= LOG_TAIL ? state : { ...state, log: state.log.slice(-LOG_TAIL) };
}
