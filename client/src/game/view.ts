import { msToClock, theRoom, world, type ActionKind, type Guard, type Snapshot, type World } from '@night-shift/shared';

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

/** "Patrol the Lab Gallery · walking 4 s" */
export function guardStatus(snapshot: Snapshot, guard: Guard): string {
  const w = worldOf(snapshot);
  const here = theRoom(w.room.get(guard.room)!.name);
  const task = guard.task;
  if (!task) return `Free, in ${here}`;
  const target = theRoom(w.room.get(task.room)!.name);
  const left = Math.ceil((task.walkMs + task.workMs - task.elapsedMs) / 1000);
  return `${ACTION_LABEL[task.action]} ${target} · ${task.arrived ? 'working' : 'walking'} ${left}s`;
}
