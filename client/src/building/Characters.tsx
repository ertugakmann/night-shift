// The cast, drawn in code. Each sprite stands with its feet at (0, 0).
import { memo } from 'react';
import { motion } from 'motion/react';

interface GuardLook {
  skin: string;
  band: string;
  hair: string;
}

const LIFT = { type: 'spring', stiffness: 170, damping: 15 } as const;

const LOOKS: Record<string, GuardLook> = {
  sam: { skin: '#f3cfa6', band: '#3ee0d8', hair: '#5b3a24' },
  priya: { skin: '#c98d62', band: '#ff9ec7', hair: '#2a1a2e' },
  tom: { skin: '#eab78e', band: '#a8e07a', hair: '#c46a3a' },
};

/** A guard. `raised` lifts the lantern; `walking` adds a little bounce. */
export const GuardArt = memo(function GuardArt({
  id,
  raised,
  walking,
  facing,
}: {
  id: string;
  raised: boolean;
  walking: boolean;
  facing: 1 | -1;
}) {
  const look = LOOKS[id] ?? LOOKS.sam;
  return (
    <g>
      <ellipse cx={0} cy={2} rx={26} ry={8} fill="#000" opacity={0.35} />
      <g className={walking ? 'bob' : 'breathe'}>
        <g transform={`scale(${facing},1)`}>
          {/* Priya's ponytail sits behind the head */}
          {id === 'priya' && <path d="M-22 -66 Q-46 -50 -34 -26 Q-24 -44 -14 -56 Z" fill={look.hair} />}
          {/* body */}
          <rect x={-17} y={-36} width={34} height={36} rx={12} fill="#2f3f86" />
          <rect x={-17} y={-14} width={34} height={6} fill="#1f2a5e" />
          <circle cx={0} cy={-26} r={4} fill="#f2c65e" />
          {/* head */}
          <circle cx={0} cy={-62} r={28} fill={look.skin} />
          {/* cap */}
          <path d="M-29 -66 Q-28 -96 0 -97 Q28 -96 29 -66 Z" fill="#26306b" />
          <rect x={-29} y={-72} width={58} height={8} rx={4} fill={look.band} />
          <path d="M6 -66 Q30 -68 40 -60 Q26 -58 6 -60 Z" fill="#1b2350" />
          <circle cx={0} cy={-88} r={5} fill="#f2c65e" />
          {/* face */}
          <ellipse cx={-9} cy={-58} rx={3.5} ry={4.5} fill="#2a1d3a" className="blink" />
          <ellipse cx={11} cy={-58} rx={3.5} ry={4.5} fill="#2a1d3a" className="blink" />
          <circle cx={-17} cy={-48} r={5} fill="#ff8fa3" opacity={0.45} />
          <circle cx={19} cy={-48} r={5} fill="#ff8fa3" opacity={0.45} />
          {id === 'tom' ? (
            <path d="M-6 -46 Q1 -51 8 -46 Q1 -43 -6 -46 Z" fill={look.hair} />
          ) : (
            <path d="M-4 -46 Q1 -42 6 -46" fill="none" stroke="#2a1d3a" strokeWidth={2.5} strokeLinecap="round" />
          )}
          {/* lantern arm */}
          {/* lantern arm: shoulder stays put, the hand and lantern spring between low and raised */}
          <motion.line
            x1={13}
            y1={-30}
            initial={false}
            animate={raised ? { x2: 30, y2: -74 } : { x2: 30, y2: -12 }}
            transition={LIFT}
            stroke="#2f3f86"
            strokeWidth={9}
            strokeLinecap="round"
          />
          <motion.g initial={false} animate={raised ? { x: 32, y: -92 } : { x: 32, y: -6 }} transition={LIFT}>
            <line x1={0} y1={-12} x2={0} y2={-4} stroke="#c9913c" strokeWidth={3} />
            <rect x={-9} y={-4} width={18} height={20} rx={5} fill="#c9913c" />
            <rect x={-6} y={-1} width={12} height={14} rx={4} fill="#fff1b8" className="flame" />
          </motion.g>
        </g>
      </g>
    </g>
  );
});

/** One of the gang: a round, mischievous shadow in a beret. */
export const IntruderArt = memo(function IntruderArt({ spotted, ghost }: { spotted: boolean; ghost?: boolean }) {
  if (ghost) {
    return (
      <g opacity={0.55}>
        <circle cx={0} cy={-30} r={30} fill="none" stroke="#ff6b6b" strokeWidth={3} strokeDasharray="8 6" />
        <path d="M-24 -54 Q-4 -72 22 -58 Q8 -50 -24 -54 Z" fill="none" stroke="#ff6b6b" strokeWidth={3} />
      </g>
    );
  }
  return (
    <g>
      <ellipse cx={0} cy={2} rx={30} ry={8} fill="#000" opacity={0.3} />
      <motion.g
        key={spotted ? 'spotted' : 'calm'}
        initial={spotted ? { y: 0 } : false}
        animate={spotted ? { y: [0, -26, 0, -10, 0] } : { y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <g className={spotted ? '' : 'sneak'}>
          <circle cx={0} cy={-32} r={32} fill="#1a1131" />
          <circle cx={0} cy={-32} r={32} fill="none" stroke="#5a4596" strokeWidth={3} opacity={0.7} />
          {/* beret */}
          <path d="M-26 -56 Q-6 -78 24 -62 Q12 -52 -26 -56 Z" fill="#3b2a6e" />
          <circle cx={-2} cy={-70} r={4} fill="#3b2a6e" />
          {/* eyes */}
          {spotted ? (
            <>
              <circle cx={-11} cy={-34} r={9} fill="#fff" />
              <circle cx={11} cy={-34} r={9} fill="#fff" />
              <circle cx={-11} cy={-34} r={3.5} fill="#1a1131" />
              <circle cx={11} cy={-34} r={3.5} fill="#1a1131" />
              <ellipse cx={0} cy={-16} rx={6} ry={7} fill="#0d0820" />
            </>
          ) : (
            <>
              <path d="M-18 -36 Q-11 -42 -4 -36 Q-11 -31 -18 -36 Z" fill="#fff" />
              <path d="M4 -36 Q11 -42 18 -36 Q11 -31 4 -36 Z" fill="#fff" />
              <circle cx={-9} cy={-36} r={2.5} fill="#1a1131" className="glance" />
              <circle cx={13} cy={-36} r={2.5} fill="#1a1131" className="glance" />
              <path d="M-8 -20 Q2 -14 10 -22" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" opacity={0.8} />
            </>
          )}
        </g>
      </motion.g>
      {spotted && (
        <motion.g
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 12 }}
        >
          <circle cx={30} cy={-80} r={17} fill="#f2994a" />
          <rect x={27} y={-92} width={6} height={15} rx={3} fill="#fff" />
          <circle cx={30} cy={-71} r={3} fill="#fff" />
        </motion.g>
      )}
    </g>
  );
});
