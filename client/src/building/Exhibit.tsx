// Exhibit silhouettes and museum decor, drawn in full colour and centred on (0, 0). In the dark layer
// the same shapes are re-coloured by CSS (.ex-dark / .ex-broken), so each piece is only drawn once.
import { memo } from 'react';
import type { ExhibitKind } from './layout';

const GOLD = '#f2c65e';
const GOLD_DARK = '#c9913c';
const WOOD = '#a8714a';
const WOOD_LIGHT = '#d49a6a';
const INK = '#4a3b7a';
const GLASS = '#c9f1f7';
const STONE = '#e9e1f2';
const STONE_DARK = '#bfb2d6';
const VELVET = '#a04f86';

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
const BIG_GEAR = gearPath(58, 12, 12);
const SMALL_GEAR = gearPath(32, 8, 9);

/** A stone plinth that exhibits stand on. Top surface at y = 0. */
function Plinth({ w }: { w: number }) {
  return (
    <g>
      <rect x={-w / 2} y={0} width={w} height={34} rx={8} fill={STONE_DARK} />
      <rect x={-w / 2 - 8} y={-8} width={w + 16} height={14} rx={6} fill={STONE} />
    </g>
  );
}

function Microscope({ x }: { x: number }) {
  return (
    <g transform={`translate(${x},0)`}>
      {/* glass case on a small plinth */}
      <rect x={-58} y={42} width={116} height={22} rx={6} fill={STONE_DARK} />
      <rect x={-54} y={-62} width={108} height={106} rx={14} fill={GLASS} opacity={0.5} stroke="#8f7ae0" strokeWidth={5} />
      {/* microscope, side view */}
      <rect x={-30} y={28} width={58} height={12} rx={6} fill={INK} />
      <path d="M-14 30 Q-34 -6 -10 -30" fill="none" stroke={INK} strokeWidth={10} strokeLinecap="round" />
      <rect x={-22} y={4} width={40} height={7} rx={3} fill="#8f7ae0" />
      <g transform="rotate(20)">
        <rect x={-6} y={-48} width={16} height={46} rx={6} fill={GOLD} />
        <rect x={-9} y={-56} width={22} height={12} rx={5} fill={GOLD_DARK} />
        <rect x={-3} y={-4} width={10} height={10} rx={3} fill={GOLD_DARK} />
      </g>
      <circle cx={-26} cy={-2} r={7} fill={GOLD_DARK} />
      {/* glass shine */}
      <path d="M-42 -50 L-30 -50 L-46 -20 L-50 -26 Z" fill="#ffffff" opacity={0.6} />
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

/** The Clockwork Analyser: a big brass gear machine on a plinth. */
function Clockwork() {
  return (
    <g>
      <g transform="translate(0,62)">
        <Plinth w={150} />
      </g>
      <rect x={-12} y={20} width={24} height={44} rx={6} fill={GOLD_DARK} />
      <g className="spin-slow">
        <path d={BIG_GEAR} fill={GOLD} stroke={GOLD_DARK} strokeWidth={4} />
        <circle r={24} fill={GOLD_DARK} />
        <circle r={10} fill="#fff4d2" />
      </g>
      <g transform="translate(66,-36)">
        <g className="spin-slow-reverse">
          <path d={SMALL_GEAR} fill="#c9a6ff" stroke="#8f6fe0" strokeWidth={4} />
          <circle r={11} fill="#8f6fe0" />
        </g>
      </g>
      {/* a little dial */}
      <g transform="translate(-62,-30)">
        <circle r={20} fill="#fff4d2" stroke={GOLD_DARK} strokeWidth={4} />
        <line x1={0} y1={0} x2={0} y2={-13} stroke={INK} strokeWidth={3} strokeLinecap="round" />
        <line x1={0} y1={0} x2={9} y2={4} stroke={INK} strokeWidth={3} strokeLinecap="round" />
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
      <rect x={-104} y={-46} width={208} height={8} rx={4} fill={WOOD_LIGHT} />
      <rect x={-96} y={-40} width={192} height={120} rx={14} fill={WOOD} />
      {drawers}
      <rect x={-90} y={74} width={20} height={14} rx={4} fill={WOOD} />
      <rect x={70} y={74} width={20} height={14} rx={4} fill={WOOD} />
      {/* bottles */}
      <rect x={-72} y={-86} width={24} height={40} rx={9} fill="#7fe0d6" />
      <rect x={-66} y={-96} width={12} height={12} rx={3} fill={GOLD_DARK} />
      <circle cx={-26} cy={-62} r={16} fill="#ff9ec7" />
      <rect x={-31} y={-84} width={10} height={10} rx={3} fill={GOLD_DARK} />
      <rect x={36} y={-90} width={26} height={44} rx={10} fill="#b9a3ff" />
      <circle cx={49} cy={-96} r={7} fill={GOLD} />
      <path d="M2 -46 L10 -78 L18 -46 Z" fill="#a8e07a" />
    </g>
  );
}

function Scales() {
  return (
    <g>
      <g transform="translate(0,58)">
        <Plinth w={120} />
      </g>
      <rect x={-8} y={-44} width={16} height={100} rx={6} fill={GOLD_DARK} />
      <rect x={-34} y={44} width={68} height={14} rx={7} fill={GOLD} />
      <g className="sway">
        <rect x={-84} y={-52} width={168} height={12} rx={6} fill={GOLD} />
        <line x1={-74} y1={-42} x2={-74} y2={-4} stroke={GOLD_DARK} strokeWidth={3} />
        <line x1={74} y1={-42} x2={74} y2={-4} stroke={GOLD_DARK} strokeWidth={3} />
        <path d="M-102 -6 Q-74 24 -46 -6 Z" fill={GOLD} />
        <path d="M46 -6 Q74 24 102 -6 Z" fill={GOLD} />
        <circle cx={-74} cy={-12} r={8} fill="#c9a6ff" />
        <rect x={64} y={-20} width={20} height={14} rx={4} fill="#7fe0d6" />
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
          <g transform={`translate(${x},-82)`}>
            <path d="M-20 0 A20 20 0 0 0 20 0 Z" fill={GOLD} />
            <circle cy={8} r={8} fill="#fff4d2" className="lamp-glow" />
          </g>
          <g transform={`translate(${x},82) rotate(180)`}>
            <path d="M-20 0 A20 20 0 0 0 20 0 Z" fill={GOLD} />
            <circle cy={8} r={8} fill="#fff4d2" className="lamp-glow" />
          </g>
        </g>
      ))}
    </g>
  );
}

