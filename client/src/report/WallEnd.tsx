import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Snapshot } from '@night-shift/shared';
import { CARD_H, CARD_W, ResultCard } from '../end/ResultCard';
import { useEndMoment } from '../end/useEndMoment';
import { STAGE_H, STAGE_W } from '../wall/layout';
import { MorningReportView } from './MorningReportView';

const CARD_SCALE = 0.86;
/** How long the result card stays up on /wall before the morning report takes over. */
export const WALL_REPORT_AFTER_MS = 7000;

type Page = 'card' | 'report';

/**
 * /wall at the end of the night: the result card over the office, then the morning report.
 * Two tabs switch between them; once someone picks a tab, it stays where they put it.
 */
export function WallEnd({ snapshot }: { snapshot: Snapshot | null }) {
  const { card, fresh, outcome } = useEndMoment();
  const [page, setPage] = useState<Page>('card');
  const [picked, setPicked] = useState(false);

  useEffect(() => {
    if (!card) {
      setPage('card');
      setPicked(false);
      return;
    }
    if (picked) return;
    if (!fresh) return setPage('report');
    const t = setTimeout(() => setPage('report'), WALL_REPORT_AFTER_MS);
    return () => clearTimeout(t);
  }, [card, fresh, picked]);

  if (!card || !snapshot || !outcome) return null;
  const reality = snapshot.reality;
  const tab = (p: Page, label: string) => (
    <button
      type="button"
      onClick={(e) => {
        e.currentTarget.blur(); // keep Space for pause
        setPicked(true);
        setPage(p);
      }}
      className={`rounded-full px-5 py-1.5 text-base font-semibold transition-colors ${
        page === p ? (reality ? 'bg-[#3ee0d8] text-[#04212a]' : 'bg-[#ffd27a] text-[#17123a]') : 'bg-[#17123a]/80 text-[#e8e0ff] ring-1 ring-white/20 hover:bg-[#17123a]'
      }`}
    >
      {label}
    </button>
  );

  return (
    <motion.div
      className="absolute inset-0 z-[25]"
      initial={fresh ? { opacity: 0, y: 30 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
    >
      <div className="absolute inset-0 bg-[#05040f]/55" />
      <div className={`${reality ? 'soc-text' : 'game-text'} absolute top-[8.6%] left-1/2 z-10 flex -translate-x-1/2 gap-2`}>
        {tab('card', reality ? 'Incident result' : 'Result')}
        {tab('report', reality ? 'Shift handover' : 'Morning note')}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        {page === 'card' ? (
          <motion.svg
            key="card"
            viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
            className="absolute inset-0 h-full w-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <g transform={`translate(${(STAGE_W - CARD_W * CARD_SCALE) / 2},${(STAGE_H - CARD_H * CARD_SCALE) / 2 + 40}) scale(${CARD_SCALE})`}>
              <ResultCard snapshot={snapshot} outcome={outcome} reality={reality} />
            </g>
          </motion.svg>
        ) : (
          <motion.div
            key="report"
            className="absolute"
            style={{ left: '9%', right: '9%', top: '15%', bottom: '4%', containerType: 'size' }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <MorningReportView reality={reality} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
