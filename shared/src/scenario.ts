import benchmarksJson from '../scenario/benchmarks.json';
import demoJson from '../scenario/demo.json';
import type { ScreenId } from './screens';

export type RoomId = string;
export type Wing = 'lobby' | 'west' | 'east' | 'vault';
export type ImpactType = 'tests' | 'medicines' | 'surgeries' | 'ambulances';

export const WINGS: readonly Wing[] = ['lobby', 'west', 'east', 'vault'];
export const IMPACT_TYPES: readonly ImpactType[] = ['tests', 'medicines', 'surgeries', 'ambulances'];

export const WING_NAMES: Record<Wing, { name: string; real: string }> = {
  lobby: { name: 'Lobby', real: 'Admin and network entry' },
  west: { name: 'West Wing', real: 'Lab and pharmacy' },
  east: { name: 'East Wing', real: 'Emergency, wards and imaging' },
  vault: { name: 'Vault Wing', real: 'Records and backups' },
};

/** Patient impact counters. Always real, in both views. */
export const IMPACT_LABELS: Record<ImpactType, string> = {
  tests: 'Delayed tests',
  medicines: 'Delayed medicines',
  surgeries: 'Delayed surgeries',
  ambulances: 'Diverted ambulances',
};

export interface Exhibit {
  id: string;
  name: string;
  real: string;
  criticality: number;
  impact: ImpactType | null;
  report: { speaker: string; text: string };
}

export interface Room {
  id: RoomId;
  screen: ScreenId;
  wing: Wing;
  name: string;
  real: string;
  /** How strongly the gang is drawn to this room. */
  lure: number;
  special?: 'masterKeys' | 'backups' | 'vault';
  /** Critical departments: what their staff say on the radio when the room closes (locked or dark). */
  complaint?: { speaker: string; text: string };
  cctv: { game: string; reality: string };
  exhibits: Exhibit[];
}

/** Game clock time, "HH:MM". */
type Clock = string;

export interface Scenario {
  id: string;
  seed: number;
  night: { start: Clock; end: Clock; realSecondsPerGameHour: number };
  /** Shift-start intro, played on every page at once before the clock starts. */
  intro: { durationSec: number; radioCheck: { atSec: number; guard: string; text: string }[] };
  intruders: {
    entryRoom: RoomId;
    breakInAt: Clock;
    spreadTickSec: number;
    masterKeysSpreadTickSec: number;
    moveChance: number;
    splitChance: number;
    maxGroups: number;
    towardVaultFactor: number;
    revisitFactor: number;
    minStaySec: number;
    /** The first spread tick comes this soon after the break-in, and in it the gang always splits. */
    firstSplitSec: number;
    /** Where the group that splits off goes. */
    firstSplitTo: RoomId;
    /**
     * If the entry room is locked at break-in time, the gang comes in here instead (the front door),
     * a guard warns on the radio, and the split goes to `splitTo`. Both locked: they wait outside.
     */
    frontDoor: { room: RoomId; splitTo: RoomId; guard: string; text: string; real: string };
    vandaliseAfterSec: number;
    vaultLoseAfterSec: number;
  };
  actions: {
    walkSecPerRoom: number;
    patrolSec: number;
    lockSec: number;
    /** Evict is the "Catch the intruders" mini game: the time limit, the cost of a wrong click, and how many innocent visitors mingle with the gang. */
    catchSec: number;
    catchPenaltySec: number;
    catchInnocents: number;
    /** Repair is the "Reconnect the exhibit" mini game: its time limit. */
    wiresSec: number;
    /** "Change the locks" (Key Room vandalised): time to type the code. */
    keysSec: number;
    candlelightSec: number;
    candlelightModifier: number;
    /** How much candlelight slows the patient impact counters in its wing (they rise much faster without). */
    candlelightImpactModifier: number;
    /** How many rooms can be locked at the same time (the padlocks on the desk). */
    maxLocks: number;
  };
  guards: { id: string; name: string; startRoom: RoomId }[];
  rooms: Room[];
  doors: [RoomId, RoomId][];
  /** Patient impact per closed exhibit per game hour (without candlelight). */
  impactPerGameHour: Record<ImpactType, number>;
  /** A lost night: a major incident, and at least this many ambulances diverted. */
  majorIncidentAmbulances: number;
  clues: {
    cctvChancePerTick: number;
    falseCctv: { at: Clock; room: RoomId }[];
    decoyChatter: { at: Clock; speaker: string; text: string }[];
  };
  rex: {
    /** Rex barks when his confidence is above this (percent). */
    barkThreshold: number;
    /** After a bark, a patrol, lock or evict for that room within this many seconds counts as following Rex. */
    followWindowSec: number;
    mistake: { from: Clock; room: RoomId; confidence: number; holdSec: number };
  };
}

export const DEMO: Scenario = demoJson as unknown as Scenario;

/** Care continuity from test runs, for the comparison line on the end screen ("Average 72%, best 86%"). */
export const BENCHMARKS: { averageCare: number; bestCare: number } = benchmarksJson;

const scenarios = new Map<string, Scenario>([[DEMO.id, DEMO]]);

/** Tests can register variations of the demo. */
export function registerScenario(scenario: Scenario): void {
  scenarios.set(scenario.id, scenario);
  worlds.delete(scenario.id);
}