/** The Letter Press: an iron printing press with a big brass wheel, on a wooden table. */
function LetterPress() {
  return (
    <g>
      {/* table */}
      <rect x={-118} y={36} width={236} height={18} rx={6} fill={WOOD_LIGHT} />
      <rect x={-104} y={52} width={16} height={22} rx={4} fill={WOOD} />
      <rect x={88} y={52} width={16} height={22} rx={4} fill={WOOD} />
      {/* press frame */}
      <rect x={-64} y={-86} width={18} height={124} rx={6} fill={INK} />
      <rect x={46} y={-86} width={18} height={124} rx={6} fill={INK} />
      <rect x={-80} y={-102} width={160} height={24} rx={8} fill={INK} />
      <rect x={-6} y={-78} width={12} height={58} fill={GOLD_DARK} />
      <rect x={-48} y={-22} width={96} height={16} rx={5} fill="#8f7ae0" />
      {/* paper on the bed */}
      <rect x={-44} y={18} width={88} height={14} rx={3} fill="#fff7e6" />
      <line x1={-34} y1={25} x2={30} y2={25} stroke={INK} strokeWidth={2} opacity={0.5} />
      {/* wheel */}
      <g transform="translate(92,-36)">
        <g className="spin-slow">
          <circle r={34} fill="none" stroke={GOLD} strokeWidth={8} />
          {[0, 60, 120].map((a) => (
            <line key={a} x1={-30} y1={0} x2={30} y2={0} stroke={GOLD} strokeWidth={5} transform={`rotate(${a})`} />
          ))}
          <circle r={8} fill={GOLD_DARK} />
        </g>
      </g>
      {/* a little stack of letters */}
      <g transform="translate(-92,22)">
        <rect x={-18} y={-4} width={36} height={22} rx={3} fill="#fff7e6" transform="rotate(-8)" />
        <rect x={-18} y={-12} width={36} height={22} rx={3} fill="#fbe7c4" transform="rotate(6)" />
        <path d="M-18 -12 L0 2 L18 -12" fill="none" stroke={GOLD_DARK} strokeWidth={2} transform="rotate(6)" />
      </g>
    </g>
  );
}

