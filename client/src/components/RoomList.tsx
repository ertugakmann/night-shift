import type { ScreenId, Snapshot } from '@night-shift/shared';
import { worldOf } from '../game/view';
import { selectRoom, useGame } from '../net/game';

/** Raw list of the rooms on one building screen. Click a room to pick it for the action menu. */
export function RoomList({ screen, snapshot }: { screen: ScreenId; snapshot: Snapshot }) {
  const { selected } = useGame();
  const w = worldOf(snapshot);
  const rooms = w.sc.rooms.filter((r) => r.screen === screen);

  return (
    <ul className="flex min-h-0 flex-col gap-1 overflow-hidden">
      {rooms.map((room) => {
        const rs = snapshot.rooms[room.id];
        const groups = snapshot.groups.filter((g) => g.room === room.id);
        const guards = snapshot.guards.filter((g) => g.room === room.id);
        const lit = rs.litBy !== null;
        const isSelected = selected === room.id;
        return (
          <li key={room.id}>
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                selectRoom(isSelected ? null : room.id);
              }}
              className={`flex w-full flex-wrap items-baseline gap-x-2 rounded-md px-2 py-0.5 text-left text-base ${
                isSelected ? 'bg-flash/15 ring-1 ring-flash' : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              <span className={`font-semibold ${rs.dark ? 'text-danger' : lit ? 'text-flash' : 'text-ink'}`}>{room.name}</span>
              {rs.locked && <span className="text-locked">LOCKED</span>}
              {rs.dark && <span className="text-danger">DARK</span>}
              {snapshot.candlelight[room.wing] && (rs.locked || rs.dark) && <span className="text-flash/80">candles</span>}
              {lit && <span className="text-flash">torch on</span>}
              {guards.length > 0 && <span className="text-safe">{guards.map((g) => g.name).join(', ')}</span>}
              {lit && groups.length > 0 && (
                <span className="font-bold text-suspect">
                  {groups.length} intruder group{groups.length > 1 ? 's' : ''}!
                </span>
              )}
              {snapshot.debug && groups.length > 0 && (
                <span className="text-danger">
                  [D] {groups.map((g) => `#${g.id}${g.spotted ? ' spotted' : ''}`).join(' ')} ·{' '}
                  {Math.floor(rs.occupiedMs / 1000)}s
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
