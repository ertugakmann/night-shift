// Exhibit silhouettes, drawn in full colour and centred on (0, 0). In the dark layer the same shapes
// are re-coloured by CSS (.ex-dark / .ex-broken), so each exhibit is only drawn once.
import { memo } from 'react';
import type { ExhibitKind } from './layout';

const GOLD = '#f2c65e';
const GOLD_DARK = '#c9913c';
const WOOD = '#a8714a';
const WOOD_LIGHT = '#d49a6a';
const INK = '#4a3b7a';
const GLASS = '#c9f1f7';

function gearPath(r: number, teeth: number, depth: number): string {
  const steps = teeth * 4;
  let d = '';
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const rr = i % 4 < 2 ? r : r - depth;
    d += `${i === 0 ? 'M' : 'L'}${(Math.cos(a) * rr).toFixed(1)},${(Math.sin(a) * rr).toFixed(1)}`;
  }
  return `${d}Z`;
}
const BIG_GEAR = gearPath(62, 12, 12);
const SMALL_GEAR = gearPath(34, 8, 9);

function Microscope({ x }: { x: number }) {
  return (
    <g transform={`translate(${x},0)`}>
      <rect x={-52} y={-50} width={104} height={96} rx={16} fill={GLASS} opacity={0.55} stroke="#8f7ae0" strokeWidth={5} />
      <ellipse cx={0} cy={30} rx={28} ry={8} fill={INK} />
      <path d="M-6 28 Q-26 0 -4 -22" fill="none" stroke={INK} strokeWidth={9} strokeLinecap="round" />
      <rect x={-2} y={-36} width={14} height={40} rx={6} fill={GOLD} transform="rotate(18)" />
      <circle cx={-6} cy={-38} r={7} fill={GOLD_DARK} />
      <rect x={-14} y={8} width={28} height={6} rx={3} fill="#ffffff" opacity={0.8} />
    </g>
  );
}

function Microscopes() {
  return (
    <g>
      <Microscope x={-130} />
      <Microscope x={0} />
      <Microscope x={130} />
    </g>
  );
}

function Clockwork() {
  return (
    <g>
      <ellipse cx={0} cy={68} rx={92} ry={18} fill={INK} opacity={0.6} />
      <g className="spin-slow">
        <path d={BIG_GEAR} fill={GOLD} stroke={GOLD_DARK} strokeWidth={4} />
        <circle r={24} fill={GOLD_DARK} />
        <circle r={10} fill="#fff4d2" />
      </g>
      <g transform="translate(70,-38)">
        <g className="spin-slow-reverse">
          <path d={SMALL_GEAR} fill="#c9a6ff" stroke="#8f6fe0" strokeWidth={4} />
          <circle r={11} fill="#8f6fe0" />
        </g>
      </g>
    </g>
  );
}

function Apothecary() {
  const drawers = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      drawers.push(
        <g key={`${row}-${col}`} transform={`translate(${-78 + col * 52},${-28 + row * 34})`}>
          <rect width={46} height={28} rx={6} fill={WOOD_LIGHT} />
          <circle cx={23} cy={14} r={4} fill={GOLD} />
        </g>,
      );
    }
  }
  return (
    <g>
      <rect x={-96} y={-40} width={192} height={120} rx={14} fill={WOOD} />
      {drawers}
      <rect x={-70} y={-78} width={22} height={38} rx={8} fill="#7fe0d6" />
      <rect x={-34} y={-70} width={18} height={30} rx={7} fill="#ff9ec7" />
      <rect x={40} y={-82} width={24} height={42} rx={9} fill="#b9a3ff" />
      <circle cx={52} cy={-86} r={7} fill={GOLD} />
    </g>
  );
}

function Scales() {
  return (
    <g>
      <ellipse cx={0} cy={58} rx={56} ry={14} fill={INK} opacity={0.6} />
      <rect x={-8} y={-44} width={16} height={96} rx={6} fill={GOLD_DARK} />
      <rect x={-34} y={44} width={68} height={14} rx={7} fill={GOLD} />
      <g className="sway">
        <rect x={-84} y={-52} width={168} height={12} rx={6} fill={GOLD} />
        <line x1={-74} y1={-42} x2={-74} y2={-4} stroke={GOLD_DARK} strokeWidth={3} />
        <line x1={74} y1={-42} x2={74} y2={-4} stroke={GOLD_DARK} strokeWidth={3} />
        <path d="M-102 -6 Q-74 22 -46 -6 Z" fill={GOLD} />
        <path d="M46 -6 Q74 22 102 -6 Z" fill={GOLD} />
      </g>
      <circle cx={0} cy={-54} r={11} fill="#fff4d2" />
    </g>
  );
}

/** Corridor wall lamps, spread along the corridor (the exhibit is the whole run of lamps). */
function Lamps() {
  const xs = [-660, -220, 220, 660];
  return (
    <g>
      {xs.map((x) => (
        <g key={x}>
          <g transform={`translate(${x},-62)`}>
            <path d="M-16 0 A16 16 0 0 0 16 0 Z" fill={GOLD} />
            <circle cy={6} r={6} fill="#fff4d2" className="lamp-glow" />
          </g>
          <g transform={`translate(${x},62) rotate(180)`}>
            <path d="M-16 0 A16 16 0 0 0 16 0 Z" fill={GOLD} />
            <circle cy={6} r={6} fill="#fff4d2" className="lamp-glow" />
          </g>
        </g>
      ))}
    </g>
  );
}

/** Stand-in for exhibits on screens that are not drawn yet. */
function Pedestal() {
  return (
    <g>
      <rect x={-50} y={0} width={100} height={46} rx={12} fill={WOOD} />
      <circle cy={-26} r={30} fill="#b9a3ff" />
      <circle cx={-9} cy={-34} r={9} fill="#ffffff" opacity={0.6} />
    </g>
  );
}

const DRAW: Partial<Record<ExhibitKind, () => React.JSX.Element>> = {
  microscopes: Microscopes,
  clockwork: Clockwork,
  apothecary: Apothecary,
  scales: Scales,
  lamps: Lamps,
};

/** Rough half-width of each drawing, for glows and sparkles. */
export const EXHIBIT_RADIUS: Partial<Record<ExhibitKind, number>> = {
  microscopes: 190,
  clockwork: 100,
  apothecary: 110,
  scales: 100,
  lamps: 0,
};

export const ExhibitArt = memo(function ExhibitArt({ kind }: { kind: ExhibitKind }) {
  const Draw = DRAW[kind] ?? Pedestal;
  return <Draw />;
});
