// Screen 5 extras: the museum clock and care gauge in the stone tower, the patient impact plaques,
// and the red glow that builds as the gang closes in on the Vault.
import { IMPACT_LABELS, IMPACT_TYPES, type ImpactType, type Snapshot } from '@night-shift/shared';
import { gameClock, worldOf } from '../game/view';
import { CLOCK_TOWER, SLICE_H, SLICE_W, type Rect } from './layout';

const GOLD = '#f2c65e';
const GOLD_DARK = '#c9913c';
const WOOD = '#a8714a';
const CREAM = '#fff4d2';
const INK = '#2a1d5c';

/** The stone tower that holds the clock and the plaques. */
function Tower() {
  const r = CLOCK_TOWER;
  return (
    <g>
      <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={18} fill="#241c55" />
      <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={18} fill="none" stroke="#6f61d0" strokeWidth={16} />
      <rect x={r.x + 14} y={r.y + 14} width={r.w - 28} height={r.h - 28} rx={12} fill="none" stroke={GOLD} strokeWidth={4} opacity={0.6} />
    </g>
  );
}

/** The museum clock: the hour hand travels from midnight (12) to dawn (6) over the night. */
function MuseumClock({ snapshot }: { snapshot: Snapshot }) {
  const w = worldOf(snapshot);
  const cx = CLOCK_TOWER.x + CLOCK_TOWER.w / 2;
  const cy = 222;
  const progress = Math.min(1, snapshot.timeMs / w.ms.night);
  const hourAngle = progress * 180; // 12 o'clock → 6 o'clock
  const minuteAngle = ((snapshot.timeMs / w.ms.gameHour) % 1) * 360;
  const ticks = Array.from({ length: 12 }, (_, i) => i * 30);
  // Night arc on the rim from 12 to 6, filling as the night passes.
  const arcR = 150;
  const end = (Math.PI / 180) * (hourAngle - 90);
  const arcPath = `M${cx} ${cy - arcR} A${arcR} ${arcR} 0 ${hourAngle > 180 ? 1 : 0} 1 ${cx + Math.cos(end) * arcR} ${cy + Math.sin(end) * arcR}`;
  return (
    <g transform={`translate(${cx},${cy}) scale(0.9) translate(${-cx},${-cy})`}>
      {/* wooden case with a little crown */}
      <path d={`M${cx - 70} ${cy - 196} Q${cx} ${cy - 250} ${cx + 70} ${cy - 196} Z`} fill={WOOD} />
      <circle cx={cx} cy={cy - 232} r={10} fill={GOLD} />
      <circle cx={cx} cy={cy} r={196} fill={WOOD} />
      <circle cx={cx} cy={cy} r={180} fill={CREAM} stroke={GOLD} strokeWidth={14} />
      {/* the night so far */}
      <circle cx={cx} cy={cy} r={arcR} fill="none" stroke="#3a2f6e" strokeWidth={14} opacity={0.15} />
      {progress > 0.002 && <path d={arcPath} fill="none" stroke="#6f61d0" strokeWidth={14} strokeLinecap="round" opacity={0.75} />}
      {ticks.map((a) => (
        <rect
          key={a}
          x={cx - 4}
          y={cy - 172}
          width={8}
          height={a % 90 === 0 ? 26 : 16}
          rx={3}
          fill={INK}
          transform={`rotate(${a} ${cx} ${cy})`}
        />
      ))}
      {/* moon at midnight, sun at dawn */}
      <g transform={`translate(${cx},${cy - 112})`}>
        <circle r={20} fill="#9c86f5" />
        <circle cx={9} cy={-6} r={17} fill={CREAM} />
      </g>
      <g transform={`translate(${cx},${cy + 112})`}>
        <circle r={16} fill="#ffb84d" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <rect key={a} x={-2.5} y={-29} width={5} height={9} rx={2} fill="#ffb84d" transform={`rotate(${a})`} />
        ))}
      </g>
      {/* digital night time */}
      <text x={cx} y={cy + 62} textAnchor="middle" className="game-text" fontSize={38} fontWeight={600} fill={INK}>
        {gameClock(snapshot)}
      </text>
      {/* hands */}
      <rect x={cx - 5} y={cy - 138} width={10} height={146} rx={5} fill={INK} opacity={0.75} transform={`rotate(${minuteAngle} ${cx} ${cy})`} />
      <rect x={cx - 9} y={cy - 98} width={18} height={106} rx={9} fill={GOLD_DARK} transform={`rotate(${hourAngle} ${cx} ${cy})`} />
      <circle cx={cx} cy={cy} r={16} fill={GOLD} stroke={GOLD_DARK} strokeWidth={4} />
    </g>
  );
}

