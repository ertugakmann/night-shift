import { msToClock, world, type ActionKind, type Snapshot, type World } from '@night-shift/shared';

export function worldOf(snapshot: Snapshot): World {
  return world(snapshot.scenarioId);
}

export function gameClock(snapshot: Snapshot): string {
  return msToClock(snapshot.timeMs, worldOf(snapshot).sc.night.realSecondsPerGameHour);
}

export function logClock(snapshot: Snapshot, atMs: number): string {
  return msToClock(atMs, worldOf(snapshot).sc.night.realSecondsPerGameHour);
}

export const ACTION_LABEL: Record<ActionKind, string> = {
  patrol: 'Patrol',
  lock: 'Lock doors',
  evict: 'Evict',
  repair: 'Repair',
  candlelight: 'Candlelight',
};