/** Brass Turnstiles: three gates with rotating arms. */
function Turnstiles() {
  return (
    <g>
      {[-130, 0, 130].map((x) => (
        <g key={x} transform={`translate(${x},0)`}>
          <ellipse cy={42} rx={34} ry={9} fill={INK} opacity={0.6} />
          <rect x={-12} y={-46} width={24} height={88} rx={8} fill={GOLD_DARK} />
          <rect x={-16} y={-58} width={32} height={18} rx={7} fill={GOLD} />
          <g transform="translate(0,-34)">
            <g className="sway">
              <rect x={0} y={-5} width={58} height={10} rx={5} fill={GOLD} />
              <rect x={-58} y={-5} width={58} height={10} rx={5} fill={GOLD} transform="rotate(35)" />
            </g>
            <circle r={9} fill="#fff4d2" />
          </g>
        </g>
      ))}
    </g>
  );
}

/** The Master Key Cabinet: glass-fronted cabinet of keys, with the big master key on top. */
function KeyCabinet() {
  const keys = [-66, -33, 0, 33, 66];
  return (
    <g>
      <rect x={-104} y={-82} width={208} height={154} rx={14} fill={WOOD} />
      <rect x={-90} y={-68} width={180} height={124} rx={10} fill={GLASS} opacity={0.5} />
      <rect x={-84} y={-58} width={168} height={8} rx={4} fill={WOOD_LIGHT} />
      {keys.map((x, i) => (
        <g key={x} transform={`translate(${x},-50)`}>
          <line x1={0} y1={0} x2={0} y2={12} stroke={GOLD_DARK} strokeWidth={3} />
          <circle cy={22} r={10} fill="none" stroke={i === 2 ? "#c9a6ff" : GOLD} strokeWidth={5} />
          <rect x={-3} y={30} width={6} height={30} rx={2} fill={i === 2 ? "#c9a6ff" : GOLD} />
          <rect x={0} y={48} width={10} height={5} fill={i === 2 ? "#c9a6ff" : GOLD} />
          <rect x={0} y={56} width={7} height={4} fill={i === 2 ? "#c9a6ff" : GOLD} />
        </g>
      ))}
      <path d="M-40 -68 L-28 -68 L-46 -30 L-52 -36 Z" fill="#ffffff" opacity={0.6} />
      <rect x={-96} y={70} width={20} height={14} rx={4} fill={WOOD} />
      <rect x={76} y={70} width={20} height={14} rx={4} fill={WOOD} />
      {/* the master key on a velvet cushion */}
      <g transform="translate(0,-98)">
        <rect x={-62} y={-8} width={124} height={22} rx={11} fill="#a04f86" />
        <circle cx={-34} cy={-6} r={16} fill="none" stroke={GOLD} strokeWidth={7} />
        <rect x={-18} y={-10} width={70} height={9} rx={3} fill={GOLD} />
        <rect x={36} y={-2} width={9} height={14} fill={GOLD} />
        <rect x={48} y={-2} width={7} height={10} fill={GOLD} />
      </g>
    </g>
  );
}

/** Stand-in for exhibits on screens that are not drawn yet. */
function Pedestal() {
  return (
    <g>
      <g transform="translate(0,4)">
        <Plinth w={100} />
      </g>
      <circle cy={-30} r={32} fill="#b9a3ff" />
      <circle cx={-10} cy={-40} r={10} fill="#ffffff" opacity={0.6} />
    </g>
  );
}

const DRAW: Partial<Record<ExhibitKind, () => React.JSX.Element>> = {
  microscopes: Microscopes,
  clockwork: Clockwork,
  apothecary: Apothecary,
  scales: Scales,
  lamps: Lamps,
  letters: LetterPress,
  turnstile: Turnstiles,
  keys: KeyCabinet,
};

/** Exhibits that stand free, without a velvet rope in front. */
export const NO_BARRIER: ReadonlySet<ExhibitKind> = new Set<ExhibitKind>(['lamps', 'turnstile']);

