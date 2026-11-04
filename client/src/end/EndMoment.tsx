// The end of the night on the wall, the same moment on every screen.
// Won: dawn breaks in the east (screen 5) and the light spreads west across the wall, screen by screen.
// Lost: the alarm glows red everywhere and the Vault door swings open. Then the result card arrives on screen 5.
import { useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Outcome, ScreenId, Snapshot } from '@night-shift/shared';
import { VaultDoor } from '../building/Exhibit';
import { ROOMS, SLICE_H, SLICE_W, type Rect } from '../building/layout';
import { CARD_H, CARD_W, ResultCard } from './ResultCard';
import { useScreenPosition } from '../components/position';
import { headline } from './text';
import { useEndMoment, useTween } from './useEndMoment';

const DAWN_STEP_S = 0.7;
const DAWN_S = 3;

/** Dawn comes from the east: it starts on the rightmost screen and travels left (seconds). */
export function useDawnDelay(screen: ScreenId): number {
  return (4 - useScreenPosition(screen)) * DAWN_STEP_S;
}

/** The light (or the alarm) over one screen. */
export function EndWash({ outcome, fresh, screen, rect, reality }: { outcome: Outcome; fresh: boolean; screen: ScreenId; rect: Rect; reality: boolean }) {
  const delay = useDawnDelay(screen);
  const won = outcome.result === 'won';
  const id = `end-wash-${screen}-${reality ? 'r' : 'm'}`;
  if (!won) {
    return (
      <motion.g pointerEvents="none" initial={fresh ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}>
        <defs>
          <radialGradient id={id} cx="0.5" cy="0.5" r="0.75">
            <stop offset="0.3" stopColor="#ff6b6b" stopOpacity={0.08} />
            <stop offset="1" stopColor="#ff3b3b" stopOpacity={0.7} />
          </radialGradient>
        </defs>
        <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill={`url(#${id})`} className="danger-pulse" />
      </motion.g>
    );
  }
  return (
    <motion.g
      pointerEvents="none"
      initial={fresh ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={{ duration: DAWN_S, delay, ease: 'easeInOut' }}
    >
      <defs>
        {/* one gradient across the whole building (6400 wide), brightest in the east */}
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={6400} y2={900}>
          {reality ? (
            <>
              <stop offset="0" stopColor="#3ee0d8" stopOpacity={0.05} />
              <stop offset="1" stopColor="#3ee0d8" stopOpacity={0.16} />
            </>
          ) : (
            <>
              <stop offset="0" stopColor="#ff8fa3" stopOpacity={0.14} />
              <stop offset="0.55" stopColor="#ffb38a" stopOpacity={0.1} />
              <stop offset="1" stopColor="#ffe3a0" stopOpacity={0.16} />
            </>
          )}
        </linearGradient>
      </defs>
      <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill={`url(#${id})`} />
    </motion.g>
  );
}

/** Morning sun rising over the top-right corner of screen 5. */
function Sun({ slice, fresh }: { slice: Rect; fresh: boolean }) {
  const cx = slice.x + 1040;
  return (
    <motion.g
      pointerEvents="none"
      initial={fresh ? { y: 260, opacity: 0 } : false}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 2.6, ease: 'easeOut' }}
    >
      <g transform={`translate(${cx},40) scale(0.75)`}>
        <circle r={260} fill="#ffd27a" opacity={0.18} />
        <g className="spin-slow">
          {Array.from({ length: 12 }, (_, i) => (
            <rect key={i} x={-10} y={-210} width={20} height={56} rx={10} fill="#ffe3a0" opacity={0.85} transform={`rotate(${i * 30})`} />
          ))}
        </g>
        <circle r={130} fill="#ffd27a" />
        <circle r={130} fill="none" stroke="#fff1cf" strokeWidth={8} opacity={0.6} />
        {/* a sleepy, happy face */}
        <path d="M-50 10 Q-36 0 -22 10" fill="none" stroke="#c9913c" strokeWidth={7} strokeLinecap="round" />
        <path d="M22 10 Q36 0 50 10" fill="none" stroke="#c9913c" strokeWidth={7} strokeLinecap="round" />
        <path d="M-24 44 Q0 64 24 44" fill="none" stroke="#c9913c" strokeWidth={7} strokeLinecap="round" />
        <circle cx={-66} cy={36} r={14} fill="#ff9fb0" opacity={0.6} />
        <circle cx={66} cy={36} r={14} fill="#ff9fb0" opacity={0.6} />
      </g>
    </motion.g>
  );
}

