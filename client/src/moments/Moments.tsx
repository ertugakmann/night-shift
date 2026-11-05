// Page-wide moments, the same on every view: the last-30-seconds red pulse while the gang dashes for
// the Vault, and the slow-motion "Phew! That was close!" when a group is stopped one room from it.
// Drawn over the page with CSS only (gradients and opacity), so five screens at once stay smooth.
import { AnimatePresence, motion } from 'motion/react';
import { finaleActive } from '@night-shift/shared';
import { useGame } from '../net/game';

export function Moments() {
  const { snapshot } = useGame();
  if (!snapshot) return null;
  const finale = finaleActive(snapshot);
  const phew = snapshot.slowMs > 0 ? snapshot.fx.filter((f) => f.kind === 'phew').at(-1) : undefined;
  const reality = snapshot.reality;
  // A mini game is on (its own timer, a code to read): Phew stays small, under its header, with no veil.
  const busy = [snapshot.catch, snapshot.wires, snapshot.keys, snapshot.letter].some((m) => m && m.result === null);
  return (
    <>
      <AnimatePresence>
        {finale && (
          <motion.div
            key="finale"
            className="pointer-events-none fixed inset-0 z-30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
          >
            <div className="finale-glow absolute inset-0" />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {phew && (
          <motion.div
            key={`phew-${phew.id}`}
            className={`pointer-events-none fixed inset-0 z-40 flex justify-center ${busy ? 'items-start pt-[13vh]' : 'items-center'}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          >
            {!busy && <div className="phew-veil absolute inset-0" />}
            <motion.div
              className={`relative text-center shadow-2xl ${busy ? 'flex items-baseline gap-[1.5vmin] rounded-full px-[3vmin] py-[0.8vmin]' : 'rounded-[2vmin] px-[5vmin] py-[3vmin]'} ${reality ? 'soc-text bg-[#0b1424]/95 ring-2 ring-[#3ee0d8]' : 'game-text bg-[#17123a]/95 ring-4 ring-[#3ee0d8]'}`}
              initial={{ scale: 0.7, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="font-extrabold text-[#3ee0d8]" style={{ fontSize: busy ? 'max(22px, 4vmin)' : 'max(36px, 8vmin)', lineHeight: 1.05 }}>
                {reality ? 'Close call' : 'Phew!'}
              </div>
              <div className={`font-semibold text-[#fff1cf] ${busy ? '' : 'mt-[1vmin]'}`} style={{ fontSize: busy ? 'max(16px, 2.4vmin)' : 'max(20px, 3.6vmin)' }}>
                {reality ? 'Contained one hop from the patient records.' : 'That was close!'}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