/** Care score as a brass gauge: how much of the museum (the hospital's care) is still running. */
function CareGauge({ snapshot }: { snapshot: Snapshot }) {
  const care = Math.round(snapshot.care);
  const cx = CLOCK_TOWER.x + CLOCK_TOWER.w / 2;
  const cy = 560;
  const r = 110;
  const point = (v: number, rr: number) => {
    const a = Math.PI + (v / 100) * Math.PI;
    return `${cx + Math.cos(a) * rr} ${cy + Math.sin(a) * rr}`;
  };
  const band = (from: number, to: number, color: string) => (
    <path d={`M${point(from, r)} A${r} ${r} 0 0 1 ${point(to, r)}`} fill="none" stroke={color} strokeWidth={22} />
  );
  const color = care >= 75 ? '#3ee0d8' : care >= 50 ? '#f2994a' : '#ff6b6b';
  const needle = -90 + (care / 100) * 180;
  return (
    <g>
      <path d={`M${cx - r - 24} ${cy + 14} A${r + 24} ${r + 24} 0 0 1 ${cx + r + 24} ${cy + 14} Z`} fill={WOOD} />
      <path d={`M${cx - r - 12} ${cy + 6} A${r + 12} ${r + 12} 0 0 1 ${cx + r + 12} ${cy + 6} Z`} fill={CREAM} stroke={GOLD} strokeWidth={8} />
      {band(0, 50, '#ff6b6b')}
      {band(50, 75, '#f2994a')}
      {band(75, 100, '#3ee0d8')}
      <g transform={`rotate(${needle} ${cx} ${cy})`} style={{ transition: 'transform 600ms ease' }}>
        <rect x={cx - 5} y={cy - r + 8} width={10} height={r - 8} rx={5} fill={INK} />
      </g>
      <circle cx={cx} cy={cy} r={14} fill={GOLD} stroke={GOLD_DARK} strokeWidth={4} />
      <g transform={`translate(${cx},${cy + 62})`} className="game-text">
        <rect x={-110} y={-42} width={220} height={60} rx={14} fill={INK} stroke={GOLD} strokeWidth={4} />
        <text x={-92} y={-2} fontSize={22} fontWeight={600} fill="#e8e0ff" opacity={0.85}>
          CARE
        </text>
        <text x={92} y={6} textAnchor="end" fontSize={48} fontWeight={700} fill={color}>
          {care}
        </text>
      </g>
    </g>
  );
}

