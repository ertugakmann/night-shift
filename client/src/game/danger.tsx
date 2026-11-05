// How close the gang is to the Vault, as a 0–5 level, and a meter to show it (desk and screen 5).
import type { Snapshot } from '@night-shift/shared';
import { worldOf } from './view';

export const DANGER_STEPS = 5;

/** 0: nobody near; 5: in the Vault. One step per room closer. */
export function dangerLevel(snapshot: Snapshot): number {
  const w = worldOf(snapshot);
  const nearest = Math.min(99, ...snapshot.groups.map((g) => w.distToVault.get(g.room) ?? 99));
  return Math.max(0, Math.min(DANGER_STEPS, DANGER_STEPS - nearest));
}

const COLOURS = ['#3ee0d8', '#ffd27a', '#f2994a', '#ff8a6b', '#ff6b6b'];

/** A row of segments that light up as the gang closes in. */
export function DangerMeter({
  x,
  y,
  w,
  h,
  level,
  label,
  reality,
  vertical = false,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  level: number;
  label: string;
  reality: boolean;
  vertical?: boolean;
}) {
  const gap = 5;
  const n = DANGER_STEPS;
  const seg = vertical ? (h - 30 - gap * (n - 1)) / n : (w - gap * (n - 1)) / n;
  const hot = level >= 4;
  return (
    <g className={reality ? 'soc-text' : 'game-text'} pointerEvents="none">
      <text x={vertical ? x + w / 2 : x} y={y + 18} textAnchor={vertical ? 'middle' : 'start'} fontSize={16} fontWeight={800} fill={hot ? '#ff6b6b' : reality ? '#7f8ea8' : '#f2c65e'} letterSpacing={1}>
        {label}
      </text>
      {Array.from({ length: n }, (_, i) => {
        const on = i < level;
        const fill = on ? COLOURS[i] : reality ? '#16243d' : '#2a2263';
        return vertical ? (
          // bottom up
          <rect key={i} x={x + 8} y={y + h - (i + 1) * seg - i * gap} width={w - 16} height={seg} rx={5} fill={fill} className={on && hot ? 'danger-pulse' : undefined} style={{ transition: 'fill 500ms ease' }} />
        ) : (
          <rect key={i} x={x + i * (seg + gap)} y={y + 26} width={seg} height={h - 26} rx={6} fill={fill} className={on && hot ? 'danger-pulse' : undefined} style={{ transition: 'fill 500ms ease' }} />
        );
      })}
    </g>
  );
}
