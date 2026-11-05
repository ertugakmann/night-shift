// Small things that keep a wall screen presentable for a whole demo:
// - a screen wake lock, so the screens in the room don't dim or sleep mid-night;
// - the mouse cursor hides after a few seconds without movement, and comes back on any move or touch.
import { useEffect } from 'react';

const CURSOR_IDLE_MS = 3000;

export function useDemoScreen(): void {
  // Wake lock: needs a secure context (https, or localhost) and a visible page. It is released whenever
  // the tab is hidden, so ask again each time it comes back. Unsupported browsers just skip it.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    let stopped = false;
    async function request() {
      try {
        const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock;
        if (!wl || document.visibilityState !== 'visible') return;
        const l = await wl.request('screen');
        if (stopped) void l.release();
        else lock = l;
      } catch {
        /* not allowed here (e.g. plain http on another device): the screen settings decide */
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') void request();
    };
    void request();
    document.addEventListener('visibilitychange', onVisible);
    // Some browsers only grant it after a first interaction.
    window.addEventListener('pointerdown', onVisible, { once: true });
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pointerdown', onVisible);
      void lock?.release().catch(() => {});
    };
  }, []);

  // Idle cursor.
  useEffect(() => {
    const root = document.documentElement;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const wake = () => {
      root.classList.remove('cursor-idle');
      clearTimeout(timer);
      timer = setTimeout(() => root.classList.add('cursor-idle'), CURSOR_IDLE_MS);
    };
    wake();
    window.addEventListener('pointermove', wake);
    window.addEventListener('pointerdown', wake);
    return () => {
      clearTimeout(timer);
      root.classList.remove('cursor-idle');
      window.removeEventListener('pointermove', wake);
      window.removeEventListener('pointerdown', wake);
    };
  }, []);
}
