import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, animate, motion, useMotionValue } from 'motion/react';
import type { ScreenId } from '@night-shift/shared';
import { ScreenPanel } from '../components/ScreenPanel';
import { ActionPopup } from '../desk/ActionPopup';
import { selectRoom, useGame } from '../net/game';
import { DESK, MONITORS, MONITOR_ORDER, STAGE_H, STAGE_W, focusBox, pct, type Focus, type MonitorId } from '../wall/layout';
import { OfficeBack, OfficeFront } from '../wall/OfficeScene';
import { WallIntro } from '../wall/WallIntro';
import { RealityStrip } from '../reality/RealityStrip';
import { SWEEP_MS, WAVE_STEP_MS } from '../reality/useRealityWave';
import { WallEnd } from '../report/WallEnd';

const MAX_ZOOM = 6;
const GLIDE = { duration: 0.55, ease: [0.4, 0, 0.2, 1] } as const; // within the 400–700 ms brief
const DRAG_THRESHOLD = 5; // px before a press becomes a pan (so clicks still click)

/** Camera in stage units: the stage point at the centre of the view, and the zoom. */
interface Camera {
  cx: number;
  cy: number;
  s: number;
}

const OFFICE: Camera = { cx: STAGE_W / 2, cy: STAGE_H / 2, s: 1 };

function cameraFor(focus: Focus): Camera {
  if (focus === 'office') return OFFICE;
  const b = focusBox(focus);
  return { cx: b.x + b.w / 2, cy: b.y + b.h / 2, s: Math.min(STAGE_W / b.w, STAGE_H / b.h) * 0.97 };
}

/** Keep the view inside the office. */
function clamp(c: Camera): Camera {
  const s = Math.min(MAX_ZOOM, Math.max(1, c.s));
  const hw = STAGE_W / 2 / s;
  const hh = STAGE_H / 2 / s;
  return { s, cx: Math.min(STAGE_W - hw, Math.max(hw, c.cx)), cy: Math.min(STAGE_H - hh, Math.max(hh, c.cy)) };
}

/**
 * /wall: the head guard's office, first person. Four monitors show the live building screens and the
 * desk is the live screen 2, so the whole game can be played from here. Click a monitor to glide in,
 * wheel to zoom, drag to pan, Esc or the back button to return.
 */
