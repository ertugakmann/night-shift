import { useEffect } from 'react';
import type { IntentType } from '@night-shift/shared';
import { sendIntent } from '../net/game';

const KEYS: Record<string, Exclude<IntentType, 'action'>> = {
  s: 'start',
  ' ': 'togglePause',
  r: 'reset',
  l: 'toggleReality',
  d: 'toggleDebug',
  c: 'toggleCode',
};

/** S start, Space pause, R reset, L lights, D debug, C control code. The server decides who is allowed. */
export function usePresenterKeys(): void {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      const type = KEYS[e.key.toLowerCase()];
      if (!type) return;
      e.preventDefault();
      sendIntent({ type });
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
