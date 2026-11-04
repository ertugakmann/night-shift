// The shift-start intro, beat by beat (ms into the intro). The server owns the clock (snapshot.introMs),
// so every open page plays the same beat at the same moment.
import type { ScreenId, Snapshot } from '@night-shift/shared';

export const BEAT = {
  door: 900, // "creak"
  footsteps: 1700, // "tap tap tap"
  officeFadeIn: 3000, // the office starts to appear...
  officeLit: 6000, // ...fully visible by now
  lamp: 3500, // desk lamp clicks on
  mug: 4500, // coffee mug set down
  rexYawn: 5500, // Rex yawns and settles
  rexYawnEnd: 7200,
  mission: 16000, // the one sentence
} as const;

/** Screens power on left to right, the way the physical screens stand in the room. */
const POWER_ON: Record<ScreenId, number> = { 1: 7000, 2: 7900, 3: 8800, 4: 9700, 5: 10600 };
export const POWER_ON_FLICKER_MS = 700;

export function powerOnAt(id: ScreenId): number {
  return POWER_ON[id];
}

export function inIntro(s: Snapshot | null): s is Snapshot {
  return !!s && s.phase === 'intro';
}

/** True once a beat has happened (and always outside the intro). */
export function after(s: Snapshot | null, beat: number): boolean {
  return !inIntro(s) || s.introMs >= beat;
}

export const MISSION = 'Find the intruders before they reach the Vault. Keep the exhibits running until dawn.';
