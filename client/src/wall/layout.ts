// The /wall office, in a 1600×900 stage (scaled to fit the window). Monitors are 16:9 like the real
// screens, so each building screen fills its monitor; the desk inlay is 16:9 for screen 2.
import type { ScreenId } from '@night-shift/shared';

export const STAGE_W = 1600;
export const STAGE_H = 900;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type MonitorId = 1 | 3 | 4 | 5;

/** Screen area of each monitor (inside its bezel), left to right in building order. */
export const MONITORS: Record<MonitorId, Box> = {
  1: { x: 62, y: 82, w: 336, h: 189 },
  3: { x: 452, y: 82, w: 336, h: 189 },
  4: { x: 842, y: 82, w: 336, h: 189 },
  5: { x: 1232, y: 82, w: 336, h: 189 },
};
export const MONITOR_ORDER: MonitorId[] = [1, 3, 4, 5];
export const BEZEL = 12;

/** Screen 2, set into the desk top. */
export const DESK: Box = { x: 288, y: 318, w: 1024, h: 576 };

/** Office (everything), a monitor, or the desk. */
export type Focus = 'office' | ScreenId;

export function focusBox(focus: Focus): Box {
  if (focus === 'office') return { x: 0, y: 0, w: STAGE_W, h: STAGE_H };
  if (focus === 2) return DESK;
  return MONITORS[focus];
}

/** Percent placement of a stage box, for absolutely positioned HTML. */
export function pct(b: Box): React.CSSProperties {
  return {
    left: `${(b.x / STAGE_W) * 100}%`,
    top: `${(b.y / STAGE_H) * 100}%`,
    width: `${(b.w / STAGE_W) * 100}%`,
    height: `${(b.h / STAGE_H) * 100}%`,
  };
}
