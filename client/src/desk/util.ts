import { shortestPath, type ActionKind, type Guard, type RoomId, type Snapshot, type World, padlocks } from '@night-shift/shared';
import { worldOf } from '../game/view';

// ---------- Mini map: the whole building, scaled down onto the desk ----------

export const MAP_SCALE = 0.234375; // 6400 → 1500 plan units
export const MAP_X = 50;
export const MAP_Y = 40;
export const mapX = (x: number) => MAP_X + x * MAP_SCALE;
export const mapY = (y: number) => MAP_Y + y * MAP_SCALE;

// ---------- NIST incident response stage ----------

export const NIST_STAGES = ['Detect', 'Analyse', 'Contain', 'Eradicate', 'Recover', 'Post-incident'] as const;

/** Which NIST stage the team is in, read from what the guards are doing right now. */
export function nistStage(s: Snapshot): number {
  if (s.phase === 'ended') return 5;
  const doing = (a: ActionKind) => s.guards.some((g) => g.task?.action === a);
  if (doing('repair')) return 4;
  if (doing('evict')) return 3;
  const anyLocked = Object.values(s.rooms).some((r) => r.locked);
  if (anyLocked || doing('lock')) return s.groups.length === 0 ? 4 : 2;
  if (s.stats.spotted > 0 || doing('patrol') || s.stats.barks > 0) return 1;
  return 0;
}

// ---------- CCTV severity ----------

export type Severity = 'LOW' | 'MED' | 'HIGH';

/** Severity of an alert from how critical the room's systems are. */
export function severity(w: World, room: RoomId | null): Severity {
  if (!room) return 'LOW';
  const total = w.room.get(room)!.exhibits.reduce((sum, e) => sum + e.criticality, 0);
  return total >= 15 ? 'HIGH' : total >= 7 ? 'MED' : 'LOW';
}

export const SEVERITY_COLOR: Record<Severity, string> = { LOW: '#3ee0d8', MED: '#f2994a', HIGH: '#ff6b6b' };

// ---------- Text ----------

/** Greedy word wrap by character count (good enough for a fixed-size display font). */
export function wrap(text: string, width: number, maxLines: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].slice(0, width - 1)}…`;
    return kept;
  }
  return lines;
}

export function truncate(text: string, width: number): string {
  return text.length > width ? `${text.slice(0, width - 1)}…` : text;
}

// ---------- Actions ----------

/** Why an action can't be used on a room right now (null if it can). Mirrors the engine's checks. */
export function actionBlocked(s: Snapshot, room: RoomId, action: ActionKind): string | null {
  const w = worldOf(s);
  const rs = s.rooms[room];
  const r = w.room.get(room)!;
  if (s.phase === 'idle') return 'The night has not started yet.';
  if (s.phase === 'paused') return 'Paused.';
  if (s.phase === 'ended') return 'The night is over.';
  switch (action) {
    case 'patrol':
      return null;
    case 'lock':
      if (rs.locked) return 'Already locked.';
      return padlocks(s).free === 0 ? `All ${w.sc.actions.maxLocks} padlocks are in use. Unlock or repair a room first.` : null;
    case 'unlock':
      return rs.locked ? null : 'Not locked.';
    case 'evict':
      return rs.locked ? null : 'Lock the room first, so they cannot slip away.';
    case 'repair':
      if (!rs.locked) return rs.dark ? 'Lock and clear the room first.' : 'Nothing to repair.';
      if (rs.dark && s.backupsLost) return 'The Archive is wrecked. Repairs are disabled.';
      return null;
    case 'candlelight': {
      if (s.candlelight[r.wing]) return 'Candles are already lit in this wing.';
      const anyClosed = w.sc.rooms.some((x) => x.wing === r.wing && (s.rooms[x.id].locked || s.rooms[x.id].dark));
      return anyClosed ? null : 'Everything in this wing is running. No need for candles yet.';
    }
  }
}

/** The guard the server would send: the nearest free one. */
export function nearestFreeGuard(s: Snapshot, room: RoomId): { guard: Guard; rooms: number } | null {
  const w = worldOf(s);
  let best: { guard: Guard; rooms: number } | null = null;
  for (const g of s.guards) {
    if (g.task) continue;
    const rooms = shortestPath(w, g.room, room).length - 1;
    if (!best || rooms < best.rooms) best = { guard: g, rooms };
  }
  return best;
}
