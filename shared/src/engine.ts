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
/** "Phew! That was close!": how long the slow motion lasts (real ms) and how fast the night runs meanwhile. */
export const SLOWMO_MS = 2500;
export const SLOWMO_RATE = 0.3;

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
  /** The staff already complained about this closure (reset when the room opens again). */
  complained: boolean;
  /** How long it has been dark without a break (a dark room costs more care the longer it stays dark). */
  darkMs: number;
}

export interface Group {
  id: number;
  room: RoomId;
  enteredMs: number;
  /** Seen by a patrol: flees at the next spread tick unless the room is locked. */
  spotted: boolean;
  visited: RoomId[];
  /**
   * Let in by a phishing letter ('phish'), or a later wave ('wave'): each decides with its own random stream,
   * so the original gang's route never changes.
   */
  stream?: GroupStream;
}

export type GroupStream = 'phish' | 'wave';

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
  /** Evict and repair: the mini game has begun (a guard who arrives while another one runs waits). */
  started?: boolean;
  /** Lock: the gang was in the room when the lock was sent (if they are gone when it lands: too late). */
  hadGang?: boolean;
}

/**
 * An idle guard strolling around their own wing: a pause (looking around, a yawn, Tom's biscuit), then a
 * slow walk to a neighbouring room. Purely for life on screen: it lights nothing and finds nobody.
 */
export interface Wander {
  phase: 'pause' | 'walk';
  /** Walking from `from` to `to` (guard.room stays `from` until they get there). */
  from: RoomId;
  to: RoomId;
  startMs: number;
  untilMs: number;
  act: 'look' | 'yawn' | 'biscuit' | null;
}

export interface Guard {
  id: string;
  name: string;
  /** Room the guard is in right now (changes while walking). */
  room: RoomId;
  task: Task | null;
  /** Strolling while idle (null while on a task). */
  wander: Wander | null;
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
  kind: 'spotted' | 'evicted' | 'repaired' | 'vandalised' | 'locked' | 'arrived' | 'late' | 'phew';
  room: RoomId;
  atMs: number;
}

/** How many recent effects are kept. */
const FX_KEEP = 12;

/** End-of-night numbers, fixed the moment the night ends. All times are game-clock ms since 00:00. */
export interface NightSummary {
  /** Care continuity: the care score averaged over the whole night, 0–100. After a lost night the hours left until dawn count as 0. */
  careContinuity: number;
  /** Mean time to detect: for each group that was spotted, from when it appeared to its first sighting; the average. Null if none was. */
  mttdMs: number | null;
  /** Mean time to respond: for each group that was stopped (trapped in a locked room or thrown out), from its first sighting to that moment; the average. Null if none was. */
  mttrMs: number | null;
  /** How many groups the gang had over the night, and how many of them were spotted and stopped. */
  groups: number;
  spotted: number;
  stopped: number;
  /** What moved the care score, biggest first: the "Why?" on the result card and in the morning report. */
  factors: CareFactor[];
}

/**
 * One thing that moved the night's care score. `points`: its effect on the night's average, in points
 * (negative: it cost care; positive: it saved care). The losses add up to 100 minus the score.
 */
export interface CareFactor {
  key: string;
  kind: 'locked' | 'dark' | 'attack' | 'phish' | 'vault' | 'repair' | 'candle';
  /** A room id, a wing, or null. */
  target: string | null;
  points: number;
  /** How long (locked or dark), in game-clock real ms. */
  ms: number;
  /** How many (bad phishing calls, repairs). */
  count: number;
  /** When (the vault). */
  atMs: number | null;
}

/** Care bookkeeping per factor: lost and saved care, in points × ms. */
export interface CareEntry {
  lost: number;
  saved: number;
  ms: number;
  count: number;
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
  /** Where the player's flashlight points (scene units, 1600×900), so every screen sees the same light. */
  aim: { x: number; y: number } | null;
  /** caught: all thrown out. held: time ran out, but the room is locked and they are still inside. escaped: they fled to `to`. */
  result: 'caught' | 'held' | 'escaped' | null;
  to: RoomId | null;
  resultAtMs: number | null;
}

/** How long the result of a mini game stays on screen. */
export const CATCH_RESULT_MS = 1800;

/** The cable colours of "Reconnect the exhibit", in order. */
export const WIRE_COUNT = 4;

/**
 * Repair as a mini game: cable ends on the left and right in mixed order; join each left end to the
 * right end of the same colour. `left`/`right`: the colour at each position, top to bottom.
 */
export interface Wires {
  id: number;
  room: RoomId;
  guard: string;
  startedMs: number;
  endsMs: number;
  left: number[];
  right: number[];
  /** Colours joined so far. */
  connected: number[];
  /** A wrong join sparks (no time lost). */
  sparkAtMs: number | null;
  result: 'fixed' | 'failed' | null;
  resultAtMs: number | null;
}

/** "Safe or phishing?": a letter in the Mail Room; answer before the time runs out. */
export interface LetterGame {
  id: number;
  /** Which letter of the scenario. */
  index: number;
  phishing: boolean;
  startedMs: number;
  endsMs: number;
  answer: 'safe' | 'phishing' | null;
  /** right: well spotted. wrong: a bad call. missed: no answer in time. */
  result: 'right' | 'wrong' | 'missed' | null;
  /** A bad call or no answer: where a new group got in (null if the doors held). */
  breach: RoomId | null;
  resultAtMs: number | null;
}

/** "Change the locks": the gang took the master keys; type the code in time to take the advantage away. */
export interface KeysGame {
  id: number;
  /** Shown as "OWL-7"; typed as OWL7. */
  code: string;
  /** How many characters are typed correctly so far. */
  typed: number;
  /** On-screen tiles for touch screens: the code's characters and a few others, mixed. */
  tiles: string[];
  startedMs: number;
  endsMs: number;
  wrongAtMs: number | null;
  result: 'changed' | 'kept' | null;
  resultAtMs: number | null;
}

