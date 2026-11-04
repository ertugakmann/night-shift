import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useEndMoment } from '../end/useEndMoment';
import { useRealityWave } from '../reality/useRealityWave';
import { MorningReportView } from './MorningReportView';

/** On the desk, the report follows a moment after the result card has come up on screen 5. */
export const REPORT_AFTER_CARD_MS = 1500;

/**
 * Screen 2 at the end of the night: the morning report lies on the desk, over everything else.
 * It switches voice when the "Lights on" wave reaches the desk.
 */
export function DeskReport() {
  const { card, fresh, outcome } = useEndMoment();
  const { shown: reality } = useRealityWave(2);
  const [up, setUp] = useState(false);

  useEffect(() => {
    if (!card) return setUp(false);
    if (!fresh) return setUp(true);
    const t = setTimeout(() => setUp(true), REPORT_AFTER_CARD_MS);
    return () => clearTimeout(t);
  }, [card, fresh]);

  return (
    <AnimatePresence>
      {up && outcome && (
        <motion.div
          key="report"
          className="absolute inset-0 z-20"
          initial={fresh ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="absolute inset-0 bg-[#05040f]/55" />
          <motion.div
            className="absolute"
            style={{ left: '7%', right: '7%', top: '5%', bottom: reality ? '10%' : '5%', containerType: 'size' }}
            initial={fresh ? { y: 40, rotate: -2 } : false}
            animate={{ y: 0, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 120, damping: 16 }}
          >
            <MorningReportView reality={reality} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