/** Lost: the great vault door swings open on its hinges, and the records flutter out. */
function OpenVault({ fresh }: { fresh: boolean }) {
  const ex = ROOMS.vault.exhibits['crown-ledger'];
  const p = useTween(true, 1600, 400, !fresh);
  const hinge = -210;
  const pages = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => {
        const a = (-150 + i * 38) * (Math.PI / 180);
        return { x: Math.cos(a) * (160 + (i % 3) * 50), y: Math.sin(a) * (120 + (i % 2) * 60) + 40, r: -30 + i * 9, d: 0.9 + i * 0.12 };
      }),
    [],
  );
  return (
    <g transform={`translate(${ex.x},${ex.y})`} pointerEvents="none">
      {/* the empty vault behind the door */}
      <circle r={206} fill="#0a0618" />
      <circle r={206} fill="none" stroke="#ff6b6b" strokeWidth={8} opacity={0.8} className="danger-pulse" />
      <circle r={150} fill="#140c2c" />
      {[-60, 0, 60].map((x) => (
        <rect key={x} x={x - 22} y={-40} width={44} height={84} rx={6} fill="#2a1d5c" opacity={0.8} />
      ))}
      {/* the door, swinging towards us on its left hinge */}
      <g transform={`translate(${hinge},0) skewY(${-10 * p}) scale(${1 - 0.8 * p},1) translate(${-hinge},0)`}>
        <VaultDoor />
      </g>
      {/* records flutter out */}
      {pages.map((pg, i) => (
        <motion.g
          key={i}
          initial={fresh ? { x: 0, y: 0, opacity: 0 } : false}
          animate={{ x: pg.x, y: pg.y, opacity: 1 }}
          transition={{ duration: 1.2, delay: pg.d, ease: 'easeOut' }}
        >
          <g transform={`rotate(${pg.r})`}>
            <rect x={-20} y={-26} width={40} height={52} rx={4} fill="#fff7e6" />
            <line x1={-12} y1={-12} x2={12} y2={-12} stroke="#c9b8a0" strokeWidth={3} />
            <line x1={-12} y1={0} x2={12} y2={0} stroke="#c9b8a0" strokeWidth={3} />
            <line x1={-12} y1={12} x2={6} y2={12} stroke="#c9b8a0" strokeWidth={3} />
          </g>
        </motion.g>
      ))}
    </g>
  );
}

/** A small ambulance, driving away. */
function Ambulance() {
  return (
    <g>
      <rect x={-44} y={-30} width={64} height={40} rx={8} fill="#fff7e6" />
      <path d="M20 -22 H36 L48 -6 V10 H20 Z" fill="#fff7e6" />
      <path d="M26 -16 H34 L42 -6 H26 Z" fill="#9fd7ef" />
      <rect x={-20} y={-20} width={8} height={22} fill="#ff6b6b" />
      <rect x={-27} y={-13} width={22} height={8} fill="#ff6b6b" />
      <rect x={-8} y={-38} width={14} height={8} rx={3} fill="#ff6b6b" className="danger-pulse" />
      <circle cx={-24} cy={12} r={9} fill="#2a1d5c" />
      <circle cx={30} cy={12} r={9} fill="#2a1d5c" />
    </g>
  );
}

