import { useEffect, useRef, useState } from 'react';
import type { Outcome } from '@night-shift/shared';
import { useGame } from '../net/game';

/** How long the end moment (dawn, or the Vault opening) plays before the result card arrives. */
export const CARD_DELAY_MS = 5000;

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export interface EndMoment {
  outcome: Outcome | null;
  /** The night ended while this page was open, so the moment plays. False after a refresh: show the end state. */
  fresh: boolean;
  /** The result card is up. */
  card: boolean;
}

/**
 * The end of the night, the same on every page: every client receives the outcome in the same snapshot,
 * so the moment starts together everywhere. A page that loads after the end shows the final state at once.
 */
export function useEndMoment(): EndMoment {
  const { snapshot } = useGame();
  const outcome = snapshot?.outcome ?? null;
  const loaded = snapshot !== null;
  const key = outcome ? `${outcome.result}-${outcome.atMs}` : null;
  const seen = useRef<{ ready: boolean; key: string | null }>({ ready: false, key: null });
  const [state, setState] = useState<{ fresh: boolean; card: boolean }>({ fresh: false, card: false });

  useEffect(() => {
    if (!loaded) return;
    const first = !seen.current.ready;
    if (!first && seen.current.key === key) return;
    seen.current = { ready: true, key };
    if (!key) return setState({ fresh: false, card: false });
    if (first || prefersReducedMotion()) return setState({ fresh: false, card: true });
    setState({ fresh: true, card: false });
    const t = setTimeout(() => setState({ fresh: true, card: true }), CARD_DELAY_MS);
    return () => clearTimeout(t);
  }, [loaded, key]);

  return { outcome, fresh: state.fresh, card: state.card && outcome !== null };
}

/** 0 → 1 over `ms` once `run` turns true (after `delay`), eased. Jumps straight to 1 when `instant`. */
export function useTween(run: boolean, ms: number, delay = 0, instant = false): number {
  const [p, setP] = useState(run && instant ? 1 : 0);
  useEffect(() => {
    if (!run) return setP(0);
    if (instant || prefersReducedMotion()) return setP(1);
    let raf = 0;
    const start = performance.now() + delay;
    const frame = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / ms));
      setP(1 - Math.pow(1 - t, 3));
      if (t < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [run, ms, delay, instant]);
  return p;
}
