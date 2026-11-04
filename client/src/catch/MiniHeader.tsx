// The strip across the top of a mini game: title, a line of help, progress and the time left.
import type { Snapshot } from '@night-shift/shared';

export function MiniHeader({
  title,
  sub,
  snapshot,
  startedMs,
  endsMs,
  limitMs,
  done,
  total,
  flash,
  reality,
  canAct,
}: {
  title: string;
  sub: string;
  snapshot: Snapshot;
  startedMs: number;
  endsMs: number;
  limitMs: number;
  done: number;
  total: number;
  /** Briefly red: a wrong move. */
  flash: boolean;
  reality: boolean;
  canAct: boolean;
}) {
  const left = Math.max(0, (endsMs - Math.max(snapshot.timeMs, startedMs)) / 1000);
  const frac = Math.max(0, Math.min(1, (left * 1000) / limitMs));
  const color = frac > 0.5 ? '#3ee0d8' : frac > 0.25 ? '#f2994a' : '#ff6b6b';
  return (
    <g className={reality ? 'soc-text' : 'game-text'} pointerEvents="none">
      <rect width={1600} height={110} fill={reality ? '#0d1729' : '#17123a'} opacity={0.96} />
      <text x={40} y={66} fontSize={46} fontWeight={800} fill={reality ? '#e6edf7' : '#ffd27a'}>
        {title}
      </text>
      <text x={40} y={96} fontSize={20} fill={reality ? '#8494ad' : '#b9adf0'}>
        {sub}
        {!canAct && ' · watching'}
      </text>
      {/* progress dots */}
      <g transform="translate(940,58)">
        {Array.from({ length: total }, (_, i) => (
          <circle key={i} cx={i * 40} r={14} fill={i < done ? (reality ? '#3ee0d8' : '#ffd27a') : reality ? '#16243d' : '#2a2263'} stroke={reality ? '#2f4a73' : '#5b4ba8'} strokeWidth={3} style={{ transition: 'fill 200ms ease' }} />
        ))}
      </g>
      <g transform="translate(1260,30)">
        <rect width={300} height={30} rx={15} fill={reality ? '#16243d' : '#2a2263'} stroke={flash ? '#ff6b6b' : 'none'} strokeWidth={4} />
        <rect width={300 * frac} height={30} rx={15} fill={color} style={{ transition: 'width 110ms linear, fill 300ms ease' }} />
        <text x={150} y={62} textAnchor="middle" fontSize={22} fontWeight={700} fill={reality ? '#e6edf7' : '#fff1cf'}>
          {left.toFixed(1)} s
        </text>
      </g>
    </g>
  );
}

/** The big card at the end of a mini game. */
export function MiniResult({ good, title, sub, reality }: { good: boolean; title: string; sub: string; reality: boolean }) {
  return (
    <g className={`${reality ? 'soc-text' : 'game-text'} fade-up`} pointerEvents="none">
      <rect x={400} y={360} width={800} height={200} rx={36} fill={reality ? '#0b1424' : '#17123a'} opacity={0.95} stroke={good ? (reality ? '#3ee0d8' : '#ffd27a') : '#f2994a'} strokeWidth={6} />
      <text x={800} y={448} textAnchor="middle" fontSize={56} fontWeight={800} fill={good ? (reality ? '#3ee0d8' : '#ffd27a') : '#f2994a'}>
        {title}
      </text>
      <text x={800} y={508} textAnchor="middle" fontSize={28} fill={reality ? '#e6edf7' : '#fff1cf'}>
        {sub}
      </text>
    </g>
  );
}