/** The big banner in the middle of a screen. */
function Banner({ snapshot, outcome, cx, cy, fresh, reality }: { snapshot: Snapshot; outcome: Outcome; cx: number; cy: number; fresh: boolean; reality: boolean }) {
  const won = outcome.result === 'won';
  const { title, sub } = headline(snapshot, outcome, reality);
  const w = 1180;
  const h = 190;
  const color = won ? (reality ? '#3ee0d8' : '#ffd27a') : '#ff6b6b';
  return (
    <motion.g
      className={reality ? 'soc-text' : 'game-text'}
      pointerEvents="none"
      initial={fresh ? { opacity: 0, y: 30 } : false}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.9, delay: won ? 1.2 : 0.4, ease: 'easeOut' } }}
      exit={{ opacity: 0, transition: { duration: 0.6 } }}
    >
      <rect x={cx - w / 2 + 8} y={cy - h / 2 + 10} width={w} height={h} rx={34} fill="#000" opacity={0.3} />
      <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={34} fill={reality ? '#0b1424' : '#17123a'} opacity={0.94} stroke={color} strokeWidth={6} />
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize={64} fontWeight={800} fill={color}>
        {title}
      </text>
      <text x={cx} y={cy + 52} textAnchor="middle" fontSize={30} fill={reality ? '#e6edf7' : '#fff1cf'} opacity={0.9}>
        {sub}
      </text>
      {!won && (
        // an ambulance turning away: diverted
        <g transform={`translate(${cx - w / 2 + 96},${cy + 18}) scale(1.25)`}>
          <path d="M44 -52 Q44 -78 14 -78 Q-16 -78 -16 -56" fill="none" stroke="#ff9a8a" strokeWidth={6} strokeLinecap="round" />
          <path d="M-26 -64 L-16 -50 L-4 -64" fill="none" stroke="#ff9a8a" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
          <g className="bob">
            <Ambulance />
          </g>
        </g>
      )}
    </motion.g>
  );
}

/** Little stars drifting up through the dawn light. */
function Sparkles({ slice }: { slice: Rect }) {
  const stars = useMemo(() => {
    let seed = slice.x + 7;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    return Array.from({ length: 12 }, () => ({ x: slice.x + 80 + rnd() * (SLICE_W - 160), y: 140 + rnd() * (SLICE_H - 220), d: -rnd() * 3, s: 0.8 + rnd() * 0.8 }));
  }, [slice.x]);
  return (
    <g pointerEvents="none">
      {stars.map((st, i) => (
        <g key={i} transform={`translate(${st.x},${st.y}) scale(${st.s})`}>
          <path d="M0 -16 L4 -4 L16 0 L4 4 L0 16 L-4 4 L-16 0 L-4 -4 Z" fill="#fff1cf" className="note-float" style={{ animationDelay: `${st.d}s` }} />
        </g>
      ))}
    </g>
  );
}

/** The end-of-night light (or alarm) over a whole screen that is not a building slice: the desk. */
export function ScreenEndWash({ screen, rect, reality }: { screen: ScreenId; rect: Rect; reality: boolean }) {
  const { outcome, fresh } = useEndMoment();
  if (!outcome) return null;
  return <EndWash outcome={outcome} fresh={fresh} screen={screen} rect={rect} reality={reality} />;
}

/** Everything the end of the night adds to a building screen (museum or reality view). */
export function BuildingEnd({ screen, slice, snapshot, reality = false }: { screen: 1 | 3 | 4 | 5; slice: Rect; snapshot: Snapshot; reality?: boolean }) {
  const { outcome, fresh, card } = useEndMoment();
  const dawnDelay = useDawnDelay(screen);
  if (!outcome) return null;
  const won = outcome.result === 'won';
  const cx = slice.x + SLICE_W / 2;
  return (
    <g>
      <EndWash outcome={outcome} fresh={fresh} screen={screen} rect={slice} reality={reality} />
      {won && !reality && (
        <motion.g initial={fresh ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ duration: 1.5, delay: dawnDelay + 1 }}>
          <Sparkles slice={slice} />
        </motion.g>
      )}
      {screen === 5 && won && !reality && <Sun slice={slice} fresh={fresh} />}
      {screen === 5 && !won && !reality && <OpenVault fresh={fresh} />}
      <AnimatePresence initial={false}>
      {screen === 5 && card ? (
        <motion.g key="card" initial={fresh ? { opacity: 0, y: 40 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: 'easeOut' }}>
          <rect x={slice.x} y={0} width={SLICE_W} height={SLICE_H} fill="#05040f" opacity={0.45} />
          <g transform={`translate(${cx - CARD_W / 2},${(SLICE_H - CARD_H) / 2})`}>
            <ResultCard snapshot={snapshot} outcome={outcome} reality={reality} />
          </g>
        </motion.g>
      ) : (
        <Banner key="banner" snapshot={snapshot} outcome={outcome} cx={cx} cy={SLICE_H / 2} fresh={fresh} reality={reality} />
      )}
      </AnimatePresence>
    </g>
  );
}
