// The morning report: the facts of the night (from the event log), and a template report written from
// them. The server asks Claude for a nicer version of the same report; the template is the fallback, so
// the demo never depends on the API. Pure TypeScript, no I/O.
import { ACTION_REAL, type ActionKind, type GameState, type Outcome } from './engine';
import { BENCHMARKS, IMPACT_LABELS, IMPACT_TYPES, msToClock, theRoom, world, type ImpactType } from './scenario';

/** The six sections of the SOC shift handover, in order. */
export const SOC_SECTIONS = [
  ['incidentSummary', 'Incident summary'],
  ['affectedSystems', 'Affected systems'],
  ['actionsTaken', 'Actions taken'],
  ['patientImpact', 'Patient impact'],
  ['aiCopilotPerformance', 'AI copilot performance'],
  ['nextSteps', 'Recommended next steps'],
] as const;
export type SocSection = (typeof SOC_SECTIONS)[number][0];

export interface MorningReport {
  /** Which night this is about (see reportKey); a report for an older night is ignored. */
  key: string;
  /** Written by Claude, or by the built-in template. */
  source: 'ai' | 'template';
  /** The Claude model that wrote it (AI reports only). */
  model: string | null;
  /** The head guard's morning note (museum view). */
  museum: { title: string; paragraphs: string[] };
  /** The SOC shift handover (reality view): a few short lines per section. */
  soc: Record<SocSection, string[]>;
}

export function reportKey(outcome: Outcome): string {
  return `${outcome.result}-${outcome.atMs}`;
}

// ---------- Facts ----------

export interface NightFacts {
  result: 'won' | 'lost';
  /** How the night ended: dawn with the Vault safe, every intruder evicted, or the Vault cracked. */
  ending: 'dawn' | 'evicted' | 'vault';
  endedAt: string;
  careContinuity: number;
  averageCare: number;
  bestCare: number;
  /** "1 h 12 min (night clock), 29 s real time", or null when it never happened. */
  timeToDetect: string | null;
  timeToRespond: string | null;
  /** The gang was already trapped when it was first seen (MTTR 0). */
  respondedAtOnce: boolean;
  /** How many groups the gang split into, and how many were spotted and stopped (MTTD and MTTR are averages over those). */
  groups: number;
  groupsSpotted: number;
  groupsStopped: number;
  patientImpact: Record<ImpactType, number>;
  /** Galleries whose exhibits went dark (game name, hospital department, systems). */
  vandalised: { gallery: string; department: string; systems: string[] }[];
  /** Galleries still locked at the end of the night. */
  stillLocked: { gallery: string; department: string }[];
  /** Galleries where intruders were still hiding at the end. */
  intrudersLeftIn: { gallery: string; department: string }[];
  masterKeysStolen: boolean;
  /** The locks were changed in time ("Change the locks"), taking the master keys away again. */
  locksChanged: boolean;
  backupsDestroyed: boolean;
  guards: { name: string; actions: { at: string; action: ActionKind; actionReal: string; gallery: string; department: string; success: boolean }[] }[];
  rex: {
    barks: number;
    wrongBarks: number;
    followed: number;
    followedWrong: number;
    ignored: number;
    ignoredRight: number;
  };
  /** The key moments, in both voices. */
  timeline: { at: string; game: string; soc: string }[];
}

