// Where "Catch the intruders" shows: big on the desk (screen 2) and over the /wall office, and as a
// timer ring over the room on the building screens, so everyone can follow it live.
import { AnimatePresence, motion } from 'motion/react';
import type { Snapshot } from '@night-shift/shared';
import { ROOMS } from '../building/layout';
import { worldOf } from '../game/view';
import { useGame } from '../net/game';
import { useRealityWave } from '../reality/useRealityWave';
import { CatchGame } from './CatchGame';

/** Screen 2: the mini game takes over the desk while it runs. */
export function DeskCatch() {
  const { snapshot } = useGame();
  const { shown: reality } = useRealityWave(2);
  const c = snapshot?.catch;
  return (
    <AnimatePresence>
      {c && (
        <motion.div
          key={c.id}
          className="absolute inset-0 z-[21] bg-[#05040f]"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <CatchGame reality={reality} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** /wall: the same game over the office, wherever the camera is. */
export function WallCatch({ reality }: { reality: boolean }) {
  const { snapshot } = useGame();
  const c = snapshot?.catch;
  return (
    <AnimatePresence>
      {c && (
        <motion.div
          key={c.id}
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
            <CatchGame reality={reality} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** On the building screens: a timer ring and the score over the room where the catch is on. */
export function CatchBadge({ snapshot, rooms, reality = false }: { snapshot: Snapshot; rooms: Set<string>; reality?: boolean }) {
  const c = snapshot.catch;
  if (!c || !rooms.has(c.room)) return null;
  const { rect } = ROOMS[c.room];
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + Math.min(rect.h / 2, 190);
  const total = c.figures.filter((f) => f.kind === 'intruder').length;
  const caught = c.figures.filter((f) => f.kind === 'intruder' && f.caught).length;
  const left = c.result === null ? Math.max(0, c.endsMs - snapshot.timeMs) : 0;
  const frac = Math.min(1, left / worldOf(snapshot).ms.catch);
  const r = 62;
  const circ = 2 * Math.PI * r;
  const good = c.result === 'caught';
  const color = c.result ? (good ? '#3ee0d8' : '#f2994a') : frac > 0.5 ? '#3ee0d8' : frac > 0.25 ? '#f2994a' : '#ff6b6b';
  const label = c.result === 'caught' ? (reality ? 'Terminated' : 'Caught!') : c.result ? (reality ? 'Failed' : 'Missed!') : reality ? 'Live response' : 'Catching!';
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
