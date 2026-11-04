import { SCREENS, type Phase, type ScreenId, type Snapshot } from '@night-shift/shared';
import { gameClock } from '../game/view';
import { useGame } from '../net/game';
import { BuildingScreen } from '../building/BuildingScreen';
import { ControlCodeCard } from './ControlCodeCard';
import { DeskPanel } from './DeskPanel';
import { RoomList } from './RoomList';
import { VaultStats } from './VaultStats';

const PHASE_LABEL: Record<Phase, string> = { idle: 'Waiting', running: 'Night shift', paused: 'Paused', ended: 'Over' };
const PHASE_COLOR: Record<Phase, string> = { idle: 'text-ink/60', running: 'text-safe', paused: 'text-suspect', ended: 'text-flash' };

/** One wall screen. Phase 3: raw data as plain lists. Sizes scale with the panel (container query units). */
export function ScreenPanel({ id }: { id: ScreenId }) {
  const { snapshot } = useGame();

  // Screens already drawn in the game style. The rest still show raw data until their turn in Phase 4.
  if (id === 3) {
    return (
      <section className="panel relative h-full w-full overflow-hidden bg-[#0c0922]">
        <BuildingScreen screen={id} />
      </section>
    );
  }

  return (
    <section className="panel relative flex h-full min-h-0 w-full min-w-0 flex-col gap-2 overflow-hidden rounded-xl border border-white/10 bg-night-900 p-3">
      <header className="flex flex-wrap items-baseline gap-x-3 text-base">
        <span className="font-semibold text-ink/50">{id}</span>
        <h1 className="font-bold leading-tight text-flash" style={{ fontSize: 'clamp(18px, 6cqmin, 48px)' }}>
          {SCREENS[id].name}
        </h1>
        {snapshot && (
          <span className="font-mono tabular-nums">
            {gameClock(snapshot)} <span className={PHASE_COLOR[snapshot.phase]}>{PHASE_LABEL[snapshot.phase]}</span>
          </span>
        )}
        {snapshot?.reality && <span className="font-semibold text-safe">REALITY</span>}
        {snapshot?.debug && <span className="font-semibold text-danger">DEBUG</span>}
      </header>

      {snapshot ? <Body id={id} snapshot={snapshot} /> : <div className="text-base text-ink/60">Connecting…</div>}

      {id === 2 && <ControlCodeCard />}
    </section>
  );
}

function Body({ id, snapshot }: { id: ScreenId; snapshot: Snapshot }) {
  const outcome = snapshot.outcome && (
    <div className={`text-base font-semibold ${snapshot.outcome.result === 'won' ? 'text-safe' : 'text-danger'}`}>
      {snapshot.outcome.result === 'won' ? 'Night won: ' : 'Night lost: '}
      {snapshot.outcome.reason}
    </div>
  );

  if (id === 2) {
    return (
      <>
        {outcome}
        <DeskPanel snapshot={snapshot} />
      </>
    );
  }
  if (id === 5) {
    return (
      <>
        <VaultStats snapshot={snapshot} />
        {outcome}
        <RoomList screen={5} snapshot={snapshot} />
      </>
    );
  }
  return <RoomList screen={id} snapshot={snapshot} />;
}