/** One group of the gang over the night, for MTTD and MTTR. Times in game-clock ms. */
export interface GroupRecord {
  id: number;
  appearedMs: number;
  spottedMs: number | null;
  /** Trapped in a locked room, or thrown out. */
  stoppedMs: number | null;
}

export interface DoneAction {
  guard: string;
  action: ActionKind;
  room: RoomId;
  atMs: number;
  hit: boolean;
  /** Lock only: nobody was inside, then or when it was sent (its exhibits closed for nothing). */
  empty?: boolean;
}

/** Every order the player gave (when it was sent), for the morning report's lessons. */
export interface Order {
  action: ActionKind;
  room: RoomId;
  atMs: number;
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
  /** A separate random stream for the guards' idle strolls, so they never change the gang's route. */
  wanderRng: number;
  /** And one for the groups that phishing lets in. */
  phishRng: number;
  /** And one for the later waves. */
  waveRng: number;
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
     * Barks waiting for the player's decision: a patrol, lock or evict there before `untilMs` follows Rex,
     * otherwise the bark counts as ignored. `truth`: the gang really was there when he barked.
     */
    pending: { room: RoomId; truth: boolean; untilMs: number }[];
    /** Why Rex barked the last time: the clues he went on, in both voices. */
    why: { room: RoomId; atMs: number; confidence: number; text: string; real: string } | null;
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
    /** The master keys were stolen tonight, and whether the locks were changed in time. */
    keysStolen: boolean;
    keysChanged: boolean;
    /** Phishing letters: called right, called wrong, left unanswered. */
    letters: { right: number; wrong: number; missed: number };
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
  /** Every group of the gang, when it appeared, was first spotted and was stopped. */
  groupLog: GroupRecord[];
  /** The "Catch the intruders" mini game in progress (or just finished, while its result shows). */
  catch: Catch | null;
  /** "Reconnect the exhibit" (repair) in progress or just finished. */
  wires: Wires | null;
  /** "Change the locks" in progress or just finished. */
  keys: KeysGame | null;
  /** The Key Room fell while another mini game was on: change the locks as soon as it ends. */
  keysPending: boolean;
  /** "Safe or phishing?" in progress or just finished. */
  letter: LetterGame | null;
  /** Letters that have arrived and wait their turn (scenario indexes). */
  lettersDue: number[];
  nextCatchId: number;
  /** Every order given tonight, in order. */
  orders: Order[];
  /** The last-30-seconds dash for the Vault has been announced. */
  finaleStarted: boolean;
  /** Slow motion left after a close call (real ms; see SLOWMO_MS). */
  slowMs: number;
  /** Waves that have arrived but found their doors locked: they wait outside (scenario indexes). */
  wavesDue: number[];
  /** When each bad phishing call happened (its care drop fades from there). */
  phishHits: number[];
  /** What moved the care score, per factor (see careFactors). */
  careBook: Record<string, CareEntry>;
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
    wanderRng: (sc.seed * 7919 + 13) >>> 0,
    phishRng: (sc.seed * 104729 + 7) >>> 0,
    waveRng: (sc.seed * 15485863 + 11) >>> 0,
    reality: false,
    debug: false,
    rooms: perRoom(() => ({ locked: false, dark: false, occupiedMs: 0, litBy: null, complained: false, darkMs: 0 })),
    groups: [],
    nextGroupId: 1,
    guards: sc.guards.map((g) => ({ id: g.id, name: g.name, room: g.startRoom, task: null, wander: null })),
    candlelight: Object.fromEntries(WINGS.map((wing) => [wing, false])) as Record<Wing, boolean>,
    brokenIn: false,
    entrySplit: false,
    nextSpreadMs: 0,
    masterKeys: false,
    backupsLost: false,
    care: 100,
    lowestCare: 100,
    impact: Object.fromEntries(IMPACT_TYPES.map((t) => [t, 0])) as Record<ImpactType, number>,
    rex: { estimates: perRoom(() => 0), mistake: null, mistakeDone: false, pending: [], why: null },
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
      keysStolen: false,
      keysChanged: false,
      letters: { right: 0, wrong: 0, missed: 0 },
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
    groupLog: [],
    catch: null,
    wires: null,
    keys: null,
    keysPending: false,
    letter: null,
    lettersDue: [],
    nextCatchId: 1,
    orders: [],
    finaleStarted: false,
    slowMs: 0,
    wavesDue: [],
    phishHits: [],
    careBook: {},
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
  let dt = Math.min(dtMs, MAX_CATCH_UP_MS);
  // A close call ("Phew!"): the night runs slower for a moment. The steps are the same, only later.
  if (s.slowMs > 0) {
    const slow = Math.min(dt, s.slowMs);
    s.slowMs -= slow;
    dt -= slow * (1 - SLOWMO_RATE);
  }
  s.accMs += dt;
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
  sc.phishing.letters.forEach((l, i) => {
    if (reached(clockToMs(l.at, hour))) s.lettersDue.push(i);
  });
  sc.waves.forEach((wave, i) => {
    if (reached(clockToMs(wave.at, hour))) s.wavesDue.push(i);
  });
  admitWaves(s, w);

  updateGuards(s, w);
  wander(s, w);
  complaints(s, w);
  updateCatch(s, w);
  updateWires(s, w);
  updateKeys(s, w);
  updateLetter(s, w);
  updateRooms(s, w);
  if (s.phase !== 'running') return;

  if (s.brokenIn && !s.finaleStarted && inFinale(s, w) && s.groups.some((g) => !s.rooms[g.room].locked && g.room !== w.vault)) {
    s.finaleStarted = true;
    log(s, { kind: 'event', text: 'The gang makes a last dash for the Vault!', real: 'Final push: the ransomware is racing for the patient records.' });
  }
  if (s.brokenIn && now >= s.nextSpreadMs) {
    spread(s, w);
    for (const room of sc.rooms) {
      const gang = s.groups.some((g) => g.room === room.id && !g.stream);
      const phished = !gang && s.groups.some((g) => g.room === room.id && g.stream === 'phish');
      const waved = !gang && !phished && s.groups.some((g) => g.room === room.id && g.stream === 'wave');
      if (gang && rand(s) < sc.clues.cctvChancePerTick) cctv(s, w, room.id, true);
      else if (phished && phishRand(s) < sc.clues.cctvChancePerTick) cctv(s, w, room.id, true);
      else if (waved && waveRand(s) < sc.clues.cctvChancePerTick) cctv(s, w, room.id, true);
    }
    updateRex(s, w);
    s.nextSpreadMs += s.masterKeys ? ms.masterKeysTick : ms.spreadTick;
  }

