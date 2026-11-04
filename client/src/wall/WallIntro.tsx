import { AnimatePresence, motion } from 'motion/react';
import type { Snapshot } from '@night-shift/shared';
import { gameClock, worldOf } from '../game/view';
import { BEAT, MISSION, inIntro } from '../intro/timeline';

/**
 * First-person shift start on /wall: black, the clock at 23:58, the door and footsteps; the office fades
 * in; the radio check as subtitles; then one sentence. (Monitors power on via the per-screen overlay.)
 */
export function WallIntro({ snapshot }: { snapshot: Snapshot | null }) {
  if (!inIntro(snapshot)) return null;
  const t = snapshot.introMs;
  const blackout = t < BEAT.officeFadeIn ? 1 : t < BEAT.officeLit ? 1 - (t - BEAT.officeFadeIn) / (BEAT.officeLit - BEAT.officeFadeIn) : 0;
  const w = worldOf(snapshot);
  const radio = w.sc.intro.radioCheck.filter((l) => t >= l.atSec * 1000 && t < BEAT.mission).at(-1);
  const guardName = radio ? snapshot.guards.find((g) => g.id === radio.guard)?.name : null;

  return (
    <div className="game-text pointer-events-none absolute inset-0 z-40">
      {blackout > 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-[#05040f]" style={{ opacity: blackout }}>
          <div className="font-semibold tabular-nums text-[#fff1cf]/85" style={{ fontSize: 'clamp(40px, 9vmin, 120px)' }}>
            {gameClock(snapshot)}
          </div>
          <div className="h-12 text-[#a99ce6]/85" style={{ fontSize: 'clamp(20px, 3.5vmin, 44px)' }}>
            {t >= BEAT.footsteps ? 'tap · tap · tap…' : t >= BEAT.door ? '*creak*' : ''}
          </div>
        </div>
      )}
      <AnimatePresence>
        {radio && guardName && (
          <motion.div
            key={radio.guard}
            className="absolute inset-x-0 bottom-[7%] flex justify-center"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="rounded-2xl bg-[#0f2e2c]/92 px-6 py-3 text-[#b8ffe2] ring-2 ring-[#2a6b63]" style={{ fontSize: 'clamp(18px, 2.8vmin, 34px)' }}>
              <span className="font-bold">{guardName}:</span> {radio.text}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {t >= BEAT.mission && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#05040f]/35">
          <div
            className="fade-up max-w-[70%] rounded-3xl border-4 border-[#f2c65e] bg-[#17123a]/95 px-10 py-7 text-center font-semibold text-[#fff1cf] shadow-2xl"
            style={{ fontSize: 'clamp(22px, 3.6vmin, 52px)' }}
          >
            {MISSION}
          </div>
        </div>
      )}
      <div className="absolute right-4 bottom-4 rounded-lg bg-black/40 px-3 py-1 text-[#e8e0ff]/70" style={{ fontSize: 'clamp(16px, 1.8vmin, 22px)' }}>
        Enter to skip
      </div>
    </div>
  );
}
