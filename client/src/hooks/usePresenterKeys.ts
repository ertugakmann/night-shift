import { useEffect } from 'react';
import type { IntentType } from '@night-shift/shared';
import { currentView, sendIntent, showNotice } from '../net/game';

/** Mid-night, R must be pressed twice (within this time): one stray key never wipes a live demo. */
const RESET_CONFIRM_MS = 2500;

const KEYS: Record<string, Exclude<IntentType, 'action' | 'catch' | 'wire' | 'code' | 'aim' | 'letter'>> = {
  s: 'start',
  ' ': 'togglePause',
  r: 'reset',
  l: 'toggleReality',
  d: 'toggleDebug',
  c: 'toggleCode',
  enter: 'skipIntro',
};

/** S start, Enter skip intro, Space pause, R reset, L lights, D debug, C control code. The server decides who is allowed. */
export function usePresenterKeys(): void {
  useEffect(() => {
    let resetArmedAt = -Infinity;
    function onKeyDown(e: KeyboardEvent) {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      // "Change the locks" is on: letters and digits type the code, and the presenter keys rest (S, R, L... could be in it).
      const { snapshot, role } = currentView();
      if (snapshot?.keys && snapshot.keys.result === null && /^[a-z0-9]$/i.test(e.key)) {
        e.preventDefault();
        if (role !== 'watcher') sendIntent({ type: 'code', char: e.key.toUpperCase() });
        return;
      }
      const type = KEYS[e.key.toLowerCase()];
      if (!type) return;
      e.preventDefault();
      if (type === 'reset' && role === 'presenter' && snapshot && ['intro', 'running', 'paused'].includes(snapshot.phase)) {
        const now = performance.now();
        if (now - resetArmedAt > RESET_CONFIRM_MS) {
          resetArmedAt = now;
          showNotice('Press R again to reset the night');
          return;
        }
      }
      resetArmedAt = -Infinity;
      sendIntent({ type });
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
