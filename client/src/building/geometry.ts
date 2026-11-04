import type { Guard } from '@night-shift/shared';
import { ROOMS, doorSide, findDoor, type Pt } from './layout';

/** Small offsets so guards sharing a room don't stand on each other. */
const GUARD_OFFSET: Record<string, Pt> = {
  sam: { x: -34, y: 6 },
  priya: { x: 0, y: -10 },
  tom: { x: 34, y: 8 },
};

/** The walking line for a route: start spot, through each door, to the target spot. */
export function routePoints(path: string[], offset: Pt): Pt[] {
  const shift = (p: Pt) => ({ x: p.x + offset.x, y: p.y + offset.y });
  const points: Pt[] = [shift(ROOMS[path[0]].anchor)];
  for (let i = 0; i + 1 < path.length; i++) {
    const door = findDoor(path[i], path[i + 1]);
    points.push(doorSide(door, path[i]), doorSide(door, path[i + 1]));
  }
  points.push(shift(ROOMS[path[path.length - 1]].anchor));
  return points;
}

/** Point at `t` (0–1) along a polyline, at constant speed. */
export function along(points: Pt[], t: number): Pt {
  const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
  const total = lengths.reduce((a, b) => a + b, 0);
  let distance = Math.max(0, Math.min(1, t)) * total;
  for (let i = 0; i < lengths.length; i++) {
    if (distance <= lengths[i] || i === lengths.length - 1) {
      const f = lengths[i] === 0 ? 1 : Math.min(1, distance / lengths[i]);
      return { x: points[i].x + (points[i + 1].x - points[i].x) * f, y: points[i].y + (points[i + 1].y - points[i].y) * f };
    }
    distance -= lengths[i];
  }
  return points[points.length - 1];
}

export interface GuardPose extends Pt {
  walking: boolean;
  /** Lantern raised: patrolling inside the target room. */
  raised: boolean;
}

export function guardPose(guard: Guard): GuardPose {
  const offset = GUARD_OFFSET[guard.id] ?? { x: 0, y: 0 };
  const task = guard.task;
  if (!task || task.arrived || task.walkMs === 0) {
    const room = task ? task.room : guard.room;
    const a = ROOMS[room].anchor;
    return { x: a.x + offset.x, y: a.y + offset.y, walking: false, raised: !!task && task.action === 'patrol' };
  }
  const p = along(routePoints(task.path, offset), task.elapsedMs / task.walkMs);
  return { ...p, walking: true, raised: false };
}
