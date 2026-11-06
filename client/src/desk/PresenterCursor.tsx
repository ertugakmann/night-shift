import { useEffect, useState } from 'react';
import type { PresenterPointer } from '@night-shift/shared';

const IDLE_MS = 3000; // like the real cursor: hides when the presenter's hand rests

/**
 * The presenter's mouse or finger on a watching desk, so the room sees what the presenter does.
 * Museum view: a little brass flashlight with a warm spot at its tip. Reality view: a cyan pointer.
 * Touch: a fingertip with a soft ring. Drawn only, never clickable.
 */
export function PresenterCursor({ pointer, reality }: { pointer: PresenterPointer | null; reality: boolean }) {
  const cursor = pointer?.cursor ?? null;
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    setIdle(false);
    const t = setTimeout(() => setIdle(true), IDLE_MS);
    return () => clearTimeout(t);
  }, [cursor?.x, cursor?.y]);

  if (!cursor) return null;
  return (
    <g
      pointerEvents="none"
      aria-hidden
      style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)`, transition: 'transform 90ms linear, opacity 400ms ease', opacity: idle ? 0 : 1 }}
    >
      {cursor.touch ? (
        <g>
          <circle r={26} fill="none" stroke={reality ? '#3ee0d8' : '#ffd27a'} strokeWidth={4} opacity={0.7} className="shimmer" />
          <circle r={14} fill={reality ? '#3ee0d8' : '#ffd27a'} opacity={0.85} stroke="#17123a" strokeWidth={3} />
        </g>
      ) : reality ? (
        <path d="M0 0 L0 30 L8 23 L14 36 L20 33 L14 21 L25 21 Z" fill="#3ee0d8" stroke="#04212a" strokeWidth={3} strokeLinejoin="round" />
      ) : (
        <g>
          {/* the warm spot the flashlight throws, centred on the point */}
          <circle r={30} fill="#ffd27a" opacity={0.22} />
          <circle r={12} fill="#fff1b8" opacity={0.55} />
          {/* the flashlight itself, held from the lower right */}
          <g transform="rotate(-45) translate(0 16)">
            <path d="M-11 0 L11 0 L7 12 L-7 12 Z" fill="#f2c65e" stroke="#5a3a22" strokeWidth={2.5} strokeLinejoin="round" />
            <rect x={-6} y={11} width={12} height={28} rx={4} fill="#c9913c" stroke="#5a3a22" strokeWidth={2.5} />
            <circle cy={20} r={2.5} fill="#ff6b6b" />
            <rect x={-9} y={-2} width={18} height={4} rx={2} fill="#fff1b8" />
          </g>
        </g>
      )}
    </g>
  );
}
