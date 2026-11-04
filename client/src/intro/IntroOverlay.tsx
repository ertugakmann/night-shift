import type { ScreenId } from '@night-shift/shared';
import { gameClock } from '../game/view';
import { useGame } from '../net/game';
import { useScreenPosition } from '../components/position';
import { BEAT, MISSION, POWER_ON_FLICKER_MS, inIntro, powerOnAtPosition } from './timeline';

/**
 * Shift start, per screen: black until this screen's turn, then a short flicker as it powers on.
 * The same component sits on /screen/x, inside the /wall monitors and in /preview. Real-room screens
 * light up in their physical order (ROOM_ORDER), the /wall monitors and /preview in the plan order 1 to 5.
 * `quiet`: inside /wall, where the office overlay shows the clock and the mission instead.
 */
export function IntroOverlay({ id, quiet = false }: { id: ScreenId; quiet?: boolean }) {
  const { snapshot } = useGame();
  const position = useScreenPosition(id);
  if (!inIntro(snapshot)) return null;
  const t = snapshot.introMs;
  const on = powerOnAtPosition(position);

  if (t < on) {
    // Before power-on. The desk (screen 2) shows the time and the sounds of the guard arriving.
    return (
      <div data-intro="off" className="game-text pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-[#05040f]">
        {id === 2 && !quiet && (
          <>
            <div className="font-semibold tabular-nums text-[#fff1cf]/80" style={{ fontSize: 'clamp(28px, 10cqmin, 120px)' }}>
              {gameClock(snapshot)}
            </div>
            <div className="h-10 text-[#a99ce6]/80" style={{ fontSize: 'clamp(18px, 4cqmin, 40px)' }}>
              {t >= BEAT.footsteps ? 'tap · tap · tap…' : t >= BEAT.door ? '*creak*' : ''}
            </div>
          </>
        )}
        <span className="absolute right-[3%] bottom-[4%] h-2 w-2 rounded-full bg-[#ff6b6b]/70" />
      </div>
    );
  }
  if (t < on + POWER_ON_FLICKER_MS) {
    return <div data-intro="powering-on" className="power-on pointer-events-none absolute inset-0 z-30 bg-[#05040f]" />;
  }
  if (id === 2 && !quiet && t >= BEAT.mission) {
    return (
      <div data-intro="mission" className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
        <div
          className="game-text fade-up max-w-[80%] rounded-3xl border-4 border-[#f2c65e] bg-[#17123a]/92 px-[4%] py-[2.5%] text-center font-semibold text-[#fff1cf] shadow-2xl"
          style={{ fontSize: 'clamp(18px, 5cqmin, 56px)' }}
        >
          {MISSION}
        </div>
      </div>
    );
  }
  return null;
}
