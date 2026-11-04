import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { SCREENS, parseScreenId, type ScreenId } from '@night-shift/shared';
import { ScreenPanel } from '../components/ScreenPanel';

const IDS: ScreenId[] = [1, 2, 3, 4, 5];

/** The selected tab lives in the URL hash (#3), so a refresh comes back to the same screen. */
function screenFromHash(): ScreenId {
  return parseScreenId(window.location.hash.slice(1)) ?? 1;
}

/**
 * /preview: the five wall screens one at a time on a single display. Tabs along the bottom, left and
 * right arrows to switch. The game keeps running underneath: every screen reads the same live state.
 */
export function PreviewPage() {
  const [current, setCurrent] = useState<ScreenId>(screenFromHash);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.hash = String(current);
    window.history.replaceState(window.history.state, '', url);
  }, [current]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const step = e.key === 'ArrowRight' ? 1 : -1;
      setCurrent((id) => IDS[(IDS.indexOf(id) + step + IDS.length) % IDS.length]);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <main className="flex h-full w-full flex-col bg-[#0c0922]">
      <div className="relative min-h-0 flex-1">
        <AnimatePresence initial={false}>
          <motion.div
            key={current}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <ScreenPanel id={current} />
          </motion.div>
        </AnimatePresence>
      </div>

      <nav role="tablist" aria-label="Wall screens" className="flex shrink-0 items-center justify-center gap-2 border-t border-white/10 bg-night-950 px-3 py-2">
        <span className="hidden pr-2 text-base text-ink/50 lg:inline">← →</span>
        {IDS.map((id) => {
          const active = id === current;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={(e) => {
                e.currentTarget.blur(); // keep Space for pause
                setCurrent(id);
              }}
              className={`game-text flex items-center gap-2 rounded-xl px-4 py-2 text-base font-semibold transition-colors ${
                active ? 'bg-flash text-night-950' : 'bg-night-800 text-ink/80 hover:bg-night-800/70'
              }`}
            >
              <span className={`grid h-7 w-7 place-items-center rounded-full ${active ? 'bg-night-950 text-flash' : 'bg-night-950/60'}`}>{id}</span>
              <span className="hidden sm:inline">{SCREENS[id].name}</span>
            </button>
          );
        })}
      </nav>
    </main>
  );
}