// ---------- Derived, cached lookups ----------

export interface World {
  sc: Scenario;
  room: Map<RoomId, Room>;
  neighbours: Map<RoomId, RoomId[]>;
  vault: RoomId;
  distToVault: Map<RoomId, number>;
  /** All durations in real milliseconds. */
  ms: {
    gameHour: number;
    night: number;
    intro: number;
    breakIn: number;
    spreadTick: number;
    masterKeysTick: number;
    minStay: number;
    firstSplit: number;
    catch: number;
    catchPenalty: number;
    wires: number;
    keys: number;
    followWindow: number;
    vandalise: number;
    vaultLose: number;
    walkPerRoom: number;
    rexMistakeFrom: number;
    rexMistakeHold: number;
  };
}

const worlds = new Map<string, World>();

export function world(scenarioId: string): World {
  let w = worlds.get(scenarioId);
  if (!w) {
    const sc = scenarios.get(scenarioId);
    if (!sc) throw new Error(`Unknown scenario ${scenarioId}`);
    w = buildWorld(sc);
    worlds.set(scenarioId, w);
  }
  return w;
}

/** "01:30" on the game clock → real milliseconds since 00:00. */
export function clockToMs(clock: Clock, realSecondsPerGameHour: number): number {
  const [h, m] = clock.split(':').map(Number);
  return ((h * 60 + m) / 60) * realSecondsPerGameHour * 1000;
}

/** Real milliseconds since 00:00 → "HH:MM" on the game clock. */
export function msToClock(ms: number, realSecondsPerGameHour: number): string {
  const minutes = Math.floor((ms / 1000 / realSecondsPerGameHour) * 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function buildWorld(sc: Scenario): World {
  const room = new Map(sc.rooms.map((r) => [r.id, r]));
  const neighbours = new Map<RoomId, RoomId[]>(sc.rooms.map((r) => [r.id, []]));
  for (const [a, b] of sc.doors) {
    neighbours.get(a)!.push(b);
    neighbours.get(b)!.push(a);
  }
  const vault = sc.rooms.find((r) => r.special === 'vault')?.id;
  if (!vault) throw new Error('Scenario has no vault');

  const hour = sc.night.realSecondsPerGameHour;
  const at = (clock: Clock) => clockToMs(clock, hour);
  return {
    sc,
    room,
    neighbours,
    vault,
    distToVault: distancesFrom(vault, neighbours),
    ms: {
      gameHour: hour * 1000,
      night: at(sc.night.end) - at(sc.night.start),
      intro: sc.intro.durationSec * 1000,
      breakIn: at(sc.intruders.breakInAt),
      spreadTick: sc.intruders.spreadTickSec * 1000,
      masterKeysTick: sc.intruders.masterKeysSpreadTickSec * 1000,
      minStay: sc.intruders.minStaySec * 1000,
      firstSplit: sc.intruders.firstSplitSec * 1000,
      catch: sc.actions.catchSec * 1000,
      catchPenalty: sc.actions.catchPenaltySec * 1000,
      wires: sc.actions.wiresSec * 1000,
      keys: sc.actions.keysSec * 1000,
      followWindow: sc.rex.followWindowSec * 1000,
      vandalise: sc.intruders.vandaliseAfterSec * 1000,
      vaultLose: sc.intruders.vaultLoseAfterSec * 1000,
      walkPerRoom: sc.actions.walkSecPerRoom * 1000,
      rexMistakeFrom: at(sc.rex.mistake.from),
      rexMistakeHold: sc.rex.mistake.holdSec * 1000,
    },
  };
}

function distancesFrom(start: RoomId, neighbours: Map<RoomId, RoomId[]>): Map<RoomId, number> {
  const dist = new Map<RoomId, number>([[start, 0]]);
  const queue = [start];
  while (queue.length) {
    const current = queue.shift()!;
    for (const n of neighbours.get(current)!) {
      if (!dist.has(n)) {
        dist.set(n, dist.get(current)! + 1);
        queue.push(n);
      }
    }
  }
  return dist;
}

/** Rooms in breadth-first order from `start`, `start` included. */
export function roomsByDistance(w: World, start: RoomId): RoomId[] {
  return [...distancesFrom(start, w.neighbours).entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id);
}

/** Shortest door route from → to, both included. Guards carry keys, so locks don't matter. */
export function shortestPath(w: World, from: RoomId, to: RoomId): RoomId[] {
  if (from === to) return [from];
  const parent = new Map<RoomId, RoomId>();
  const queue = [from];
  const seen = new Set([from]);
  while (queue.length) {
    const current = queue.shift()!;
    for (const n of w.neighbours.get(current)!) {
      if (seen.has(n)) continue;
      seen.add(n);
      parent.set(n, current);
      if (n === to) {
        const path = [to];
        while (path[0] !== from) path.unshift(parent.get(path[0])!);
        return path;
      }
      queue.push(n);
    }
  }
  throw new Error(`No route from ${from} to ${to}`);
}

/** "the Lab Gallery", but "The Vault" stays as it is. */
export function theRoom(name: string): string {
  return name.startsWith('The ') ? name : `the ${name}`;
}