  revealLitRooms(s, w);
  expireBarks(s);
  updateContainment(s, w);
  updateCare(s, w);

  if (now >= ms.night) {
    end(s, 'won', 'Dawn breaks. The Vault is safe.', 'Incident window closed. Patient records protected.');
  }
}

// ---------- Intruders ----------

/** Waves that have arrived come in through their door, or the other one; both locked: they wait outside. */
function admitWaves(s: GameState, w: World): void {
  if (s.wavesDue.length === 0) return;
  const waiting: number[] = [];
  for (const i of s.wavesDue) {
    const wave = w.sc.waves[i];
    const entry = !s.rooms[wave.room].locked ? wave.room : !s.rooms[wave.alt].locked ? wave.alt : null;
    if (!entry) {
      waiting.push(i);
      continue;
    }
    addGroup(s, entry, [entry], 'wave');
    s.brokenIn = true;
    const guard = s.guards.find((g) => g.id === wave.guard) ?? s.guards[0];
    const room = w.room.get(entry)!;
    if (entry === wave.room) say(s, guard, wave.text, entry, wave.real);
    else say(s, guard, `Chief! More of them, coming in through ${theRoom(room.name)}!`, entry, `New intrusion via ${room.real}.`);
  }
  s.wavesDue = waiting;
}

function addGroup(s: GameState, room: RoomId, visited: RoomId[], stream?: GroupStream): void {
  const id = s.nextGroupId++;
  s.groups.push(stream ? { id, room, enteredMs: s.timeMs, spotted: false, visited, stream } : { id, room, enteredMs: s.timeMs, spotted: false, visited });
  s.groupLog.push({ id, appearedMs: s.timeMs, spottedMs: null, stoppedMs: null });
}

/** The record of a group (made on the spot for groups placed by hand, as in tests). */
function recordOf(s: GameState, g: Group): GroupRecord {
  let r = s.groupLog.find((x) => x.id === g.id);
  if (!r) {
    r = { id: g.id, appearedMs: g.enteredMs, spottedMs: null, stoppedMs: null };
    s.groupLog.push(r);
  }
  return r;
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
    if (inFinale(s, w)) {
      // The last seconds of the night: every free group heads straight for the Vault. Locks still hold.
      const dest = dashDestination(s, w, g);
      if (dest) moveGroup(s, g, dest);
      continue;
    }
    if (s.timeMs - g.enteredMs < w.ms.minStay) continue;
    const r = () => groupRand(s, g);
    if (r() >= intruders.moveChance) continue;
    const dest = pickDestination(s, w, g, false);
    if (!dest) continue;
    const kin = s.groups.filter((x) => x.stream === g.stream).length;
    if (kin < intruders.maxGroups && r() < intruders.splitChance) {
      // Split: part of the gang moves on, the rest stays behind and keeps the room dark.
      addGroup(s, dest, [...g.visited, dest], g.stream);
      g.enteredMs = s.timeMs;
    } else {
      moveGroup(s, g, dest);
    }
  }
}

/** The last `finaleSec` seconds of the night. */
function inFinale(s: GameState, w: World): boolean {
  return s.timeMs >= w.ms.night - w.ms.finale;
}

/** The final dash: the open door that leads closest to the Vault (no randomness). */
function dashDestination(s: GameState, w: World, g: Group): RoomId | null {
  if (s.rooms[g.room].locked) return null;
  const here = w.distToVault.get(g.room)!;
  const options = w.neighbours
    .get(g.room)!
    .filter((n) => !s.rooms[n].locked && w.distToVault.get(n)! < here)
    .sort((a, b) => w.room.get(b)!.lure - w.room.get(a)!.lure);
  return options[0] ?? null;
}

/**
 * For the screens: the gang is making its last dash (the last 30 s of the night, with a group still free).
 * The screens blush red and the presenter's heartbeat speeds up.
 */
export function finaleActive(state: GameState): boolean {
  const w = world(state.scenarioId);
  if (state.phase !== 'running' && state.phase !== 'paused') return false;
  return state.brokenIn && inFinale(state, w) && state.groups.some((g) => !state.rooms[g.room].locked);
}

/** A group is stopped (shut in, or thrown out). One room from the Vault, that was close: "Phew!" */
function markStopped(s: GameState, w: World, g: Group, celebrate = true): void {
  const record = recordOf(s, g);
  if (record.stoppedMs !== null) return;
  record.stoppedMs = s.timeMs;
  if (celebrate && s.phase === 'running' && w.distToVault.get(g.room) === 1 && s.slowMs <= 0) {
    s.slowMs = SLOWMO_MS;
    fx(s, 'phew', g.room);
    log(s, { kind: 'event', room: g.room, text: 'Phew! That was close!', real: 'Close call: contained one hop from the patient records.' });
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

  let r = groupRand(s, g) * options.reduce((sum, o) => sum + o.weight, 0);
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
      s.impact.ambulances = Math.max(s.impact.ambulances, Math.floor(s.impact.ambulances) + w.sc.majorIncidentAmbulances);
      s.care = 0; // the crown jewel is gone: care drops to nothing (and stays there until dawn, see summarise)
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
  if (room.special === 'masterKeys' && !s.masterKeys && !s.stats.keysStolen) {
    s.masterKeys = true;
    s.stats.keysStolen = true;
    s.keysPending = true; // "Change the locks!" as soon as no other mini game is on
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
  const barksBefore = s.stats.barks;
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
      // What fools him: a camera in that room glitches for no reason, just before he barks.
      cctv(s, w, room, false);
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
      const why = evidence(s, w, room.id);
      const confidence = next[room.id];
      const text = `WOOF! ${confidence}% sure about ${theRoom(room.name)}: ${why.game}.`;
      const real = `AI copilot: ${confidence}% confidence. Evidence: ${why.real}.`;
      s.rex.why = { room: room.id, atMs: s.timeMs, confidence, text, real };
      log(s, { kind: 'rex', speaker: 'Rex', room: room.id, text, real, truth });
    }
  }
  s.rex.estimates = next;
  // His very first bark of the night: someone tells the room who Rex is.
  if (barksBefore === 0 && s.stats.barks > 0) {
    const guard = s.guards.find((g) => g.id === 'sam') ?? s.guards[0];
    if (guard) say(s, guard, "Rex is our AI sniffer dog. He's usually right… usually.", null, 'Note: the AI copilot is usually right… usually. Analysts make the call.');
  }
}

