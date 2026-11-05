// The shift-start intro, beat by beat (ms into the intro). The server owns the clock (snapshot.introMs),
// so every open page plays the same beat at the same moment.
import { PLAN_ORDER, type ScreenId, type Snapshot } from '@night-shift/shared';

export const BEAT = {
  banner: 200, // the MoSAIcSOC banner on the black screen, like the studio logos before a film...
  bannerEnd: 2900, // ...gone again
  door: 3000, // "creak"
  footsteps: 3700, // "tap tap tap"
  officeFadeIn: 3600, // the office starts to appear...
  officeLit: 6400, // ...fully visible by now
  lamp: 4000, // desk lamp clicks on
  mug: 5000, // coffee mug set down
  rexYawn: 5500, // Rex yawns and settles
  rexYawnEnd: 7200,
  mission: 16000, // the one sentence
} as const;

/** Screens power on left to right: the leftmost first, then one every 900 ms. */
const POWER_ON_FIRST = 7000;
const POWER_ON_STEP = 900;
export const POWER_ON_FLICKER_MS = 700;

/** Power-on time for the screen at this position (0 = leftmost). */
export function powerOnAtPosition(position: number): number {
  return POWER_ON_FIRST + position * POWER_ON_STEP;
}

/** Power-on time in the plan order 1 to 5: the monitors in the /wall office. */
export function powerOnAt(id: ScreenId): number {
  return powerOnAtPosition(PLAN_ORDER.indexOf(id));
}

export function inIntro(s: Snapshot | null): s is Snapshot {
  return !!s && s.phase === 'intro';
}

/** True once a beat has happened (and always outside the intro). */
export function after(s: Snapshot | null, beat: number): boolean {
  return !inIntro(s) || s.introMs >= beat;
}

export const MISSION = 'Find the intruders before they reach the Vault. Keep the exhibits running until dawn.';