/** Half-width and the y of the bottom edge of each drawing at scale 1 (for barriers, glows, cracks). */
export const EXHIBIT_BOX: Partial<Record<ExhibitKind, { half: number; bottom: number }>> = {
  microscopes: { half: 190, bottom: 64 },
  clockwork: { half: 100, bottom: 96 },
  apothecary: { half: 104, bottom: 88 },
  scales: { half: 100, bottom: 92 },
  lamps: { half: 0, bottom: 0 },
  letters: { half: 126, bottom: 74 },
  turnstile: { half: 170, bottom: 50 },
  keys: { half: 106, bottom: 84 },
};
const DEFAULT_BOX = { half: 60, bottom: 38 };

export function exhibitBox(kind: ExhibitKind, scale = 1): { half: number; bottom: number } {
  const box = EXHIBIT_BOX[kind] ?? DEFAULT_BOX;
  return { half: box.half * scale, bottom: box.bottom * scale };
}

export const ExhibitArt = memo(function ExhibitArt({ kind }: { kind: ExhibitKind }) {
  const Draw = DRAW[kind] ?? Pedestal;
  return <Draw />;
});

// ---------- Museum decor ----------

/** A fluted stone column, front view, standing on (x, baseY). */
export function Column({ x, baseY, height }: { x: number; baseY: number; height: number }) {
  const h = height;
  return (
    <g transform={`translate(${x},${baseY})`}>
      <rect x={-34} y={-18} width={68} height={18} rx={5} fill={STONE_DARK} />
      <rect x={-22} y={-h + 26} width={44} height={h - 44} fill={STONE} />
      {[-11, 0, 11].map((fx) => (
        <line key={fx} x1={fx} y1={-h + 32} x2={fx} y2={-24} stroke={STONE_DARK} strokeWidth={3} />
      ))}
      <rect x={-30} y={-h + 12} width={60} height={16} rx={5} fill={STONE_DARK} />
      <circle cx={-30} cy={-h + 20} r={8} fill={STONE} />
      <circle cx={30} cy={-h + 20} r={8} fill={STONE} />
      <rect x={-38} y={-h} width={76} height={14} rx={4} fill={STONE} />
    </g>
  );
}

const PAINTINGS = [
  // rolling hills under a sun
  (w: number, h: number) => (
    <>
      <rect width={w} height={h} fill="#9fd7ef" />
      <circle cx={w * 0.75} cy={h * 0.3} r={h * 0.16} fill="#ffd27a" />
      <path d={`M0 ${h * 0.7} Q${w * 0.3} ${h * 0.45} ${w * 0.6} ${h * 0.68} T${w} ${h * 0.6} V${h} H0 Z`} fill="#8fd17f" />
      <path d={`M0 ${h * 0.85} Q${w * 0.4} ${h * 0.7} ${w} ${h * 0.86} V${h} H0 Z`} fill="#5fb06d" />
    </>
  ),
  // night sea with a moon
  (w: number, h: number) => (
    <>
      <rect width={w} height={h} fill="#3f4fa8" />
      <circle cx={w * 0.3} cy={h * 0.32} r={h * 0.14} fill="#fff4d2" />
      <path d={`M0 ${h * 0.65} Q${w * 0.25} ${h * 0.58} ${w * 0.5} ${h * 0.65} T${w} ${h * 0.65} V${h} H0 Z`} fill="#3ee0d8" opacity={0.8} />
    </>
  ),
  // a flower in a vase
  (w: number, h: number) => (
    <>
      <rect width={w} height={h} fill="#f6d6e6" />
      <rect x={w * 0.42} y={h * 0.55} width={w * 0.16} height={h * 0.3} rx={6} fill="#9c86f5" />
      <line x1={w / 2} y1={h * 0.55} x2={w / 2} y2={h * 0.3} stroke="#5fb06d" strokeWidth={4} />
      <circle cx={w / 2} cy={h * 0.27} r={h * 0.12} fill="#ff9ec7" />
      <circle cx={w / 2} cy={h * 0.27} r={h * 0.05} fill="#ffd27a" />
    </>
  ),
];

