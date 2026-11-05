// Sound plays on the presenter's page only: the five room screens stay silent (one speaker, not six
// echoes). M switches it on and off. Cues are read from snapshot changes, so a refresh never replays
// old ones: whatever was already there when the page connected is the baseline.
import { useEffect } from 'react';
import { finaleActive, world, type Snapshot } from '@night-shift/shared';
import { currentView, showNotice, subscribe } from '../net/game';
import { sfx, unlockAudio } from './sfx';

const STORAGE_KEY = 'night-shift:sound';

function readEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}
function writeEnabled(on: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    /* fine: it just won't be remembered */
  }
}

let enabled = readEnabled();

/** Sound for this page right now: the presenter's page, with M not switched off. */
function audible(): boolean {
  return enabled && currentView().role === 'presenter';
}

export function useSoundCues(): void {
  useEffect(() => {
    let seen: { fx: number; log: number; letter: number; reality: boolean } | null = null;

    const onChange = () => {
      const snap = currentView().snapshot;
      if (!snap) return;
      const maxFx = snap.fx.reduce((m, f) => Math.max(m, f.id), 0);
      const maxLog = snap.log.reduce((m, e) => Math.max(m, e.id), 0);
      const letter = snap.letter?.id ?? 0;
      // First snapshot, or a reset (ids start again): take it as it is, play nothing.
      if (!seen || maxLog < seen.log || maxFx < seen.fx) {
        seen = { fx: maxFx, log: maxLog, letter, reality: snap.reality };
        return;
      }
      if (audible()) cues(snap, seen);
      seen = { fx: maxFx, log: maxLog, letter: Math.max(letter, seen.letter), reality: snap.reality };
    };

    // The heartbeat of the last 30 seconds: slow at first, faster as dawn (or the Vault) gets close.
    let beat: ReturnType<typeof setTimeout>;
    const heartbeat = () => {
      const snap = currentView().snapshot;
      let next = 500;
      if (snap && snap.phase === 'running' && finaleActive(snap)) {
        const w = world(snap.scenarioId);
        const left = Math.max(0, w.ms.night - snap.timeMs) / w.ms.finale; // 1 → 0
        next = 380 + 520 * left;
        if (audible()) sfx.heartbeat(0.7 + 0.3 * (1 - left));
      }
      beat = setTimeout(heartbeat, next);
    };
    beat = setTimeout(heartbeat, 500);

    // M: sound on/off. Any key or tap also unlocks audio (browsers need one first).
    const onKey = (e: KeyboardEvent) => {
      unlockAudio();
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.key.toLowerCase() !== 'm') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      const snap = currentView().snapshot;
      if (snap?.keys && snap.keys.result === null) return; // "Change the locks": M could be in the code
      enabled = !enabled;
      writeEnabled(enabled);
      const where = currentView().role === 'presenter' ? '' : ' (sound only plays on the presenter page)';
      showNotice(`Sound ${enabled ? 'on' : 'off'}${where}`);
    };
    const onTap = () => unlockAudio();

    const unsubscribe = subscribe(onChange);
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onTap);
    return () => {
      unsubscribe();
      clearTimeout(beat);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onTap);
    };
  }, []);
}

/** What changed since the last snapshot, as sounds. */
function cues(snap: Snapshot, seen: { fx: number; log: number; letter: number; reality: boolean }): void {
  for (const f of snap.fx) {
    if (f.id <= seen.fx) continue;
    if (f.kind === 'arrived' && snap.guards.some((g) => g.task?.action === 'patrol' && g.task.room === f.room)) sfx.flashlight();
    else if (f.kind === 'locked') sfx.lock();
    else if (f.kind === 'evicted') sfx.victory();
    else if (f.kind === 'phew') sfx.phew();
  }
  if (snap.log.some((e) => e.id > seen.log && e.kind === 'rex')) sfx.bark();
  if (snap.letter && snap.letter.id > seen.letter) sfx.envelope();
  if (snap.reality !== seen.reality) {
    if (snap.reality) sfx.lightsOn();
    else sfx.lightsOff();
  }
}
