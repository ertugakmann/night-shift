import { useCallback, useEffect, useRef, useState } from 'react';
import type { ScreenId } from '@night-shift/shared';
import { useScreenPosition } from '../components/position';
import { useGame } from '../net/game';

/** Delay between neighbouring screens, and how long each screen's sweep of light takes. */
export const WAVE_STEP_MS = 380;
export const SWEEP_MS = 950;

export interface Sweep {
  to: boolean;
  key: number;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * "Lights on" as a wave across the wall. The server flips one flag for everyone at once; each screen
 * waits its turn (left to right when the lights go on, right to left when they go off) and then sweeps.
 * Real-room screens go by where they physically stand (ROOM_ORDER); /wall and /preview by the plan order.
 * A page that loads mid-way simply shows the current view, without a wave.
 */
export function useRealityWave(id: ScreenId): { shown: boolean; sweep: Sweep | null; sweepDone: () => void } {
  const { snapshot } = useGame();
  const target = snapshot?.reality ?? false;
  const loaded = snapshot !== null;
  const position = useScreenPosition(id);
  const [shown, setShown] = useState(target);
  const [sweep, setSweep] = useState<Sweep | null>(null);
  const ready = useRef(false);

  // Depends on the flag, not on the snapshot itself: snapshots arrive 10 times a second, and re-running
  // on each one would cancel the wait before this screen's turn ever came.
  useEffect(() => {
    if (!loaded) return;
    if (!ready.current) {
      // First snapshot after loading: take the current view as it is.
      ready.current = true;
      setShown(target);
      return;
    }
    if (sweep || target === shown) return;
    if (prefersReducedMotion()) {
      setShown(target);
      return;
    }
    const turn = target ? position : 4 - position;
    const timer = setTimeout(() => setSweep({ to: target, key: Date.now() }), turn * WAVE_STEP_MS);
    return () => clearTimeout(timer);
  }, [loaded, target, shown, sweep, position]);

  const sweepDone = useCallback(() => {
    setSweep((s) => {
      if (s) setShown(s.to);
      return null;
    });
  }, []);

  // The sweep ends on a timer, not on the animation's completion event: that event does not fire when
  // the screen sits inside another animated container (the /preview crossfade).
  useEffect(() => {
    if (!sweep) return;
    const timer = setTimeout(sweepDone, SWEEP_MS + 50);
    return () => clearTimeout(timer);
  }, [sweep, sweepDone]);

  return { shown, sweep, sweepDone };
}
