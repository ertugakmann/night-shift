// Short shared moments every view agrees on, read from the snapshot: the guards celebrating a catch.
import { useEffect, useRef, useState } from 'react';
import type { Snapshot } from '@night-shift/shared';

/** How long the guards cheer after the gang is thrown out (game ms). */
export const CHEER_MS = 2200;

/** The gang was just caught: the guards jump for joy. */
export function celebrating(snapshot: Snapshot): boolean {
  return snapshot.fx.some((f) => f.kind === 'evicted' && snapshot.timeMs - f.atMs >= 0 && snapshot.timeMs - f.atMs < CHEER_MS);
}

/** Changes each time `value` climbs (by at least 1): use it as a key to replay a "shine" animation. */
export function useRiseKey(value: number): number {
  const previous = useRef(value);
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (value >= previous.current + 1) setKey((k) => k + 1);
    previous.current = value;
  }, [value]);
  return key;
}
