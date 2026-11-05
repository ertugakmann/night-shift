import { AnimatePresence, motion } from 'motion/react';
import type { Fx, Snapshot } from '@night-shift/shared';
import { exhibitBox } from './Exhibit';
import { ROOMS } from './layout';

/** How long an effect plays, in game time. Effects older than this are not replayed after a refresh. */
const FX_MS = 2000;

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

const CONFETTI = ['#ffd27a', '#3ee0d8', '#ff9ec7', '#a8e07a', '#9c86f5', '#fff1cf'];

/** A small shower of confetti over a room the gang was just thrown out of. Fixed pattern, no randomness. */
export function Confetti({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y - 120})`}>
      {Array.from({ length: 22 }, (_, i) => {
        const a = (i / 22) * Math.PI * 2;
        const spread = 130 + (i % 5) * 40;
        const dx = Math.cos(a) * spread;
        const up = -90 - (i % 4) * 45;
        return (
          <motion.rect
            key={i}
            x={-11}
            y={-6}
            width={22}
            height={i % 3 === 0 ? 22 : 11}
            rx={i % 3 === 0 ? 11 : 3}
            fill={CONFETTI[i % CONFETTI.length]}
            initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
            animate={{ x: [0, dx * 0.7, dx], y: [0, up, up + 320], rotate: (i % 2 ? 1 : -1) * 540, opacity: [1, 1, 0] }}
            transition={{ duration: 1.8, ease: 'easeOut', times: [0, 0.3, 1] }}
          />
        );
      })}
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

/** A short word that pops up over a room and floats away: "Found them!", "Locked!", "Too late!". */
function Callout({ x, y, text, color, reality }: { x: number; y: number; text: string; color: string; reality: boolean }) {
  const w = text.length * (reality ? 17 : 19) + 44;
  return (
    <motion.g
      initial={{ opacity: 0, y: y + 20, scale: 0.6 }}
      animate={{ opacity: [0, 1, 1, 0], y: [y + 20, y, y - 10, y - 30], scale: [0.6, 1.1, 1, 1] }}
      transition={{ duration: 1.5, times: [0, 0.15, 0.75, 1], ease: 'easeOut' }}
      style={{ transformOrigin: `${x}px ${y}px` }}
      pointerEvents="none"
    >
      <rect x={x - w / 2} y={-28} width={w} height={52} rx={reality ? 10 : 26} fill={reality ? '#0d1729' : '#17123a'} stroke={color} strokeWidth={5} />
      <text x={x} y={10} textAnchor="middle" className={reality ? 'soc-text' : 'game-text'} fontSize={30} fontWeight={800} fill={color} letterSpacing={reality ? 1.5 : 0}>
        {text}
      </text>
    </motion.g>
  );
}

/** A guard arriving: a soft ring of lantern light (reality: a cyan ping). */
function Arrival({ x, y, reality }: { x: number; y: number; reality: boolean }) {
  return (
    <motion.circle
      cx={x}
      cy={y - 40}
      r={60}
      fill="none"
      stroke={reality ? '#3ee0d8' : '#ffd27a'}
      strokeWidth={8}
      initial={{ scale: 0.3, opacity: 0.9 }}
      animate={{ scale: 2.4, opacity: 0 }}
      transition={{ duration: 0.9, ease: 'easeOut' }}
      style={{ transformOrigin: `${x}px ${y - 40}px` }}
    />
  );
}

function Effect({ fx, reality }: { fx: Fx; reality: boolean }) {
  const room = ROOMS[fx.room];
  if (!room) return null;
  const top = { x: room.rect.x + room.rect.w / 2, y: room.rect.y + Math.min(110, room.rect.h * 0.35) };
  if (fx.kind === 'arrived') return <Arrival x={room.anchor.x} y={room.anchor.y} reality={reality} />;
  if (fx.kind === 'spotted') return <Callout {...top} text={reality ? 'DETECTED' : 'Found them!'} color="#f2994a" reality={reality} />;
  if (fx.kind === 'locked') return <Callout {...top} text={reality ? 'ISOLATED' : 'Locked!'} color="#9c86f5" reality={reality} />;
  if (fx.kind === 'late') return <Callout {...top} text={reality ? 'MOVED ON' : 'Too late!'} color="#f2994a" reality={reality} />;
  if (fx.kind === 'phew') return <Callout {...top} text={reality ? 'CLOSE CALL' : 'Phew!'} color="#3ee0d8" reality={reality} />;
  if (reality) return fx.kind === 'evicted' ? <Callout {...top} text="ERADICATED" color="#3ee0d8" reality /> : null;
  if (fx.kind === 'evicted') {
    return (
      <g>
        <StarBurst x={room.spots[0].x} y={room.spots[0].y} />
        <Confetti x={room.rect.x + room.rect.w / 2} y={room.spots[0].y} />
      </g>
    );
  }
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

/** Star bursts, sparkles and short callouts for recent events in the given rooms. */
export function Effects({ snapshot, rooms, reality = false }: { snapshot: Snapshot; rooms: Set<string>; reality?: boolean }) {
  const active = snapshot.fx.filter((f) => rooms.has(f.room) && snapshot.timeMs - f.atMs < FX_MS);
  return (
    <AnimatePresence>
      {active.map((f) => (
        <motion.g key={f.id} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
          <Effect fx={f} reality={reality} />
        </motion.g>
      ))}
    </AnimatePresence>
  );
}
