import { SCREENS, formatClock, type Phase, type ScreenId } from '@night-shift/shared';
import { sendIntent, showNotice, useGame } from '../net/game';
import { ControlCodeCard } from './ControlCodeCard';

const PHASE_LABEL: Record<Phase, string> = { idle: 'Waiting', running: 'Running', paused: 'Paused' };
const PHASE_COLOR: Record<Phase, string> = { idle: 'text-ink/60', running: 'text-safe', paused: 'text-suspect' };

/** Placeholder content for one wall screen. Sizes scale with the panel (container query units). */
export function ScreenPanel({ id }: { id: ScreenId }) {
  const { snapshot, role } = useGame();
  const canAct = role !== 'watcher';

  function increment(e: React.MouseEvent<HTMLButtonElement>) {
    e.currentTarget.blur(); // keep Space for pause, not for re-clicking
    if (!canAct) {
      showNotice('Watching only. Enter the control code to take part.');
      return;
    }
    sendIntent({ type: 'increment' });
  }

  return (
    <section className="panel relative flex h-full min-h-0 w-full min-w-0 flex-col items-center justify-center gap-[2cqmin] overflow-hidden rounded-xl border border-white/10 bg-night-900 p-3 text-center">
      <div className="absolute top-2 left-3 flex gap-2 text-base font-semibold tracking-wide">
        <span className="text-ink/50">{id}</span>
        {snapshot?.reality && <span className="text-safe">REALITY</span>}
        {snapshot?.debug && <span className="text-danger">DEBUG</span>}
      </div>

      <h1 className="font-bold text-flash leading-tight" style={{ fontSize: 'clamp(16px, 8cqmin, 72px)' }}>
        {SCREENS[id].name}
      </h1>

      {snapshot ? (
        <>
          <div className="font-mono font-bold tabular-nums leading-none" style={{ fontSize: 'clamp(32px, 26cqmin, 260px)' }}>
            {snapshot.counter}
          </div>
          <div className="font-mono tabular-nums" style={{ fontSize: 'clamp(16px, 6cqmin, 48px)' }}>
            {formatClock(snapshot.elapsedMs)}{' '}
            <span className={PHASE_COLOR[snapshot.phase]}>{PHASE_LABEL[snapshot.phase]}</span>
          </div>
          <button
            type="button"
            onClick={increment}
            aria-disabled={!canAct}
            className={`rounded-lg px-4 py-1 font-semibold transition-colors ${
              canAct ? 'bg-flash text-night-950 hover:bg-flash/85 active:scale-95' : 'cursor-not-allowed bg-white/10 text-ink/40'
            }`}
            style={{ fontSize: 'clamp(16px, 5cqmin, 40px)' }}
          >
            +1
          </button>
        </>
      ) : (
        <div className="text-base text-ink/60">Connecting…</div>
      )}

      {id === 2 && <ControlCodeCard />}
    </section>
  );
}
