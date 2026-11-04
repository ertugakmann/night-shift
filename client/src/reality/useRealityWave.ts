import { useCallback, useEffect, useRef, useState } from 'react';
import type { ScreenId } from '@night-shift/shared';
import { useGame } from '../net/game';

/** Physical order of the screens on the wall, left to right. */
const ORDER: Record<ScreenId, number> = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4 };
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
 * A page that loads mid-way simply shows the current view, without a wave.
 */
export function useRealityWave(id: ScreenId): { shown: boolean; sweep: Sweep | null; sweepDone: () => void } {
  const { snapshot } = useGame();
  const target = snapshot?.reality ?? false;
  const loaded = snapshot !== null;
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
    const turn = target ? ORDER[id] : 4 - ORDER[id];
    const timer = setTimeout(() => setSweep({ to: target, key: Date.now() }), turn * WAVE_STEP_MS);
    return () => clearTimeout(timer);
  }, [loaded, target, shown, sweep, id]);

  const sweepDone = useCallback(() => {
    setSweep((s) => {
      if (s) setShown(s.to);
      return null;
    });
  }, []);

  return { shown, sweep, sweepDone };
}
