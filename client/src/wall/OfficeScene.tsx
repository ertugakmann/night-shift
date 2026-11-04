// The head guard's office around the monitors and the desk: drawn in code, warm and dim, a bit cosy.
// OfficeBack sits behind the live screens; OfficeFront holds the props that overlap the desk edges.
import { useMemo } from 'react';
import { motion } from 'motion/react';
import { SCREENS, type Snapshot } from '@night-shift/shared';
import { BEAT, after, powerOnAt } from '../intro/timeline';
import { BEZEL, DESK, MONITORS, MONITOR_ORDER, STAGE_H, STAGE_W } from './layout';

const GOLD = '#f2c65e';
const GOLD_DARK = '#c9913c';
const WOOD = '#6b4630';
const WOOD_DARK = '#4a2f20';

function Window() {
  const drops = useMemo(() => {
    let seed = 11;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    return Array.from({ length: 34 }, () => ({ x: 420 + rnd() * 760, y: 6 + rnd() * 40, d: rnd() * 0.9, len: 10 + rnd() * 10 }));
  }, []);
  return (
    <g>
      <rect x={400} y={6} width={800} height={52} rx={10} fill="#3a2f6e" />
      <clipPath id="wall-window">
        <rect x={410} y={12} width={780} height={40} rx={6} />
      </clipPath>
      <g clipPath="url(#wall-window)">
        <rect x={410} y={12} width={780} height={40} fill="#0d1a3a" />
        <circle cx={1110} cy={28} r={11} fill="#fff4d2" opacity={0.9} />
        <circle cx={1116} cy={24} r={10} fill="#0d1a3a" />
        {[470, 610, 880, 990].map((x) => (
          <circle key={x} cx={x} cy={22 + (x % 3) * 6} r={1.6} fill="#fff4d2" opacity={0.7} />
        ))}
        {drops.map((d, i) => (
          <line
            key={i}
            x1={d.x}
            y1={d.y}
            x2={d.x - 3}
            y2={d.y + d.len}
            stroke="#9fd7ef"
            strokeWidth={1.6}
            opacity={0.55}
            className="rain"
            style={{ animationDelay: `${-d.d}s` }}
          />
        ))}
      </g>
      {[600, 800, 1000].map((x) => (
        <rect key={x} x={x - 3} y={12} width={6} height={40} fill="#3a2f6e" />
      ))}
    </g>
  );
}

function Monitor({ id, snapshot }: { id: 1 | 3 | 4 | 5; snapshot: Snapshot | null }) {
  const b = MONITORS[id];
  const on = !snapshot || snapshot.phase !== 'intro' || snapshot.introMs >= powerOnAt(id);
  return (
    <g>
      {/* wall bracket and cable down to the desk */}
      <rect x={b.x + b.w / 2 - 14} y={b.y + b.h + BEZEL} width={28} height={18} rx={4} fill="#2a2263" />
      <path d={`M${b.x + b.w - 30} ${b.y + b.h + BEZEL} q 10 20 -4 40`} fill="none" stroke="#1b1540" strokeWidth={5} />
      <rect x={b.x - BEZEL} y={b.y - BEZEL} width={b.w + BEZEL * 2} height={b.h + BEZEL * 2} rx={14} fill="#1d1840" stroke="#3a3186" strokeWidth={4} />
      <circle cx={b.x + b.w + 2} cy={b.y + b.h + 6} r={3.5} fill={on ? '#3ee0d8' : '#ff6b6b'} opacity={0.9} />
      {/* brass name plate */}
      <rect x={b.x + b.w / 2 - 88} y={b.y + b.h + 19} width={176} height={20} rx={6} fill="#5a3a22" stroke={GOLD_DARK} strokeWidth={2} />
      <text x={b.x + b.w / 2} y={b.y + b.h + 34} textAnchor="middle" className="game-text" fontSize={15} fontWeight={600} fill={GOLD}>
        {id} · {SCREENS[id].name}
      </text>
    </g>
  );
}