export function WallPage() {
  const { snapshot, selected, role } = useGame();
  const stageRef = useRef<HTMLDivElement>(null);
  const [stagePx, setStagePx] = useState(STAGE_W);
  const [focus, setFocus] = useState<Focus>('office');
  const cam = useRef<Camera>(OFFICE);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);
  const [zoomed, setZoomed] = useState(false);
  // The strip arrives as the wave reaches the last screen, and leaves as soon as the wave starts back.
  const reality = snapshot?.reality ?? false;
  const [stripShown, setStripShown] = useState(reality);
  useEffect(() => {
    if (!reality) return setStripShown(false);
    const t = setTimeout(() => setStripShown(true), 4 * WAVE_STEP_MS + SWEEP_MS * 0.6);
    return () => clearTimeout(t);
  }, [reality]);

  // Stage pixels per stage unit, kept up to date as the window resizes.
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => setStagePx(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const apply = useCallback(
    (next: Camera, glide: boolean) => {
      const c = clamp(next);
      cam.current = c;
      const k = stagePx / STAGE_W;
      const tx = (STAGE_W / 2 - c.cx) * c.s * k;
      const ty = (STAGE_H / 2 - c.cy) * c.s * k;
      if (glide) {
        animate(x, tx, GLIDE);
        animate(y, ty, GLIDE);
        animate(scale, c.s, GLIDE);
      } else {
        x.set(tx);
        y.set(ty);
        scale.set(c.s);
      }
      setZoomed(c.s > 1.01);
      if (c.s <= 1.01) setFocus('office');
    },
    [stagePx, x, y, scale],
  );

  // Re-fit after a resize without animating.
  useEffect(() => apply(cam.current, false), [apply]);

  const goTo = useCallback(
    (f: Focus) => {
      setFocus(f);
      apply(cameraFor(f), true);
    },
    [apply],
  );

  // Esc: close the action menu first, otherwise back to the office.
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (selectedRef.current) return selectRoom(null);
      goTo('office');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goTo]);

  // Wheel: zoom around the cursor.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const k = rect.width / STAGE_W;
      const u = (e.clientX - rect.left) / k; // cursor in stage units on screen
      const v = (e.clientY - rect.top) / k;
      const c = cam.current;
      const s2 = Math.min(MAX_ZOOM, Math.max(1, c.s * Math.exp(-e.deltaY * 0.0015)));
      apply(
        {
          s: s2,
          cx: c.cx + (u - STAGE_W / 2) * (1 / c.s - 1 / s2),
          cy: c.cy + (v - STAGE_H / 2) * (1 / c.s - 1 / s2),
        },
        false,
      );
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [apply]);

  // Drag to pan when zoomed. A press that moves less than a few pixels stays a click.
  const drag = useRef<{ x: number; y: number; moved: boolean; cam: Camera } | null>(null);
  const suppressClick = useRef(false);
  function onPointerDown(e: React.PointerEvent) {
    if (cam.current.s <= 1.01 || e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, moved: false, cam: cam.current };
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    d.moved = true;
    const k = stagePx / STAGE_W;
    apply({ ...d.cam, cx: d.cam.cx - dx / k / d.cam.s, cy: d.cam.cy - dy / k / d.cam.s }, false);
  }
  function onPointerUp() {
    if (drag.current?.moved) suppressClick.current = true;
    drag.current = null;
  }
  function onClickCapture(e: React.MouseEvent) {
    if (suppressClick.current) {
      suppressClick.current = false;
      e.stopPropagation();
      e.preventDefault();
    }
  }

  const monitorFocus = focus !== 'office' && focus !== 2;

  return (
    <main className="flex h-full w-full items-center justify-center overflow-hidden bg-[#05040f]">
      <div
        ref={stageRef}
        className="relative overflow-hidden"
        style={{ width: 'min(100vw, calc(100vh * 16 / 9))', aspectRatio: '16 / 9', touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={onClickCapture}
      >
        <motion.div className="absolute inset-0" style={{ x, y, scale, transformOrigin: '50% 50%' }}>
          <OfficeBack snapshot={snapshot} />

          {MONITOR_ORDER.map((id) => (
            <div key={id} className="absolute overflow-hidden rounded-[4px]" style={pct(MONITORS[id])}>
              <ScreenPanel id={id} embedded strip="none" />
              {focus !== id && (
                // In the office (or zoomed elsewhere) a click on a monitor glides into it.
                <button
                  type="button"
                  aria-label={`Zoom into monitor ${id}`}
                  className="absolute inset-0 cursor-zoom-in"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    goTo(id);
                  }}
                />
              )}
            </div>
          ))}

          <div className="absolute overflow-hidden rounded-[10px]" style={pct(DESK)}>
            <ScreenPanel id={2} embedded strip="none" />
          </div>

          <OfficeFront snapshot={snapshot} />
        </motion.div>

        {/* Over a zoomed monitor the desk is off screen, so its action menu floats here instead. */}
        {monitorFocus && snapshot && selected && (
          <svg viewBox={`0 0 ${STAGE_W} ${STAGE_H}`} className="pointer-events-none absolute inset-0 z-20 h-full w-full">
            <g style={{ pointerEvents: 'auto' }}>
              <ActionPopup snapshot={snapshot} roomId={selected} canAct={role !== 'watcher'} floating reality={snapshot.reality} />
            </g>
          </svg>
        )}

        {/* Lights on: the whole Input → NIGHT SHIFT → Output strip, once, over the window at the top of the office */}
        <AnimatePresence>
          {stripShown && (
            <motion.svg
              key="strip"
              viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
              className="pointer-events-none absolute inset-0 z-20 h-full w-full"
              initial={{ opacity: 0, y: -30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              <RealityStrip x0={0} y={0} mode="full" screen={1} />
            </motion.svg>
          )}
        </AnimatePresence>

        {/* End of the night: the result card over the office, then the morning report */}
        <WallEnd snapshot={snapshot} />

        <WallIntro snapshot={snapshot} />

        {/* camera controls */}
        <div className="game-text absolute bottom-3 left-3 z-30 flex gap-2">
          {zoomed && (
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                goTo('office');
              }}
              className="rounded-xl bg-[#17123a]/90 px-4 py-2 text-base font-semibold text-[#fff1cf] ring-2 ring-[#f2c65e]"
            >
              ← Office <span className="text-[#a99ce6]">(Esc)</span>
            </button>
          )}
          {focus !== 2 && (
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                goTo(2 as ScreenId);
              }}
              className="rounded-xl bg-[#17123a]/80 px-4 py-2 text-base font-semibold text-[#e8e0ff] ring-1 ring-white/20"
            >
              Desk
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