export function ImpactIcon({ type }: { type: ImpactType }) {
  switch (type) {
    case 'tests':
      return (
        <g>
          <rect x={-8} y={-18} width={16} height={34} rx={8} fill="#c9f1f7" stroke="#3ee0d8" strokeWidth={3} />
          <rect x={-6} y={2} width={12} height={12} rx={6} fill="#ff9ec7" />
        </g>
      );
    case 'medicines':
      return (
        <g transform="rotate(-35)">
          <rect x={-20} y={-9} width={40} height={18} rx={9} fill="#fff7e6" />
          <path d="M0 -9 H11 A9 9 0 0 1 11 9 H0 Z" fill="#9c86f5" />
        </g>
      );
    case 'surgeries':
      return (
        <g>
          <rect x={-20} y={-6} width={40} height={14} rx={6} fill="#c9f1f7" />
          <circle cx={-12} cy={-12} r={7} fill="#fff7e6" />
          <rect x={-22} y={8} width={6} height={10} rx={2} fill="#c9f1f7" />
          <rect x={16} y={8} width={6} height={10} rx={2} fill="#c9f1f7" />
        </g>
      );
    case 'ambulances':
      return (
        <g>
          <rect x={-22} y={-12} width={44} height={22} rx={6} fill="#fff7e6" />
          <rect x={8} y={-8} width={10} height={9} rx={2} fill="#9fd7ef" />
          <rect x={-10} y={-6} width={4} height={12} fill="#f2994a" />
          <rect x={-14} y={-2} width={12} height={4} fill="#f2994a" />
          <circle cx={-12} cy={12} r={5} fill={INK} />
          <circle cx={12} cy={12} r={5} fill={INK} />
        </g>
      );
  }
}

/** Patient impact counters on brass plaques. Always real: the museum is a metaphor, the patients are not. */
function ImpactPlaques({ snapshot }: { snapshot: Snapshot }) {
  const x = CLOCK_TOWER.x + 26;
  const w = CLOCK_TOWER.w - 52;
  return (
    <g className="game-text">
      {IMPACT_TYPES.map((type, i) => {
        const y = 660 + i * 56;
        const value = Math.floor(snapshot.impact[type]);
        return (
          <g key={type} transform={`translate(${x},${y})`}>
            <rect width={w} height={50} rx={12} fill="#3a2f6e" stroke={GOLD} strokeWidth={3} />
            <g transform="translate(32,25)">
              <ImpactIcon type={type} />
            </g>
            <text x={64} y={33} fontSize={22} fontWeight={500} fill="#e8e0ff">
              {IMPACT_LABELS[type]}
            </text>
            <text x={w - 16} y={36} textAnchor="end" fontSize={32} fontWeight={700} fill={value > 0 ? '#ffd27a' : '#a99ce6'}>
              {value}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/** Red glow from the screen edges that grows as the gang gets closer to the Vault. */
export function DangerGlow({ snapshot, slice, uid }: { snapshot: Snapshot; slice: Rect; uid: string }) {
  const w = worldOf(snapshot);
  const distances = snapshot.groups.map((g) => w.distToVault.get(g.room) ?? 99);
  const nearest = distances.length ? Math.min(...distances) : 99;
  const level = nearest === 0 ? 0.75 : nearest === 1 ? 0.5 : nearest === 2 ? 0.3 : nearest === 3 ? 0.14 : 0;
  return (
    <g pointerEvents="none">
      <defs>
        <radialGradient id={`${uid}-danger`} cx="0.5" cy="0.5" r="0.75">
          <stop offset="0.35" stopColor="#ff6b6b" stopOpacity={0} />
          <stop offset="1" stopColor="#ff3b3b" stopOpacity={0.85} />
        </radialGradient>
      </defs>
      <g className={nearest === 0 ? 'danger-pulse' : ''}>
        <rect
          x={slice.x}
          y={0}
          width={SLICE_W}
          height={SLICE_H}
          fill={`url(#${uid}-danger)`}
          style={{ opacity: level, transition: 'opacity 1.5s ease' }}
        />
      </g>
    </g>
  );
}

export function VaultExtras({ snapshot, slice, uid }: { snapshot: Snapshot; slice: Rect; uid: string }) {
  return (
    <>
      <Tower />
      <MuseumClock snapshot={snapshot} />
      <CareGauge snapshot={snapshot} />
      <ImpactPlaques snapshot={snapshot} />
      <DangerGlow snapshot={snapshot} slice={slice} uid={uid} />
    </>
  );
}
