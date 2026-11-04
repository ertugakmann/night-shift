import { AnimatePresence, motion } from 'motion/react';
import type { Fx, Snapshot } from '@night-shift/shared';
import { exhibitBox } from './Exhibit';
import { ROOMS } from './layout';

/** How long an effect plays, in game time. Effects older than this are not replayed after a refresh. */
const FX_MS = 1600;

const STAR = 'M0 -14 L4 -4 L14 -4 L6 3 L9 13 L0 7 L-9 13 L-6 3 L-14 -4 L-4 -4 Z';

function StarBurst({ x, y }: { x: number; y: number }) {
  const rays = Array.from({ length: 9 }, (_, i) => (i / 9) * Math.PI * 2);
  return (
    <g transform={`translate(${x},${y - 40}) scale(1.4)`}>
      <motion.circle
        r={20}
        fill="none"
        stroke="#ffd27a"
        strokeWidth={6}
        initial={{ scale: 0.3, opacity: 0.9 }}
        animate={{ scale: 4, opacity: 0 }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
      />
      {rays.map((a, i) => (
        <motion.path
          key={i}
          d={STAR}
          fill={i % 2 ? '#ffd27a' : '#3ee0d8'}
          initial={{ x: 0, y: 0, scale: 0.4, opacity: 1, rotate: 0 }}
          animate={{ x: Math.cos(a) * 130, y: Math.sin(a) * 110, scale: 1.2, opacity: 0, rotate: 180 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      ))}
    </g>
  );
}

function Sparkle({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <motion.circle
        r={Math.max(50, r * 0.75)}
        fill="none"
        stroke="#ffd27a"
        strokeWidth={8}
        initial={{ opacity: 0.9, scale: 0.4 }}
        animate={{ opacity: 0, scale: 1.3 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
      />
      {[0, 1, 2, 3].map((i) => (
        <motion.path
          key={i}
          d="M0 -18 Q2 -2 18 0 Q2 2 0 18 Q-2 2 -18 0 Q-2 -2 0 -18 Z"
          fill="#ffd27a"
          initial={{ opacity: 0, scale: 0, x: (i - 1.5) * 50, y: -20 - (i % 2) * 40 }}
          animate={{ opacity: [0, 1, 0], scale: [0, 1.2, 0.4], rotate: 90 }}
          transition={{ duration: 1.2, delay: i * 0.12 }}
        />
      ))}
    </g>
  );
}

function Effect({ fx }: { fx: Fx }) {
  const room = ROOMS[fx.room];
  if (!room) return null;
  if (fx.kind === 'evicted') return <StarBurst x={room.spots[0].x} y={room.spots[0].y} />;
  if (fx.kind === 'repaired') {
    return (
      <g>
        {Object.entries(room.exhibits).map(([id, ex]) => (
          <Sparkle key={id} x={ex.x} y={ex.y} r={exhibitBox(ex.kind, ex.scale).half} />
        ))}
      </g>
    );
  }
  return null;
}

/** Star bursts and sparkles for recent events in the given rooms. */
export function Effects({ snapshot, rooms }: { snapshot: Snapshot; rooms: Set<string> }) {
  const active = snapshot.fx.filter((f) => rooms.has(f.room) && snapshot.timeMs - f.atMs < FX_MS);
  return (
    <AnimatePresence>
      {active.map((f) => (
        <motion.g key={f.id} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
          <Effect fx={f} />
        </motion.g>
      ))}
    </AnimatePresence>
  );
}
