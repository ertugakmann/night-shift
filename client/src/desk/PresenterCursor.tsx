import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { PresenterPointer } from '@night-shift/shared';

const IDLE_MS = 3000; // like the real cursor: hides when the presenter's hand rests
const RING_MS = 600;

// A classic arrow with its tip at 0,0, soft and slightly rounded (desk units, scaled up below).
const ARROW = 'M0 0 L0 44 Q0 47 2.5 45 L11.5 36.5 L18.5 52 Q19.5 54 21.5 53 L27 50.5 Q29 49.5 28 47.5 L21 32.5 L33 32 Q36 31.5 33.5 29.5 L2.5 -1.5 Q0 -3 0 0 Z';

/**
 * The presenter's mouse or finger on a watching desk, so the room sees what the presenter does.
 * A white, softly rounded arrow with a thin dark outline and a soft shadow, clear on dark and light
 * ground alike, in both views. It is drawn in desk units, so it grows with the screen. A press shows
 * a small soft ring. Drawn only, never clickable.
 */
export function PresenterCursor({ pointer }: { pointer: PresenterPointer | null }) {
  const cursor = pointer?.cursor ?? null;
  const clicks = pointer?.clicks ?? 0;
  const reduced = useReducedMotion();
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    setIdle(false);
    const t = setTimeout(() => setIdle(true), IDLE_MS);
    return () => clearTimeout(t);
  }, [cursor?.x, cursor?.y, clicks]);

  // A ring where the presenter pressed; the count seen on arrival (or a refresh) never draws one.
  const [rings, setRings] = useState<{ id: number; x: number; y: number }[]>([]);
  const lastClicks = useRef<number | null>(null);
  useEffect(() => {
    const seen = lastClicks.current;
    lastClicks.current = clicks;
    if (seen === null || clicks === seen || !cursor) return;
    const ring = { id: clicks, x: cursor.x, y: cursor.y };
    setRings((r) => [...r.slice(-3), ring]);
    const t = setTimeout(() => setRings((r) => r.filter((x) => x !== ring)), RING_MS);
    return () => clearTimeout(t);
    // only a new press draws a ring, not a move
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clicks]);

  return (
    <g pointerEvents="none" aria-hidden>
      {rings.map((r) => (
        <g key={r.id} transform={`translate(${r.x} ${r.y})`}>
          <motion.circle
            fill="none"
            stroke="#17123a"
            initial={{ r: 8, opacity: 0.35, strokeWidth: 9 }}
            animate={{ r: reduced ? 8 : 34, opacity: 0, strokeWidth: 3 }}
            transition={{ duration: RING_MS / 1000, ease: 'easeOut' }}
          />
          <motion.circle
            fill="none"
            stroke="#ffffff"
            initial={{ r: 8, opacity: 0.9, strokeWidth: 5 }}
            animate={{ r: reduced ? 8 : 34, opacity: 0, strokeWidth: 1.5 }}
            transition={{ duration: RING_MS / 1000, ease: 'easeOut' }}
          />
        </g>
      ))}
      {cursor && (
        <g style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)`, transition: 'transform 90ms linear, opacity 400ms ease', opacity: idle ? 0 : 1 }}>
          <g transform="scale(1.3)">
            {/* soft shadow, then the dark outline, then the white body */}
            <path d={ARROW} transform="translate(3 4)" fill="#000" opacity={0.3} stroke="#000" strokeWidth={5} strokeLinejoin="round" />
            <path d={ARROW} fill="#17123a" stroke="#17123a" strokeWidth={6} strokeLinejoin="round" />
            <path d={ARROW} fill="#ffffff" stroke="#ffffff" strokeWidth={1.5} strokeLinejoin="round" />
          </g>
        </g>
      )}
    </g>
  );
}