/** How far back Rex looks for clues (game ms). */
const EVIDENCE_MS = 30_000;

/** The clues Rex goes on for a room: recent staff reports and camera glitches there, in both voices. */
function evidence(s: GameState, w: World, roomId: RoomId): { game: string; real: string } {
  const room = w.room.get(roomId)!;
  const recent = s.log.filter((l) => l.room === roomId && s.timeMs - l.atMs <= EVIDENCE_MS);
  const report = [...recent].reverse().find((l) => l.kind === 'staff' && l.truth === true);
  const camera = [...recent].reverse().find((l) => l.kind === 'cctv');
  const game: string[] = [];
  const real: string[] = [];
  if (report) {
    game.push(`${report.speaker} reported "${report.text.replace(/[.!]$/, '')}"`);
    real.push('staff report');
  }
  if (camera) {
    const ago = Math.round((s.timeMs - camera.atMs) / 1000);
    game.push(`the camera glitched there ${ago <= 1 ? 'just now' : `${ago} seconds ago`}`);
    real.push('EDR alert');
  }
  if (game.length === 0) return { game: "his nose says they're close", real: `anomalous network traffic in ${room.real}` };
  // "staff report + EDR alert in Network segment (east)": the place once, no brackets inside brackets
  return { game: game.join(', and '), real: `${real.join(' + ')} in ${room.real}` };
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
function updateContainment(s: GameState, w: World): void {
  for (const g of s.groups) if (s.rooms[g.room].locked) markStopped(s, w, g);
  if (!s.brokenIn || s.groups.length === 0) return;
  const trapped = s.groups.every((g) => s.rooms[g.room].locked);
  if (!trapped) s.stats.containedMs = null;
  else if (s.stats.containedMs === null) s.stats.containedMs = s.timeMs;
}

// ---------- Catch the intruders (Evict) ----------

function arriveToEvict(s: GameState, w: World, guard: Guard, task: Task): void {
  // (only called when no other mini game is on: see updateGuards)
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
    aim: null,
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
    for (const g of inside) markStopped(s, w, g);
    s.groups = s.groups.filter((g) => g.room !== c.room);
    s.stats.evicted += inside.length;
    fx(s, 'evicted', c.room);
    say(s, guard, evictedLine(guard.id, s.nextLogId, name), c.room, `Ransomware eradicated from ${room.real}.`);
    // Catching everyone does not end the night: more can come before dawn.
    if (s.groups.length === 0) log(s, { kind: 'event', text: 'All clear… for now. Keep your eyes open until dawn.', real: 'No active threats. Monitoring continues until the incident window closes.' });
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

/** Critical departments complain on the radio the moment they close (locked or dark), once per closure. */
function complaints(s: GameState, w: World): void {
  for (const room of w.sc.rooms) {
    if (!room.complaint) continue;
    const rs = s.rooms[room.id];
    const closed = rs.locked || rs.dark;
    if (closed && !rs.complained) {
      rs.complained = true;
      log(s, { kind: 'staff', speaker: room.complaint.speaker, text: room.complaint.text, room: room.id });
    } else if (!closed) {
      rs.complained = false;
    }
  }
}

// ---------- Idle guards stroll around their wing ----------

/** mulberry32 on the strolls' own stream: the gang's RNG is never touched. */
function wanderRand(s: GameState): number {
  let t = (s.wanderRng = (s.wanderRng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function wander(s: GameState, w: World): void {
  for (const g of s.guards) {
    if (g.task) {
      g.wander = null;
      continue;
    }
    const wv = g.wander;
    if (wv && s.timeMs < wv.untilMs) continue;
    if (wv?.phase === 'walk') g.room = wv.to;
    const home = w.room.get(w.sc.guards.find((x) => x.id === g.id)!.startRoom)!.wing;
    const here = w.room.get(g.room)!;
    let next: RoomId | null = null;
    if (here.wing !== home) {
      // back towards their own wing after a job
      const homeRoom = w.sc.guards.find((x) => x.id === g.id)!.startRoom;
      next = shortestPath(w, g.room, homeRoom)[1] ?? null;
    } else if (wv?.phase === 'pause' && wanderRand(s) < 0.6) {
      const options = w.neighbours.get(g.room)!.filter((n) => w.room.get(n)!.wing === home && n !== w.vault);
      if (options.length) next = options[Math.floor(wanderRand(s) * options.length)];
    }
    if (next) {
      // a slow stroll: about twice a guard's walking time
      g.wander = { phase: 'walk', from: g.room, to: next, startMs: s.timeMs, untilMs: s.timeMs + w.ms.walkPerRoom * 2.2, act: null };
    } else {
      const r = wanderRand(s);
      const act: Wander['act'] = g.id === 'tom' && r < 0.35 ? 'biscuit' : r < 0.75 ? 'look' : 'yawn';
      g.wander = { phase: 'pause', from: g.room, to: g.room, startMs: s.timeMs, untilMs: s.timeMs + 1500 + Math.round(wanderRand(s) * 2500), act };
    }
  }
}

/** The random stream a group decides with: the gang's own, or the phishing groups'. */
function groupRand(s: GameState, g: Group): number {
  return g.stream === 'phish' ? phishRand(s) : g.stream === 'wave' ? waveRand(s) : rand(s);
}

function waveRand(s: GameState): number {
  let t = (s.waveRng = (s.waveRng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function phishRand(s: GameState): number {
  let t = (s.phishRng = (s.phishRng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ---------- Safe or phishing? (letters in the Mail Room) ----------

function updateLetter(s: GameState, w: World): void {
  const l = s.letter;
  if (l) {
    if (l.result === null && s.timeMs >= l.endsMs) resolveLetter(s, w, null);
    else if (l.result !== null && s.timeMs >= (l.resultAtMs ?? 0) + CATCH_RESULT_MS) s.letter = null;
  }
  if (s.lettersDue.length > 0 && !miniGameBusy(s) && s.phase === 'running') {
    const index = s.lettersDue.shift()!;
    const letter = w.sc.phishing.letters[index];
    s.letter = {
      id: s.nextCatchId++,
      index,
      phishing: letter.phishing,
      startedMs: s.timeMs,
      endsMs: s.timeMs + w.ms.letter,
      answer: null,
      result: null,
      breach: null,
      resultAtMs: null,
    };
    log(s, { kind: 'staff', speaker: w.sc.phishing.asker, text: 'Chief, is this letter safe to open?', real: 'Chief, is this email safe to open?', room: w.sc.intruders.entryRoom });
  }
}

function answerLetter(state: GameState, answer: 'safe' | 'phishing'): ApplyResult {
  const l = state.letter;
  if (state.phase === 'paused') return { state, error: 'Paused. Press Space to continue.' };
  if (state.phase !== 'running' || !l || l.result !== null) return { state, error: 'No letter to check.' };
  const s = clone(state);
  resolveLetter(s, world(s.scenarioId), answer);
  return { state: s };
}

function resolveLetter(s: GameState, w: World, answer: 'safe' | 'phishing' | null): void {
  const l = s.letter!;
  const letter = w.sc.phishing.letters[l.index];
  l.answer = answer;
  l.resultAtMs = s.timeMs;
  const right = answer !== null && (answer === 'phishing') === l.phishing;
  l.result = answer === null ? 'missed' : right ? 'right' : 'wrong';
  s.stats.letters[l.result]++;
  if (right) {
    log(s, l.phishing
      ? { kind: 'event', text: 'Good catch! The fake letter goes straight in the bin.', real: `Phishing email from ${letter.address} reported and quarantined.` }
      : { kind: 'event', text: `A real letter from ${letter.from}. Safe to open.`, real: `Legitimate email from ${letter.address} released.` });
    return;
  }
  // A bad call (or none) shows at once on the care score (an account is compromised), then fades a little.
  s.phishHits.push(s.timeMs);
  book(s, 'phish').count++;
  // ...and the letter lets the gang in, through any door that is not locked.
  const front = w.sc.intruders.frontDoor.room;
  const entry = !s.rooms[w.sc.intruders.entryRoom].locked ? w.sc.intruders.entryRoom : !s.rooms[front].locked ? front : null;
  l.breach = entry;
  const why =
    answer === null
      ? 'Nobody checked the post, and someone opened a bad letter.'
      : l.phishing
        ? 'That letter was a fake, and someone opened it!'
        : 'The real letter went in the bin, and the fake follow-up got opened instead.';
  if (entry) {
    addGroup(s, entry, [entry], 'phish');
    s.brokenIn = true;
    const room = w.room.get(entry)!;
    log(s, { kind: 'event', room: entry, text: `${why} A new intruder slipped in through ${theRoom(room.name)}.`, real: `Phishing payload executed: new ransomware foothold on ${room.real}.` });
  } else {
    log(s, { kind: 'event', text: `${why} But the locked doors kept them out.`, real: 'Phishing payload blocked: entry points isolated.' });
  }
}

// ---------- Mini games: one at a time ----------

/** A mini game is on (or its result is still showing). */
export function miniGameBusy(s: GameState): boolean {
  return s.catch !== null || s.wires !== null || s.keys !== null || s.letter !== null;
}

// ---------- Reconnect the exhibit (Repair) ----------

/** Fixed mixes for the cable ends: no randomness, so a repair never changes the seeded night. */
const WIRE_MIXES = [
  [2, 0, 3, 1],
  [1, 3, 0, 2],
  [3, 2, 1, 0],
  [0, 3, 1, 2],
  [1, 0, 3, 2],
  [3, 0, 2, 1],
];

function arriveToRepair(s: GameState, w: World, guard: Guard, task: Task): void {
  const room = w.room.get(task.room)!;
  const name = theRoom(room.name);
  const rs = s.rooms[task.room];
  const fail = (text: string, real: string) => {
    guard.task = null;
    s.done.push({ guard: guard.id, action: 'repair', room: task.room, atMs: s.timeMs, hit: false });
    say(s, guard, text, task.room, real);
  };
  if (s.groups.some((g) => g.room === task.room)) {
    return fail(`Someone's still in ${name}! Clear them out first.`, `Cannot restore: ransomware still active in ${room.real}.`);
  }
  if (rs.dark && s.backupsLost) {
    return fail(`The Archive is wrecked, chief. Can't fix ${name}.`, `Cannot restore ${room.real}: backups destroyed.`);
  }
  const id = s.nextCatchId++;
  const left = WIRE_MIXES[(id + 3) % WIRE_MIXES.length];
  const turn = 1 + (id % 3); // the right side is the left side turned, so no cable runs straight across
  s.wires = {
    id,
    room: task.room,
    guard: guard.id,
    startedMs: s.timeMs,
    endsMs: s.timeMs + w.ms.wires,
    left,
    right: left.map((_, i) => left[(i + turn) % left.length]),
    connected: [],
    sparkAtMs: null,
    result: null,
    resultAtMs: null,
  };
  s.rooms[task.room].litBy = guard.id;
  say(s, guard, `Toolbox open. Let's get ${name} running again.`, task.room, `Restoring ${room.real} from backup: reconnecting network links.`);
}

function joinWire(state: GameState, from: number, to: number): ApplyResult {
  const g = state.wires;
  if (state.phase === 'paused') return { state, error: 'Paused. Press Space to continue.' };
  if (state.phase !== 'running' || !g || g.result !== null) return { state, error: 'No repair in progress.' };
  if (from < 0 || from >= g.left.length || to < 0 || to >= g.right.length) return { state };
  const colour = g.left[from];
  if (g.connected.includes(colour)) return { state };
  const s = clone(state);
  const gg = s.wires!;
  if (gg.right[to] === colour) {
    gg.connected.push(colour);
    if (gg.connected.length === gg.left.length) resolveWires(s, world(s.scenarioId), true);
  } else {
    gg.sparkAtMs = s.timeMs; // wrong socket: a spark, no harm done
  }
  return { state: s };
}

function updateWires(s: GameState, w: World): void {
  const g = s.wires;
  if (!g) return;
  if (g.result === null && s.timeMs >= g.endsMs) resolveWires(s, w, false);
  else if (g.result !== null && s.timeMs >= (g.resultAtMs ?? 0) + CATCH_RESULT_MS) s.wires = null;
}

function resolveWires(s: GameState, w: World, ok: boolean): void {
  const g = s.wires!;
  const guard = s.guards.find((x) => x.id === g.guard)!;
  const room = w.room.get(g.room)!;
  const name = theRoom(room.name);
  const rs = s.rooms[g.room];
  g.result = ok ? 'fixed' : 'failed';
  g.resultAtMs = s.timeMs;
  guard.task = null;
  if (rs.litBy === guard.id) rs.litBy = null;
  s.done.push({ guard: guard.id, action: 'repair', room: g.room, atMs: s.timeMs, hit: ok });
  if (!ok) {
    say(s, guard, `Sparks everywhere! ${upper(name)} is still out. Again, chief?`, g.room, `Restore failed: network links not up on ${room.real}. Retry.`);
    return;
  }
  // What this repair saves: the room's current cost, for the rest of the night.
  const saved = roomLoss(s, w, g.room).loss * Math.max(0, w.ms.night - s.timeMs);
  const entry = book(s, `repair:${g.room}`);
  entry.saved += saved;
  entry.count++;
  rs.dark = false;
  rs.darkMs = 0;
  rs.locked = false;
  rs.occupiedMs = 0;
  s.stats.repairs++;
  fx(s, 'repaired', g.room);
  say(s, guard, repairedLine(guard.id, s.nextLogId, name), g.room, `${room.real} restored from backup and back online.`);
}

// ---------- Change the locks (the Key Room falls) ----------

const LOCK_WORDS = ['OWL', 'FOX', 'BAT', 'ELK', 'YAK', 'EMU', 'APE', 'HEN'];
const OTHER_KEYS = 'ABDGKMNPRSTUVZ23456789';

function startKeys(s: GameState, w: World): void {
  const id = s.nextCatchId++;
  // From the game's counters, not the random generator: the seeded night stays the same.
  const word = LOCK_WORDS[(id * 5 + Math.floor(s.timeMs / 1000)) % LOCK_WORDS.length];
  const digit = String((id * 7 + Math.floor(s.timeMs / 100)) % 10);
  const chars = [...word, digit];
  const extra = [...OTHER_KEYS].filter((c) => !chars.includes(c));
  const decoys = [0, 1, 2, 3].map((i) => extra[(id * 11 + i * 5) % extra.length]);
  const tiles = [...chars, ...decoys]
    .map((c, i) => ({ c, k: (i * 37 + id * 13) % 17 }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.c);
  s.keys = {
    id,
    code: `${word}-${digit}`,
    typed: 0,
    tiles,
    startedMs: s.timeMs,
    endsMs: s.timeMs + w.ms.keys,
    wrongAtMs: null,
    result: null,
    resultAtMs: null,
  };
  log(s, {
    kind: 'event',
    text: `Change the locks! Type ${word}-${digit} before they use the master keys.`,
    real: `Admin credentials stolen! Emergency reset: enter ${word}-${digit}.`,
  });
}

function typeCode(state: GameState, char: string): ApplyResult {
  const k = state.keys;
  if (state.phase === 'paused') return { state, error: 'Paused. Press Space to continue.' };
  if (state.phase !== 'running' || !k || k.result !== null) return { state, error: 'No code to type.' };
  const want = k.code.replace('-', '')[k.typed];
  const s = clone(state);
  const kk = s.keys!;
  if (char.toUpperCase() === want) {
    kk.typed++;
    if (kk.typed === kk.code.replace('-', '').length) resolveKeys(s, true);
  } else {
    kk.typed = 0; // start again
    kk.wrongAtMs = s.timeMs;
  }
  return { state: s };
}

function updateKeys(s: GameState, w: World): void {
  const k = s.keys;
  if (k) {
    if (k.result === null && s.timeMs >= k.endsMs) resolveKeys(s, false);
    else if (k.result !== null && s.timeMs >= (k.resultAtMs ?? 0) + CATCH_RESULT_MS) s.keys = null;
  }
  if (s.keysPending && !miniGameBusy(s) && s.phase === 'running') {
    s.keysPending = false;
    startKeys(s, w);
  }
}

function resolveKeys(s: GameState, ok: boolean): void {
  const k = s.keys!;
  k.result = ok ? 'changed' : 'kept';
  k.resultAtMs = s.timeMs;
  if (ok) {
    s.masterKeys = false;
    s.stats.keysChanged = true;
    log(s, { kind: 'event', text: 'New locks fitted. The master keys are useless now.', real: 'Admin passwords reset. Stolen credentials revoked.' });
  } else {
    log(s, { kind: 'event', text: 'Too slow. The gang keeps the master keys.', real: 'Reset missed: stolen admin credentials still valid.' });
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
      if (task.walkMs > 0) fx(s, 'arrived', task.room);
      if (task.action === 'patrol') s.rooms[task.room].litBy = guard.id;
    }
    if (task.action === 'evict' || task.action === 'repair') {
      // A mini game decides when these end. One at a time: a guard who arrives meanwhile waits in the room.
      if (task.arrived && !task.started && !miniGameBusy(s)) {
        task.started = true;
        if (task.action === 'evict') arriveToEvict(s, w, guard, task);
        else arriveToRepair(s, w, guard, task);
      }
      continue;
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
    if (s.stats.firstSpottedMs === null) s.stats.firstSpottedMs = s.timeMs;
    recordOf(s, g).spottedMs ??= s.timeMs;
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
  s.done.push({ guard: guard.id, action: task.action, room: task.room, atMs: s.timeMs, hit, ...(task.action === 'lock' ? { empty: inside.length === 0 && !task.hadGang } : {}) });

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
      if (task.hadGang && inside.length === 0) {
        // They were here when the lock was sent, and slipped out before it landed.
        fx(s, 'late', task.room);
        say(s, guard, "Too late, they've already moved on.", task.room, `Isolation too late: the ransomware had already moved on from ${room.real}.`);
      } else {
        say(s, guard, lockedLine(guard.id, n, name), task.room, `${room.real} isolated from the network.`);
      }
      break;

    case 'evict':
      break; // handled by the catch (see resolveCatch)

    case 'repair':
      break; // handled by the wires (see resolveWires)

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

function book(s: GameState, key: string): CareEntry {
  return (s.careBook[key] ??= { lost: 0, saved: 0, ms: 0, count: 0 });
}

/**
 * What a closed room costs the care score right now: its exhibits' criticality, more the longer it has been
 * dark, less with candlelight in its wing. `saved`: what the candles take off.
 */
function roomLoss(s: GameState, w: World, roomId: RoomId): { loss: number; saved: number } {
  const room = w.room.get(roomId)!;
  const rs = s.rooms[roomId];
  const rules = w.sc.care;
  const attacked = !rs.locked && !rs.dark && s.groups.some((g) => g.room === roomId);
  if (!rs.locked && !rs.dark && !attacked) return { loss: 0, saved: 0 };
  const base = room.exhibits.reduce((sum, ex) => sum + ex.criticality, 0) * (attacked ? rules.underAttack : 1);
  const longer = rs.dark ? 1 + Math.min(rules.darkMaxExtra, (rs.darkMs / w.ms.gameHour) * rules.darkGrowthPerGameHour) : 1;
  const candle = s.candlelight[room.wing] ? w.sc.actions.candlelightModifier : 1;
  return { loss: base * longer * candle, saved: base * longer * (1 - candle) };
}

/**
 * Care score = 100 − what every closed or dark room costs (dark rooms cost more the longer they stay dark,
 * candlelight takes some off) − the fading drop of bad phishing calls; clamped 0–100. Every step, the loss
 * is booked against what caused it, so the end of the night can say why the score is what it is.
 */
function updateCare(s: GameState, w: World): void {
  const { sc } = w;
  const rules = sc.care;
  const parts: { key: string; loss: number }[] = [];
  for (const room of sc.rooms) {
    const rs = s.rooms[room.id];
    rs.darkMs = rs.dark ? rs.darkMs + STEP_MS : 0;
    const { loss, saved } = roomLoss(s, w, room.id);
    if (loss === 0) continue;
    // Intruders loose in an open room: its services run degraded even before the exhibits go dark.
    parts.push({ key: `${rs.dark ? 'dark' : rs.locked ? 'locked' : 'attack'}:${room.id}`, loss });
    if (saved > 0) book(s, `candle:${room.wing}`).saved += saved * STEP_MS;
    if (!rs.locked && !rs.dark) continue; // patient impact counters: closed exhibits only
    const impactFactor = s.candlelight[room.wing] ? sc.actions.candlelightImpactModifier : 1;
    for (const ex of room.exhibits) {
      if (ex.impact) s.impact[ex.impact] += (sc.impactPerGameHour[ex.impact] * impactFactor * STEP_MS) / w.ms.gameHour;
    }
  }
  let phish = 0;
  for (const at of s.phishHits) {
    const fade = Math.max(0, 1 - (s.timeMs - at) / (rules.phishFadeGameHours * w.ms.gameHour));
    phish += rules.phishLasting + (rules.phishDrop - rules.phishLasting) * fade;
  }
  if (phish > 0) parts.push({ key: 'phish', loss: phish });

  const raw = parts.reduce((sum, p) => sum + p.loss, 0);
  const lost = Math.min(100, raw);
  const share = raw > 0 ? lost / raw : 0;
  for (const p of parts) {
    const entry = book(s, p.key);
    entry.lost += p.loss * share * STEP_MS;
    entry.ms += STEP_MS;
  }
  s.care = 100 - lost;
  s.lowestCare = Math.min(s.lowestCare, s.care);
  s.stats.careMs += s.care * STEP_MS;
}

/** What moved the care score so far, biggest first (points on the night's average; small ones left out). */
export function careFactors(state: GameState): CareFactor[] {
  const w = world(state.scenarioId);
  const night = w.ms.night;
  const out: CareFactor[] = [];
  for (const [key, e] of Object.entries(state.careBook)) {
    const [kind, target = null] = key.split(':') as [CareFactor['kind'], string?];
    const atMs = kind === 'vault' ? (state.outcome?.atMs ?? null) : null;
    if (e.lost > 0) out.push({ key, kind, target, points: -e.lost / night, ms: e.ms, count: e.count, atMs });
    if (e.saved > 0) out.push({ key: `${key}+`, kind, target, points: e.saved / night, ms: e.ms, count: e.count, atMs });
  }
  return out
    .map((f) => ({ ...f, points: Math.round(f.points * 10) / 10 }))
    .filter((f) => Math.abs(f.points) >= 0.5)
    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
}

function end(s: GameState, result: Outcome['result'], reason: string, real: string): void {
  if (s.phase === 'ended') return;
  s.phase = 'ended';
  s.rex.pending = []; // barks still inside their window were never decided
  s.catch = null;
  s.wires = null;
  s.keys = null;
  s.keysPending = false;
  s.letter = null;
  s.lettersDue = [];
  if (s.groups.length === 0 && s.stats.containedMs === null) s.stats.containedMs = s.timeMs;
  s.outcome = { result, reason, real, atMs: s.timeMs, summary: summarise(s, result) };
  s.outcome.summary.factors = careFactors(s);
  for (const rs of Object.values(s.rooms)) rs.litBy = null;
  log(s, { kind: 'event', text: reason, real });
}

function summarise(s: GameState, result: Outcome['result']): NightSummary {
  const night = world(s.scenarioId).ms.night;
  // An early win keeps the current care until dawn; a major incident means none until dawn.
  const rest = Math.max(0, night - s.timeMs) * (result === 'won' ? s.care : 0);
  // The Vault cracked: no care at all until dawn, booked against the Vault.
  const penalty = result === 'lost' ? world(s.scenarioId).sc.care.vaultPenalty : 0;
  if (result === 'lost') book(s, 'vault').lost += Math.max(0, night - s.timeMs) * 100 + penalty * night;
  for (const g of s.groups) if (s.rooms[g.room].locked) recordOf(s, g).stoppedMs ??= s.timeMs;
  const log = s.groupLog;
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  const spotted = log.filter((r) => r.spottedMs !== null);
  const stopped = log.filter((r) => r.stoppedMs !== null);
  return {
    careContinuity: Math.max(0, Math.round((s.stats.careMs + rest) / night - penalty)),
    mttdMs: avg(spotted.map((r) => r.spottedMs! - r.appearedMs)),
    // A group stopped before anyone saw it needed no response time at all.
    mttrMs: avg(stopped.map((r) => Math.max(0, r.stoppedMs! - (r.spottedMs ?? r.stoppedMs!)))),
    groups: log.length,
    spotted: spotted.length,
    stopped: stopped.length,
    factors: [],
  };
}

// ---------- Intents ----------

export const INTENT_TYPES = ['start', 'skipIntro', 'togglePause', 'reset', 'toggleReality', 'toggleDebug', 'toggleCode', 'clearRecord', 'action', 'catch', 'wire', 'code', 'aim', 'letter'] as const;
export type IntentType = (typeof INTENT_TYPES)[number];

export type Intent =
  | { type: Exclude<IntentType, 'action' | 'catch' | 'wire' | 'code' | 'aim' | 'letter'> }
  | { type: 'action'; action: ActionKind; room: RoomId; guard?: string }
  /** A click on someone in the "Catch the intruders" scene. */
  | { type: 'catch'; figure: number }
  /** A cable dragged from left position `from` to right position `to` in "Reconnect the exhibit". */
  | { type: 'wire'; from: number; to: number }
  /** One character typed in "Change the locks". */
  | { type: 'code'; char: string }
  /** Where the flashlight points in "Catch the intruders" (scene units). */
  | { type: 'aim'; x: number; y: number }
  /** The answer to "is this letter safe to open?". */
  | { type: 'letter'; answer: 'safe' | 'phishing' };

/** Only the presenter page can start (or skip the intro), reset or hand over control. */
export const PRESENTER_ONLY: readonly IntentType[] = ['start', 'skipIntro', 'reset', 'toggleCode', 'clearRecord'];

export function isIntent(value: unknown): value is Intent {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (!INTENT_TYPES.includes(v.type as IntentType)) return false;
  if (v.type === 'catch') return typeof v.figure === 'number' && Number.isInteger(v.figure);
  if (v.type === 'wire') return Number.isInteger(v.from) && Number.isInteger(v.to);
  if (v.type === 'code') return typeof v.char === 'string' && v.char.length === 1;
  if (v.type === 'aim') return Number.isFinite(v.x) && Number.isFinite(v.y);
  if (v.type === 'letter') return v.answer === 'safe' || v.answer === 'phishing';
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
    case 'wire':
      return joinWire(state, intent.from, intent.to);
    case 'code':
      return typeCode(state, intent.char);
    case 'letter':
      return answerLetter(state, intent.answer);
    case 'aim': {
      const c = state.catch;
      if (state.phase !== 'running' || !c || c.result !== null) return { state };
      const s = clone(state);
      s.catch!.aim = { x: Math.max(0, Math.min(1600, intent.x)), y: Math.max(0, Math.min(900, intent.y)) };
      return { state: s };
    }
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
      // A clean night: back to the museum view (the intro and power-on belong to it). Debug stays, for rehearsals.
      return { state: { ...fresh, debug: state.debug } };
    }
    case 'toggleReality':
      return { state: { ...state, reality: !state.reality } };
    case 'toggleDebug':
      return { state: { ...state, debug: !state.debug } };
    case 'toggleCode':
    case 'clearRecord': // the record lives on the server, not in the night
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
  repair: () => 0, // the wires decide when it ends
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
      // Only where a patrol has spotted the gang (and they are still there). Locked first is the safe
      // way: if the catch fails, they cannot slip away.
      const other = busyWith('evict', () => true) ?? busyWith('repair', () => true);
      if (other) return fail(`${other.name} is already on a job. One mini game at a time!`);
      if (!state.groups.some((g) => g.room === room.id && g.spotted)) return fail(`Spot them first: send a patrol to ${name}.`);
      break;
    }
    case 'repair': {
      if (!rs.locked) return fail(rs.dark ? `Lock and clear ${name} before repairing it.` : `Nothing to repair in ${name}.`);
      if (rs.dark && state.backupsLost) return fail('The Archive is wrecked. Repairs are disabled tonight.');
      const other = busyWith('repair', () => true) ?? busyWith('evict', () => true);
      if (other) return fail(`${other.name} is already on a job. One mini game at a time!`);
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
  // Strolling: set off from where they are (past the halfway mark of a walk, that is the next room).
  if (g.wander?.phase === 'walk' && s.timeMs - g.wander.startMs > (g.wander.untilMs - g.wander.startMs) / 2) g.room = g.wander.to;
  g.wander = null;
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
    hadGang: intent.action === 'lock' ? occupied(s, room.id) : undefined,
  };
  s.stats.dispatches++;
  s.orders.push({ action: intent.action, room: room.id, atMs: s.timeMs });

  // Trust analysis: a patrol, lock or evict for a room Rex barked at, within the window, follows him (once per bark).
  if (intent.action === 'patrol' || intent.action === 'lock' || intent.action === 'evict') {
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