/** The office behind the live screens: wall, window with rain, monitors, desk top, lamp, mug. */
export function OfficeBack({ snapshot }: { snapshot: Snapshot | null }) {
  return (
    <svg viewBox={`0 0 ${STAGE_W} ${STAGE_H}`} className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="wall-paper" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b1545" />
          <stop offset="1" stopColor="#2a2263" />
        </linearGradient>
        <pattern id="wall-stripes" width={40} height={40} patternUnits="userSpaceOnUse">
          <rect width={20} height={40} fill="#ffffff" opacity={0.025} />
        </pattern>
        <linearGradient id="desk-top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={WOOD} />
          <stop offset="1" stopColor={WOOD_DARK} />
        </linearGradient>
      </defs>
      <rect width={STAGE_W} height={STAGE_H} fill="url(#wall-paper)" />
      <rect width={STAGE_W} height={300} fill="url(#wall-stripes)" />
      <Window />
      {/* desk */}
      <rect x={0} y={300} width={STAGE_W} height={STAGE_H - 300} fill="url(#desk-top)" />
      <rect x={0} y={300} width={STAGE_W} height={10} fill="#8a5a3a" />
      <rect x={DESK.x - 14} y={DESK.y - 10} width={DESK.w + 28} height={DESK.h + 20} rx={16} fill="#2a1a12" />
      {MONITOR_ORDER.map((id) => (
        <Monitor key={id} id={id} snapshot={snapshot} />
      ))}
      {/* books on the left, a notepad on the right */}
      <g transform="translate(70,560)">
        <rect x={0} y={0} width={150} height={30} rx={5} fill="#9c86f5" />
        <rect x={10} y={-26} width={130} height={28} rx={5} fill="#3ee0d8" opacity={0.85} />
        <rect x={4} y={-50} width={140} height={26} rx={5} fill="#f2994a" opacity={0.9} />
      </g>
      <g transform="translate(1360,700) rotate(-6)">
        <rect width={170} height={130} rx={8} fill="#fff4e0" />
        {[30, 55, 80, 105].map((y) => (
          <line key={y} x1={16} y1={y} x2={154} y2={y} stroke="#c9b8a0" strokeWidth={2} />
        ))}
        <text x={18} y={24} className="game-text" fontSize={17} fontWeight={600} fill="#5a4a7a">
          Night shift
        </text>
        <rect x={120} y={60} width={70} height={8} rx={4} fill={GOLD_DARK} transform="rotate(28 120 60)" />
      </g>
      <g transform="translate(1388,470)">
        <rect x={-6} y={-24} width={176} height={30} rx={6} fill="#5a3a22" stroke={GOLD_DARK} strokeWidth={2} />
        <text x={82} y={-3} textAnchor="middle" className="game-text" fontSize={16} fontWeight={700} fill={GOLD}>
          HEAD GUARD
        </text>
      </g>
    </svg>
  );
}

/** Props in front of the desk: the lamp and its light, the coffee mug with steam. */
export function OfficeFront({ snapshot }: { snapshot: Snapshot | null }) {
  const lampOn = after(snapshot, BEAT.lamp);
  const mug = after(snapshot, BEAT.mug);
  return (
    <svg viewBox={`0 0 ${STAGE_W} ${STAGE_H}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <radialGradient id="lamp-light" cx="0.5" cy="0" r="1">
          <stop offset="0" stopColor="#ffd27a" stopOpacity={0.22} />
          <stop offset="1" stopColor="#ffd27a" stopOpacity={0} />
        </radialGradient>
      </defs>
      {/* lamp light pooling on the left of the desk */}
      <motion.ellipse
        cx={200}
        cy={660}
        rx={300}
        ry={260}
        fill="url(#lamp-light)"
        initial={false}
        animate={{ opacity: lampOn ? 1 : 0 }}
        transition={{ duration: 0.25 }}
        className={lampOn ? 'flicker' : ''}
      />
      {/* desk lamp */}
      <g>
        <ellipse cx={150} cy={862} rx={70} ry={18} fill="#2a1d5c" />
        <path d="M150 856 L120 640 L230 470" fill="none" stroke="#3a2f7a" strokeWidth={16} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={120} cy={640} r={13} fill={GOLD_DARK} />
        <g transform="translate(232,468) rotate(28)">
          <path d="M-56 0 L56 0 L34 -64 L-34 -64 Z" fill="#3ee0d8" />
          <ellipse cy={0} rx={56} ry={12} fill={lampOn ? '#fff4c2' : '#2a2263'} style={{ transition: 'fill 200ms ease' }} />
        </g>
      </g>
      {/* coffee mug */}
      <motion.g
        initial={false}
        animate={mug ? { y: 0, opacity: 1 } : { y: -60, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 16 }}
      >
        <g transform="translate(1450,600)">
          <ellipse cy={64} rx={58} ry={12} fill="#000" opacity={0.3} />
          <path d="M42 0 q34 6 30 30 q-4 22 -32 22" fill="none" stroke="#f2994a" strokeWidth={11} />
          <rect x={-44} y={-10} width={88} height={76} rx={14} fill="#f2994a" />
          <ellipse cy={-10} rx={44} ry={11} fill="#5a3a22" />
          <text y={34} textAnchor="middle" className="game-text" fontSize={16} fontWeight={700} fill="#fff4e0">
            #1 GUARD
          </text>
          {mug &&
            [-16, 4, 22].map((x, i) => (
              <path
                key={x}
                d={`M${x} -24 q -8 -14 0 -28 q 8 -14 0 -28`}
                fill="none"
                stroke="#fff4e0"
                strokeWidth={4}
                strokeLinecap="round"
                className="steam"
                style={{ animationDelay: `${i * 0.8}s` }}
              />
            ))}
        </g>
      </motion.g>
    </svg>
  );
}
