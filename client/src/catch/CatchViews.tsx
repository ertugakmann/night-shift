// Where "Catch the intruders" shows: big on the desk (screen 2) and over the /wall office, and as a
// timer ring over the room on the building screens, so everyone can follow it live.
import { AnimatePresence, motion } from 'motion/react';
import type { Snapshot } from '@night-shift/shared';
import { ROOMS } from '../building/layout';
import { worldOf } from '../game/view';
import { useGame } from '../net/game';
import { useRealityWave } from '../reality/useRealityWave';
import { CatchGame } from './CatchGame';
import { KeysGame } from './KeysGame';
import { WiresGame } from './WiresGame';

/** The mini game that is on (only one at a time), and a key that changes with each new one. */
function current(snapshot: Snapshot | null): { key: string; node: (reality: boolean) => React.ReactNode } | null {
  if (snapshot?.catch) return { key: `catch-${snapshot.catch.id}`, node: (r) => <CatchGame reality={r} /> };
  if (snapshot?.wires) return { key: `wires-${snapshot.wires.id}`, node: (r) => <WiresGame reality={r} /> };
  if (snapshot?.keys) return { key: `keys-${snapshot.keys.id}`, node: (r) => <KeysGame reality={r} /> };
  return null;
}

/** Screen 2: the mini game takes over the desk while it runs. */
export function DeskCatch() {
  const { snapshot } = useGame();
  const { shown: reality } = useRealityWave(2);
  const game = current(snapshot);
  return (
    <AnimatePresence>
      {game && (
        <motion.div
          key={game.key}
          className="absolute inset-0 z-[21] bg-[#05040f]"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          {game.node(reality)}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** /wall: the same game over the office, wherever the camera is. */
export function WallCatch({ reality }: { reality: boolean }) {
  const { snapshot } = useGame();
  const game = current(snapshot);
  return (
    <AnimatePresence>
      {game && (
        <motion.div
          key={game.key}
          className="absolute inset-0 z-[24]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="absolute inset-0 bg-[#05040f]/60" />
          <motion.div
            className="absolute left-[5%] right-[5%] top-[5%] bottom-[5%] overflow-hidden rounded-2xl shadow-2xl ring-4 ring-[#f2c65e]/70"
            initial={{ scale: 0.94, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 20 }}
          >
            {game.node(reality)}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** What the badge over a room shows for the mini game that is on. */
function badgeFor(snapshot: Snapshot, reality: boolean) {
  const w = worldOf(snapshot);
  const c = snapshot.catch;
  if (c) {
    const total = c.figures.filter((f) => f.kind === 'intruder').length;
    const done = c.figures.filter((f) => f.kind === 'intruder' && f.caught).length;
    const good = c.result === 'caught';
    return { room: c.room, done, total, endsMs: c.endsMs, limit: w.ms.catch, result: c.result, good, label: c.result ? (good ? (reality ? 'Terminated' : 'Caught!') : reality ? 'Failed' : 'Missed!') : reality ? 'Live response' : 'Catching!' };
  }
  const g = snapshot.wires;
  if (g) {
    const good = g.result === 'fixed';
    return { room: g.room, done: g.connected.length, total: g.left.length, endsMs: g.endsMs, limit: w.ms.wires, result: g.result, good, label: g.result ? (good ? (reality ? 'Restored' : 'Fixed!') : 'Failed') : reality ? 'Restoring' : 'Rewiring!' };
  }
  const k = snapshot.keys;
  if (k) {
    const room = w.sc.rooms.find((r) => r.special === 'masterKeys')!.id;
    const good = k.result === 'changed';
    const total = k.code.replace('-', '').length;
    return { room, done: k.typed, total, endsMs: k.endsMs, limit: w.ms.keys, result: k.result, good, label: k.result ? (good ? (reality ? 'Revoked' : 'New locks!') : reality ? 'Missed' : 'Too slow!') : reality ? 'Password reset' : 'Change locks!' };
  }
  return null;
}

/** On the building screens: a timer ring and the score over the room where a mini game is on. */
export function CatchBadge({ snapshot, rooms, reality = false }: { snapshot: Snapshot; rooms: Set<string>; reality?: boolean }) {
  const b = badgeFor(snapshot, reality);
  if (!b || !rooms.has(b.room)) return null;
  const { rect } = ROOMS[b.room];
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + Math.min(rect.h / 2, 190);
  const total = b.total;
  const caught = b.done;
  const left = b.result === null ? Math.max(0, b.endsMs - snapshot.timeMs) : 0;
  const frac = Math.min(1, left / b.limit);
  const c = { result: b.result };
  const r = 62;
  const circ = 2 * Math.PI * r;
  const good = b.good;
  const color = c.result ? (good ? '#3ee0d8' : '#f2994a') : frac > 0.5 ? '#3ee0d8' : frac > 0.25 ? '#f2994a' : '#ff6b6b';
  const label = b.label;
  return (
    <g pointerEvents="none" className={reality ? 'soc-text' : 'game-text'}>
      <circle cx={cx} cy={cy} r={r + 18} fill={reality ? '#0d1729' : '#17123a'} opacity={0.88} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={reality ? '#16243d' : '#2a2263'} strokeWidth={12} />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={12}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - (c.result ? 1 : frac))}
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: 'stroke-dashoffset 110ms linear, stroke 300ms ease' }}
      />
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize={34} fontWeight={800} fill="#fff1cf">
        {caught}/{total}
      </text>
      <rect x={cx - 92} y={cy + r + 22} width={184} height={38} rx={19} fill={color} />
      <text x={cx} y={cy + r + 48} textAnchor="middle" fontSize={22} fontWeight={800} fill="#17123a">
        {label}
      </text>
    </g>
  );
}
