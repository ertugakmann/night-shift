import { IMPACT_LABELS, IMPACT_TYPES, type Snapshot } from '@night-shift/shared';

/** Care score and patient impact. The patients are always real, in both views. */
export function VaultStats({ snapshot }: { snapshot: Snapshot }) {
  const care = Math.round(snapshot.care);
  const careColor = care >= 75 ? 'text-safe' : care >= 50 ? 'text-suspect' : 'text-danger';
  return (
    <div className="flex min-h-0 items-center gap-4">
      <div className="flex flex-col items-center leading-none">
        <span className="text-base text-ink/60">Care</span>
        <span className={`font-mono font-bold tabular-nums ${careColor}`} style={{ fontSize: 'clamp(28px, 16cqmin, 160px)' }}>
          {care}
        </span>
      </div>
      <ul className="flex flex-col text-base leading-snug">
        {IMPACT_TYPES.map((type) => (
          <li key={type} className="flex justify-between gap-3 whitespace-nowrap">
            <span className="text-ink/70">{IMPACT_LABELS[type]}</span>
            <span className="font-mono tabular-nums">{Math.floor(snapshot.impact[type])}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
