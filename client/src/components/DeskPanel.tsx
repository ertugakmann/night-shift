import { ACTIONS, WING_NAMES, theRoom, type LogEntry, type Snapshot } from '@night-shift/shared';
import { ACTION_LABEL, guardStatus, logClock, worldOf } from '../game/view';
import { selectRoom, sendIntent, showNotice, useGame } from '../net/game';

const LOG_COLOR: Record<LogEntry['kind'], string> = {
  radio: 'text-ink',
  staff: 'text-flash',
  cctv: 'text-suspect',
  rex: 'text-locked',
  event: 'text-danger',
};

const LOG_LINES = 12;

/** Screen 2, raw version: guards, action menu, Rex, and the radio/CCTV log. */
export function DeskPanel({ snapshot }: { snapshot: Snapshot }) {
  const { role, selected } = useGame();
  const w = worldOf(snapshot);
  const canAct = role !== 'watcher';
  const room = selected ? w.room.get(selected) : undefined;
  const rex = room ? snapshot.rex.estimates[room.id] : null;
  const barking = rex !== null && rex >= w.sc.rex.barkThreshold;

  function act(action: (typeof ACTIONS)[number], e: React.MouseEvent<HTMLButtonElement>) {
    e.currentTarget.blur(); // keep Space for pause
    if (!canAct) return showNotice('Watching only. Enter the control code to take part.');
    if (!room) return showNotice('Pick a room first.');
    sendIntent({ type: 'action', action, room: room.id });
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[1fr_1.4fr_1fr] gap-3 text-left text-base">
      {/* Guards and actions */}
      <div className="flex min-h-0 flex-col gap-2 overflow-hidden">
        <h2 className="font-semibold text-ink/60">Guards</h2>
        <ul className="flex flex-col gap-0.5">
          {snapshot.guards.map((g) => (
            <li key={g.id}>
              <span className={`font-semibold ${g.task ? 'text-suspect' : 'text-safe'}`}>{g.name}</span>{' '}
              <span className="text-ink/80">{guardStatus(snapshot, g)}</span>
            </li>
          ))}
        </ul>

        <h2 className="mt-1 font-semibold text-ink/60">
          {room ? (
            <>
              Selected: <span className="text-flash">{room.name}</span>
            </>
          ) : (
            'Pick a room'
          )}
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {ACTIONS.map((action) => (
            <button
              key={action}
              type="button"
              onClick={(e) => act(action, e)}
              aria-disabled={!canAct || !room}
              className={`rounded-md px-3 py-1 font-semibold ${
                canAct && room ? 'bg-flash text-night-950 hover:bg-flash/85 active:scale-95' : 'cursor-not-allowed bg-white/10 text-ink/40'
              }`}
            >
              {action === 'candlelight' && room ? `Candles: ${WING_NAMES[room.wing].name}` : ACTION_LABEL[action]}
            </button>
          ))}
        </div>
        {room && rex !== null && (
          <div className={barking ? 'text-locked' : 'text-ink/60'}>
            Rex on {theRoom(room.name)}: {rex}% {barking ? '· barking!' : '· calm'}
          </div>
        )}
      </div>

      {/* Radio and CCTV log */}
      <div className="flex min-h-0 flex-col overflow-hidden">
        <h2 className="font-semibold text-ink/60">Radio and CCTV</h2>
        <ul className="flex min-h-0 flex-1 flex-col justify-end gap-0.5 overflow-hidden">
          {snapshot.log.slice(-LOG_LINES).map((entry) => (
            <li key={entry.id} className={`truncate ${LOG_COLOR[entry.kind]}`}>
              <span className="font-mono text-ink/40">{logClock(snapshot, entry.atMs)}</span>{' '}
              {entry.kind === 'cctv' && 'CCTV: '}
              {entry.speaker && <span className="font-semibold">{entry.speaker}: </span>}
              {entry.text}
              {snapshot.debug && entry.truth === false && <span className="text-danger"> [D] false</span>}
            </li>
          ))}
        </ul>
      </div>

      {/* Room picker */}
      <div className="flex min-h-0 flex-col gap-1 overflow-hidden">
        <h2 className="font-semibold text-ink/60">Rooms</h2>
        <div className="grid grid-cols-2 gap-1">
          {w.sc.rooms.map((r) => {
            const rs = snapshot.rooms[r.id];
            return (
              <button
                key={r.id}
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  selectRoom(r.id);
                }}
                className={`truncate rounded-md px-2 py-0.5 text-left ${
                  selected === r.id ? 'bg-flash/15 ring-1 ring-flash' : 'bg-white/5 hover:bg-white/10'
                } ${rs.dark ? 'text-danger' : rs.locked ? 'text-locked' : 'text-ink'}`}
              >
                {r.name}
              </button>
            );
          })}
        </div>
        {snapshot.debug && (
          <div className="text-danger">
            [D] keys {snapshot.masterKeys ? (snapshot.bypassUsed ? 'used' : 'YES') : 'no'} · backups{' '}
            {snapshot.backupsLost ? 'LOST' : 'ok'} · Rex wrong in {snapshot.rex.mistake?.room ?? '-'}
          </div>
        )}
      </div>
    </div>
  );
}
