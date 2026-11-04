import { msToClock, world, type ActionKind, type Snapshot, type World } from '@night-shift/shared';

export function worldOf(snapshot: Snapshot): World {
  return world(snapshot.scenarioId);
}

export function gameClock(snapshot: Snapshot): string {
  const w = worldOf(snapshot);
  if (snapshot.phase === 'intro') {
    // The last two minutes before midnight, stretched over the intro.
    const minute = Math.min(1, Math.floor((snapshot.introMs / w.ms.intro) * 2));
    return `23:5${8 + minute}`;
  }
  return msToClock(snapshot.timeMs, w.sc.night.realSecondsPerGameHour);
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