function span(state: GameState, ms: number | null): string | null {
  if (ms === null) return null;
  const w = world(state.scenarioId);
  const minutes = Math.round((ms / w.ms.gameHour) * 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const night = h > 0 ? (m > 0 ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
  const real = ms < 60000 ? `${Math.round(ms / 1000)} s` : `${(ms / 60000).toFixed(1)} min`;
  return `${night} on the night clock, ${real} real time`;
}

/** Everything the report needs, from the full state (the server keeps the whole event log). */
export function nightFacts(state: GameState): NightFacts {
  const w = world(state.scenarioId);
  const hour = w.sc.night.realSecondsPerGameHour;
  const clock = (ms: number) => msToClock(ms, hour);
  const outcome = state.outcome;
  const result = outcome?.result ?? 'lost';
  const ending: NightFacts['ending'] = result === 'lost' ? 'vault' : (outcome?.atMs ?? 0) >= w.ms.night ? 'dawn' : 'evicted';
  const room = (id: string) => w.room.get(id)!;

  const timeline: NightFacts['timeline'] = [];
  for (const e of state.log) {
    const important = e.kind === 'event' || e.kind === 'rex' || (e.kind === 'radio' && e.speaker !== 'You' && e.room !== null);
    if (!important) continue;
    const who = e.speaker && e.kind === 'radio' ? `${e.speaker}: ` : '';
    timeline.push({ at: clock(e.atMs), game: who + e.text, soc: who + (e.real ?? e.text) });
  }

  return {
    result,
    ending,
    endedAt: clock(outcome?.atMs ?? state.timeMs),
    careContinuity: outcome?.summary.careContinuity ?? Math.round(state.care),
    averageCare: BENCHMARKS.averageCare,
    bestCare: BENCHMARKS.bestCare,
    timeToDetect: span(state, outcome?.summary.mttdMs ?? null),
    timeToRespond: span(state, outcome?.summary.mttrMs ?? null),
    respondedAtOnce: outcome?.summary.mttrMs === 0,
    groups: outcome?.summary.groups ?? 0,
    groupsSpotted: outcome?.summary.spotted ?? 0,
    groupsStopped: outcome?.summary.stopped ?? 0,
    patientImpact: Object.fromEntries(IMPACT_TYPES.map((t) => [t, Math.floor(state.impact[t])])) as Record<ImpactType, number>,
    vandalised: w.sc.rooms
      .filter((r) => state.rooms[r.id].dark)
      .map((r) => ({ gallery: r.name, department: r.real, systems: r.exhibits.map((x) => x.real) })),
    stillLocked: w.sc.rooms.filter((r) => state.rooms[r.id].locked).map((r) => ({ gallery: r.name, department: r.real })),
    intrudersLeftIn: [...new Set(state.groups.map((g) => g.room))].map((id) => ({ gallery: room(id).name, department: room(id).real })),
    masterKeysStolen: state.stats.keysStolen,
    locksChanged: state.stats.keysChanged,
    backupsDestroyed: state.backupsLost,
    guards: state.guards.map((g) => ({
      name: g.name,
      actions: state.done
        .filter((d) => d.guard === g.id)
        .map((d) => ({
          at: clock(d.atMs),
          action: d.action,
          actionReal: ACTION_REAL[d.action],
          gallery: room(d.room).name,
          department: room(d.room).real,
          success: d.hit,
        })),
    })),
    rex: {
      barks: state.stats.barks,
      wrongBarks: state.stats.wrongBarks,
      followed: state.stats.rexFollowed,
      followedWrong: state.stats.rexFollowedWrong,
      ignored: state.stats.rexIgnored,
      ignoredRight: state.stats.rexIgnoredRight,
    },
    timeline: timeline.slice(-40),
  };
}

// ---------- Template ----------

function times(n: number): string {
  return n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`;
}

function list(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

/** At most `max` items, then "and N more <noun>". */
function some(items: string[], max: number, noun: string): string {
  if (items.length <= max) return list(items);
  const more = items.length - max;
  return `${items.slice(0, max).join(', ')} and ${more} more ${more === 1 ? noun.replace(/s$/, '') : noun}`;
}

const VERB: Record<ActionKind, [hit: string, miss: string]> = {
  patrol: ['caught intruders in', 'checked'],
  lock: ['locked', 'locked'],
  unlock: ['reopened', 'reopened'],
  evict: ['showed the gang out of', 'tried to clear'],
  repair: ['fixed up', 'tried to fix'],
  candlelight: ['lit the candles in', 'lit the candles in'],
};

function guardLine(g: NightFacts['guards'][number]): string {
  if (g.actions.length === 0) {
    const idle: Record<string, string> = {
      Sam: 'Sam held the fort and guarded the biscuit tin.',
      Priya: 'Priya kept watch, which is harder than it sounds.',
      Tom: 'Tom had a quiet night (the coffee machine is still broken).',
    };
    return idle[g.name] ?? `${g.name} had a quiet night.`;
  }
  // Each place once, by its most useful moment (an eviction says more than the lock before it).
  const rank = (a: (typeof g.actions)[number]) => (a.success ? 0 : 10) + ['evict', 'patrol', 'repair', 'lock', 'unlock', 'candlelight'].indexOf(a.action);
  const best = new Map<string, (typeof g.actions)[number]>();
  for (const a of g.actions) {
    const cur = best.get(a.gallery);
    if (!cur || rank(a) < rank(cur)) best.set(a.gallery, a);
  }
  const bits = [...best.values()]
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, 3)
    .map((a) => `${a.success ? VERB[a.action][0] : VERB[a.action][1]} ${theRoom(a.gallery)}`);
  return `${g.name} ${list(bits)}.`;
}

function rexLine(f: NightFacts): string {
  const { followed, followedWrong, ignored, ignoredRight, barks } = f.rex;
  if (barks === 0) return 'Rex slept through the whole thing. Good boy, technically.';
  const parts: string[] = [];
  if (followed > 0) parts.push(`we followed his nose ${times(followed)} and he was wrong ${followedWrong === 0 ? 'never' : times(followedWrong)}`);
  if (ignored > 0) parts.push(`we ignored him ${times(ignored)} and he was right ${ignoredRight === 0 ? 'never' : ignoredRight === ignored && ignored > 1 ? 'every time' : times(ignoredRight)}`);
  const verdict = ignoredRight > 0 ? 'Next time, maybe listen to the dog.' : f.rex.wrongBarks > 0 ? 'He did bark at an empty room once. Nobody is perfect.' : 'Extra treats for Rex.';
  return `Rex barked ${times(barks)}: ${list(parts)}. ${verdict}`;
}

function museumTemplate(f: NightFacts): MorningReport['museum'] {
  const title = f.result === 'won' ? (f.ending === 'dawn' ? 'Morning, team!' : 'Early night, team!') : 'Rough night, team.';
  const opening =
    f.ending === 'dawn'
      ? `Dawn at last, and the Vault is safe. We kept ${f.careContinuity}% of the museum running through the night.`
      : f.ending === 'evicted'
        ? `Every intruder was shown the door by ${f.endedAt}. We kept ${f.careContinuity}% of the museum running.`
        : `The gang cracked the Vault at ${f.endedAt} and the ambulances had to be sent elsewhere. We kept ${f.careContinuity}% of the museum running.`;
  const dark = f.vandalised.map((v) => theRoom(v.gallery));
  const damage =
    dark.length === 0 ? 'Not a single gallery went dark. The cleaners will be bored.' : `${some(dark, 4, 'galleries').replace(/^the/, 'The')} went dark${f.backupsDestroyed ? ', and the Archive is wrecked' : ''}. Bring the toolbox.`;
  const hurt = IMPACT_TYPES.filter((t) => f.patientImpact[t] > 0).map((t) => `${f.patientImpact[t]} ${IMPACT_LABELS[t].toLowerCase()}`);
  const patients = hurt.length > 0 ? ` Real patients felt it: ${list(hurt)}.` : ' And no patient had to wait.';
  return {
    title,
    paragraphs: [opening, damage + patients, f.guards.map(guardLine).join(' '), rexLine(f)],
  };
}

function socTemplate(f: NightFacts): MorningReport['soc'] {
  const outcome =
    f.ending === 'vault'
      ? `Major incident declared at ${f.endedAt}: electronic patient records encrypted, ambulances diverted.`
      : f.ending === 'evicted'
        ? `Contained: all ransomware eradicated at ${f.endedAt}.`
        : 'Incident window closed at 06:00 with patient records protected.';
  const encrypted = f.vandalised.flatMap((v) => v.systems);
  const actions = f.guards.flatMap((g) => g.actions.filter((a) => a.success).map((a) => ({ ...a, who: g.name })));
  actions.sort((a, b) => a.at.localeCompare(b.at));
  const impact = IMPACT_TYPES.filter((t) => f.patientImpact[t] > 0).map((t, i) => `${i === 0 ? IMPACT_LABELS[t] : IMPACT_LABELS[t].toLowerCase()} ${f.patientImpact[t]}`);

  const next: string[] = [];
  if (f.intrudersLeftIn.length > 0) next.push(`Hunt and eradicate remaining ransomware in ${some(f.intrudersLeftIn.map((r) => r.department), 2, 'segments')}.`);
  if (encrypted.length > 0) next.push(f.backupsDestroyed ? 'Rebuild backups before restoring encrypted systems.' : `Restore from backup: ${some(encrypted, 2, 'systems')}.`);
  if (f.stillLocked.length > 0) next.push(`Bring isolated services back once clean: ${some(f.stillLocked.map((r) => r.department), 2, 'more')}.`);
  if (f.masterKeysStolen) next.push(f.locksChanged ? 'Admin passwords were reset in the night: check for sessions opened before the reset.' : 'Reset all admin credentials and review privileged access.');
  if (f.rex.ignoredRight > 0) next.push('Review the AI copilot alerts that went unanswered.');
  next.push('Remind staff about phishing: the attack started with an email.');

  return {
    incidentSummary: [
      'Ransomware intrusion via a phishing email.',
      f.timeToDetect ? `MTTD ${f.timeToDetect} (${f.groupsSpotted} of ${f.groups} groups detected).` : 'Never detected by a scan during the shift.',
      f.timeToRespond === null
        ? 'Not contained during the shift.'
        : f.respondedAtOnce
          ? `Isolated before it could move (${f.groupsStopped} of ${f.groups} groups contained).`
          : `MTTR ${f.timeToRespond} (${f.groupsStopped} of ${f.groups} groups contained).`,
      outcome,
    ],
    affectedSystems: encrypted.length > 0 ? [`Encrypted: ${some(encrypted, 4, 'systems')}.`] : ['No systems encrypted.'],
    actionsTaken:
      actions.length > 0
        ? actions.slice(0, 5).map((a) => `${a.at} ${a.actionReal}, ${a.department} (Analyst ${a.who}).`)
        : ['No containment actions were taken.'],
    patientImpact: [
      impact.length > 0 ? `${impact.join(', ')}.` : 'No patients affected.',
      `Care continuity ${f.careContinuity}% (average ${f.averageCare}%, best ${f.bestCare}%).`,
    ],
    aiCopilotPerformance: [
      `${f.rex.barks} alerts, ${f.rex.wrongBarks} false positive${f.rex.wrongBarks === 1 ? '' : 's'}.`,
      `Acted on ${f.rex.followed} (${f.rex.followedWrong} false), left ${f.rex.ignored} unanswered (${f.rex.ignoredRight} true positive${f.rex.ignoredRight === 1 ? '' : 's'}).`,
    ],
    nextSteps: next.slice(0, 4),
  };
}

/** The report written without the API, from the same facts. */
export function templateReport(state: GameState): MorningReport {
  const f = nightFacts(state);
  return {
    key: state.outcome ? reportKey(state.outcome) : 'none',
    source: 'template',
    model: null,
    museum: museumTemplate(f),
    soc: socTemplate(f),
  };
}
