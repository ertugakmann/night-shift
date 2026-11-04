// Words for the end of the night, in both voices.
import type { Outcome, Snapshot } from '@night-shift/shared';
import { logClock, worldOf } from '../game/view';

function times(n: number): string {
  return n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`;
}

/** A game-clock duration ("1 h 12 min") and the same span in real minutes ("1.0 min real"). */
export function durations(snapshot: Snapshot, ms: number | null): { night: string; real: string } | null {
  if (ms === null) return null;
  const minutes = Math.round((ms / worldOf(snapshot).ms.gameHour) * 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const night = h > 0 ? (m > 0 ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
  const real = ms < 60000 ? `${Math.round(ms / 1000)} s real time` : `${(ms / 60000).toFixed(1)} min real time`;
  return { night, real };
}

/** "You followed Rex 5 times, he was wrong once." / "You ignored him twice, he was right both times." */
export function trustLines(snapshot: Snapshot, reality: boolean): [string, string] {
  const { rexFollowed: f, rexFollowedWrong: fw, rexIgnored: i, rexIgnoredRight: ir } = snapshot.stats;
  if (reality) {
    const followed = f === 0 ? 'No AI alerts acted on.' : `Acted on ${f} AI alert${f === 1 ? '' : 's'}: ${fw} false positive${fw === 1 ? '' : 's'}.`;
    const ignored = i === 0 ? 'No AI alerts left unanswered.' : `Left ${i} unanswered: ${ir} true positive${ir === 1 ? '' : 's'}.`;
    return [followed, ignored];
  }
  const followed =
    f === 0 ? 'You never followed Rex.' : `You followed Rex ${times(f)}, ${fw === 0 ? (f === 1 ? 'he was right.' : 'he was right every time.') : `he was wrong ${times(fw)}.`}`;
  const all = i === 1 ? '' : i === 2 ? ' both times' : ' every time';
  const ignored =
    i === 0
      ? 'You never ignored him.'
      : `You ignored him ${times(i)}, ${ir === i ? `he was right${all}.` : ir === 0 ? `he was wrong${all}.` : `he was right ${times(ir)}.`}`;
  return [followed, ignored];
}

/** Headline and the line under it, for the end banner and the result card. */
export function headline(snapshot: Snapshot, outcome: Outcome, reality: boolean): { title: string; sub: string } {
  const at = logClock(snapshot, outcome.atMs);
  if (outcome.result === 'lost') {
    return {
      title: 'Major incident declared',
      sub: reality ? `Ambulances diverted. Patient records encrypted at ${at}.` : `Ambulances diverted. The gang cracked the Vault at ${at}.`,
    };
  }
  const dawn = outcome.atMs >= worldOf(snapshot).ms.night;
  if (reality) return { title: dawn ? 'Incident window closed' : 'Incident contained', sub: dawn ? 'Patient records protected until 06:00.' : `All ransomware eradicated at ${at}.` };
  return { title: dawn ? 'Dawn. The Vault is safe.' : 'The gang is gone!', sub: dawn ? 'The museum made it through the night.' : `Every intruder shown the door at ${at}.` };
}