/** A gilded picture frame hanging on the top wall. `top` is the inner edge of the wall. */
export function Frame({ x, top, variant }: { x: number; top: number; variant: number }) {
  const w = 150;
  const h = 96;
  const paint = PAINTINGS[variant % PAINTINGS.length];
  return (
    <g transform={`translate(${x - w / 2 - 12},${top + 10})`}>
      <rect width={w + 24} height={h + 24} rx={8} fill={GOLD} />
      <rect x={6} y={6} width={w + 12} height={h + 12} rx={5} fill={GOLD_DARK} />
      <g transform="translate(12,12)">
        <clipPath id={`frame-${variant}-${x}`}>
          <rect width={w} height={h} rx={3} />
        </clipPath>
        <g clipPath={`url(#frame-${variant}-${x})`}>{paint(w, h)}</g>
      </g>
    </g>
  );
}

/** A marble bust on a plinth. Stands on (x, y). */
export function Statue({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={-44} y={-66} width={88} height={66} rx={8} fill={STONE_DARK} />
      <rect x={-52} y={-76} width={104} height={14} rx={6} fill={STONE} />
      <path d="M-44 -76 Q-40 -116 0 -118 Q40 -116 44 -76 Z" fill={STONE} />
      <circle cy={-142} r={30} fill={STONE} />
      <path d="M-30 -150 Q-26 -178 0 -176 Q26 -178 30 -150 Q14 -162 0 -160 Q-14 -162 -30 -150 Z" fill={STONE_DARK} />
      <path d="M-28 -128 Q-36 -150 -24 -166 M28 -128 Q36 -150 24 -166" fill="none" stroke="#a8e07a" strokeWidth={6} strokeLinecap="round" />
      <circle cx={-10} cy={-150} r={6} fill="#ffffff" opacity={0.5} />
    </g>
  );
}

/** The museum front door, set in the bottom wall at (x, y). */
export function FrontDoor({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <path d="M-90 0 V-70 Q-90 -110 0 -112 Q90 -110 90 -70 V0 Z" fill={STONE_DARK} />
      <path d="M-74 0 V-66 Q-74 -96 0 -98 Q74 -96 74 -66 V0 Z" fill={WOOD} />
      <line x1={0} y1={-98} x2={0} y2={0} stroke={WOOD_LIGHT} strokeWidth={5} />
      <circle cx={-12} cy={-44} r={6} fill={GOLD} />
      <circle cx={12} cy={-44} r={6} fill={GOLD} />
      <rect x={-56} y={-80} width={40} height={26} rx={6} fill={WOOD_LIGHT} opacity={0.6} />
      <rect x={16} y={-80} width={40} height={26} rx={6} fill={WOOD_LIGHT} opacity={0.6} />
    </g>
  );
}

/** A brass letterbox on the left wall at (x, y), with letters fallen on the floor. */
export function Letterbox({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={0} y={-44} width={26} height={88} rx={8} fill={GOLD} />
      <rect x={8} y={-30} width={8} height={60} rx={4} fill={GOLD_DARK} />
      {[
        [56, -30, -14],
        [78, 18, 10],
        [48, 44, 4],
      ].map(([lx, ly, r], i) => (
        <g key={i} transform={`translate(${lx},${ly}) rotate(${r})`}>
          <rect x={-22} y={-14} width={44} height={28} rx={3} fill="#fff7e6" />
          <path d="M-22 -14 L0 4 L22 -14" fill="none" stroke={GOLD_DARK} strokeWidth={2} />
        </g>
      ))}
    </g>
  );
}

/** Velvet rope on brass posts, in front of an exhibit. */
export function Barrier({ x, y, half }: { x: number; y: number; half: number }) {
  const posts = [x - half, x + half];
  const mid = x;
  return (
    <g>
      <path
        d={`M${posts[0]} ${y - 22} Q${(posts[0] + mid) / 2} ${y + 6} ${mid} ${y - 22} Q${(mid + posts[1]) / 2} ${y + 6} ${posts[1]} ${y - 22}`}
        fill="none"
        stroke={VELVET}
        strokeWidth={9}
        strokeLinecap="round"
      />
      {[...posts, mid].map((px) => (
        <g key={px} transform={`translate(${px},${y})`}>
          <ellipse cy={2} rx={14} ry={6} fill={GOLD_DARK} />
          <rect x={-5} y={-26} width={10} height={28} rx={4} fill={GOLD} />
          <circle cy={-28} r={8} fill={GOLD} />
        </g>
      ))}
    </g>
  );
}
