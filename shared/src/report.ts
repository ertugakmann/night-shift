// The morning report: the facts of the night (from the event log), and a template report written from
// them. The server asks Claude for a nicer version of the same report; the template is the fallback, so
// the demo never depends on the API. Pure TypeScript, no I/O.
import { ACTION_REAL, type ActionKind, type GameState, type Outcome } from './engine';
import { BENCHMARKS, IMPACT_LABELS, IMPACT_TYPES, WING_NAMES, msToClock, theRoom, world, type ImpactType } from './scenario';

/**
 * MTTD and MTTR in each voice. Museum: plain words ("Time to spot"); reality: the SOC term with its meaning.
 * Same numbers in both (the per-group averages in NightSummary).
 */
export const TIME_LABELS = {
  detect: { museum: 'Time to spot', reality: 'MTTD (mean time to detect)' },
  respond: { museum: 'Time to stop', reality: 'MTTR (mean time to respond)' },
} as const;

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
  /** 2–3 pieces of advice about tonight's decisions: "Tips for tomorrow night" / "Lessons learned". */
  lessons: { museum: string[]; soc: string[] };
}

/** One piece of advice from the night's decisions, in both voices. */
export interface Lesson {
  game: string;
  soc: string;
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
  /** "Safe or phishing?": the letters (emails) staff asked about, and what the calls cost. */
  phishing: {
    letters: number;
    right: number;
    wrong: number;
    missed: number;
    /** New intruder groups (ransomware footholds) let in by a bad call or no answer. */
    breaches: number;
    /** The sender domains of the fake letters. */
    fakeDomains: string[];
  };
  /** The key moments, in both voices. */
  timeline: { at: string; game: string; soc: string }[];
  /** What the player's decisions teach, most important first (the template uses the first 3). */
  lessons: Lesson[];
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
    phishing: {
      letters: state.stats.letters.right + state.stats.letters.wrong + state.stats.letters.missed,
      ...state.stats.letters,
      breaches: state.log.filter((e) => e.kind === 'event' && e.real?.startsWith('Phishing payload executed')).length,
      fakeDomains: [...new Set(w.sc.phishing.letters.filter((l) => l.phishing).map((l) => l.address.split('@')[1]))],
    },
    timeline: timeline.slice(-40),
    lessons: lessonsFrom(state),
  };
}

// ---------- Lessons ----------

const DID: Partial<Record<ActionKind, string>> = { patrol: 'checked', lock: 'locked', evict: 'went to catch the gang in' };

/**
 * Advice about the player's own decisions, read from the event log: how fast Rex's right barks were
 * acted on, the bark that sent a guard for nothing, letters let in, groups found but never trapped,
 * locks on empty rooms, missing candlelight. Most important first; always at least two.
 */
export function lessonsFrom(state: GameState): Lesson[] {
  const w = world(state.scenarioId);
  const clock = (ms: number) => msToClock(ms, w.sc.night.realSecondsPerGameHour);
  const sec = (ms: number) => Math.max(1, Math.round(ms / 1000));
  /** "1 second", "20 seconds". */
  const secs = (ms: number) => (sec(ms) === 1 ? '1 second' : `${sec(ms)} seconds`);
  const windowSec = w.sc.rex.followWindowSec;
  const found: { weight: number; lesson: Lesson }[] = [];
  const add = (weight: number, game: string, soc: string) => found.push({ weight, lesson: { game, soc } });
  const decisive = (a: ActionKind) => a === 'patrol' || a === 'lock' || a === 'evict';
  const answerTo = (room: string, atMs: number) => state.orders.find((o) => decisive(o.action) && o.room === room && o.atMs >= atMs);
  const barks = state.log.filter((e) => e.kind === 'rex' && e.room !== null);

  // Rex was right: how long until someone acted on it (the first right bark per room).
  const seenRooms = new Set<string>();
  let slowDone = false;
  let fastDone = false;
  for (const b of barks) {
    if (!b.truth || seenRooms.has(b.room!)) continue;
    seenRooms.add(b.room!);
    const room = w.room.get(b.room!)!;
    const answer = answerTo(room.id, b.atMs);
    if (answer && answer.atMs - b.atMs <= w.ms.followWindow) {
      if (!fastDone) {
        fastDone = true;
        const d = sec(answer.atMs - b.atMs);
        add(3, `You ${DID[answer.action]} ${theRoom(room.name)} ${secs(answer.atMs - b.atMs)} after Rex barked. Trusting him paid off.`, `${ACTION_REAL[answer.action]} on ${room.real} ${d} s after a true AI alert: keep that pace.`);
      }
      continue;
    }
    if (slowDone) continue;
    slowDone = true;
    if (answer) {
      const d = sec(answer.atMs - b.atMs);
      add(10, `You ${DID[answer.action]} ${theRoom(room.name)} ${secs(answer.atMs - b.atMs)} after Rex's first warning. Next time, act on Rex sooner.`, `${ACTION_REAL[answer.action]} on ${room.real} came ${d} s after a true AI alert. Aim for under ${windowSec} s.`);
    } else {
      add(9, `Rex was right about ${theRoom(room.name)} at ${clock(b.atMs)}, but nobody went. Next time, send a guard when he barks.`, `True AI alert on ${room.real} at ${clock(b.atMs)} was never actioned. Triage AI alerts within ${windowSec} s.`);
    }
  }

  // Rex was wrong, and was followed.
  const fooled = barks.find((b) => {
    if (b.truth !== false) return false;
    const answer = answerTo(b.room!, b.atMs);
    return !!answer && answer.atMs - b.atMs <= w.ms.followWindow;
  });
  if (fooled) {
    const room = w.room.get(fooled.room!)!;
    add(6, `Rex sent you to ${theRoom(room.name)} for nothing at ${clock(fooled.atMs)}. When only a camera glitches, wait for a second clue.`, `False positive on ${room.real} at ${clock(fooled.atMs)} cost an analyst. Corroborate AI alerts with a second source.`);
  }

  // The post.
  const letters = state.stats.letters;
  const domains = [...new Set(w.sc.phishing.letters.filter((l) => l.phishing).map((l) => l.address.split('@')[1]))];
  if (letters.wrong > 0) {
    add(8, `A fake letter from ${list(domains)} got through. Check the sender's address before you say Safe.`, `Phishing from ${list(domains)} was released. Check sender domain, SPF and Reply-To first.`);
  } else if (letters.missed > 0) {
    add(7, "Nurse Ada's letter waited too long. Look at the sender and the link, then decide fast.", `A reported email got no verdict. Phishing triage needs an answer within ${w.sc.phishing.decideSec} s.`);
  }

  // Found, but never trapped.
  const escaped = state.groupLog.filter((r) => r.spottedMs !== null && r.stoppedMs === null).length;
  if (escaped > 0) {
    add(7, `You found the gang but they slipped away${escaped > 1 ? ` ${escaped} times` : ''}. Keep a second guard ready to lock as soon as a patrol spots them.`, `${escaped} detected threat${escaped > 1 ? 's' : ''} never contained. Pair every detection with immediate isolation.`);
  }

  // Detection.
  const first = state.groupLog[0];
  if (first && state.groupLog.every((r) => r.spottedMs === null)) {
    add(6, "Nobody ever saw the gang. Send a patrol to the Mail Room early: that's where they get in.", 'Initial access was never detected. Hunt at the entry point (email) first.');
  } else if (first && first.spottedMs !== null && first.spottedMs - first.appearedMs > 30_000) {
    const d = sec(first.spottedMs - first.appearedMs);
    add(5, `The gang was inside for ${secs(first.spottedMs - first.appearedMs)} before anyone saw them. Patrol the Mail Room early.`, `First foothold undetected for ${d} s. Hunt at the entry point early.`);
  }

  if (state.stats.keysStolen && !state.stats.keysChanged) {
    add(5, 'The gang kept the master keys. Type the new code fast when the Key Room falls.', 'Stolen admin credentials stayed valid. Rehearse the emergency password reset.');
  }

  // A lock on an empty room.
  const emptyLock = state.done.find((d) => d.action === 'lock' && d.empty);
  if (emptyLock) {
    const room = w.room.get(emptyLock.room)!;
    add(4, `You locked ${theRoom(room.name)} with nobody inside, so its exhibits closed for nothing. Patrol first, then lock.`, `${room.real} isolated with no infection present. Confirm first: isolation costs care.`);
  }

  // A critical department closed, and no candles in its wing.
  const unlit = w.sc.rooms.find((r) => r.complaint && (state.rooms[r.id].locked || state.rooms[r.id].dark) && !state.candlelight[r.wing]);
  if (unlit) {
    add(4, `${theRoom(unlit.name).replace(/^the/, 'The')} stayed closed without candles. Light them in the ${WING_NAMES[unlit.wing].name} to keep care going.`, `No downtime procedures for ${unlit.real} while it was offline. Invoke them early.`);
  }

  // Always something to take away.
  if (state.outcome?.result === 'lost') {
    add(1, 'Keep a padlock spare for the Archive and the Emergency Hall: the last doors before the Vault.', 'Keep isolation capacity in reserve for the segments next to the patient records.');
  } else {
    add(1, 'Patrol, then lock straight away: it worked tonight. Do it again tomorrow.', 'Detect, then isolate at once: the playbook worked. Keep it.');
  }
  add(0, 'When Rex barks, look at his clues: a staff report beats a camera glitch.', 'Weigh AI alerts by their evidence: a staff report is stronger than a single EDR alert.');

  return found
    .map((f, i) => ({ ...f, i }))
    .sort((a, b) => b.weight - a.weight || a.i - b.i)
    .map((f) => f.lesson)
    .slice(0, 5);
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
  evict: ['caught the gang in', 'tried to catch the gang in'],
  repair: ['fixed up', 'tried to fix'],
  candlelight: ['lit the candles in', 'lit the candles in'],
};

function guardLine(g: NightFacts['guards'][number]): string {
  if (g.actions.length === 0) {
    const idle: Record<string, string> = {
      Sam: 'Sam held the fort and guarded the biscuit tin.',
      Mia: 'Mia kept watch, which is harder than it sounds.',
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

function postLine(f: NightFacts): string | null {
  const p = f.phishing;
  if (p.letters === 0) return null;
  const bad = p.wrong + p.missed;
  if (bad === 0) return `The post: ${p.letters === 1 ? 'one letter came' : `${p.letters} letters came`} and we called ${p.letters === 1 ? 'it' : 'every one'} right. Nobody fell for the fake one. Well spotted.`;
  const how = [p.wrong > 0 && `${p.wrong} wrong call${p.wrong > 1 ? 's' : ''}`, p.missed > 0 && `${p.missed} nobody checked in time`].filter(Boolean).join(' and ');
  const cost = p.breaches > 0 ? `, and that let ${p.breaches === 1 ? 'one more group' : `${p.breaches} more groups`} in through the post` : ', but the locked doors held';
  return `The post: ${p.right} of ${p.letters} letters called right (${how})${cost}. Look at the sender before you open anything!`;
}

/** "Time to spot: 21 min on the night clock (2 of 3 groups). Time to stop: never." */
function timesLine(f: NightFacts): string {
  const night = (span: string) => span.split(',')[0];
  const spot = f.timeToDetect ? `${night(f.timeToDetect)} (${f.groupsSpotted} of ${f.groups} groups)` : 'never';
  const stop = f.timeToRespond === null ? 'never' : f.respondedAtOnce ? 'at once' : `${night(f.timeToRespond)} (${f.groupsStopped} of ${f.groups})`;
  return `${TIME_LABELS.detect.museum}: ${spot}. ${TIME_LABELS.respond.museum}: ${stop}.`;
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
    paragraphs: [`${opening} ${timesLine(f)}`, damage + patients, f.guards.map(guardLine).join(' '), [rexLine(f), postLine(f)].filter(Boolean).join(' ')],
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
  const p = f.phishing;
  if (p.wrong + p.missed > 0) next.unshift(`Block ${list(p.fakeDomains)} and retrain staff on reporting phishing.`);
  else next.push('Remind staff about phishing: the attack started with an email.');

  return {
    incidentSummary: [
      'Ransomware intrusion via a phishing email.',
      f.timeToDetect ? `${TIME_LABELS.detect.reality}: ${f.timeToDetect} (${f.groupsSpotted} of ${f.groups} groups detected).` : 'Never detected by a scan during the shift.',
      f.timeToRespond === null
        ? 'Not contained during the shift.'
        : f.respondedAtOnce
          ? `Isolated before it could move (${f.groupsStopped} of ${f.groups} groups contained).`
          : `${TIME_LABELS.respond.reality}: ${f.timeToRespond} (${f.groupsStopped} of ${f.groups} groups contained).`,
      outcome,
    ],
    affectedSystems: encrypted.length > 0 ? [`Encrypted: ${some(encrypted, 4, 'systems')}.`] : ['No systems encrypted.'],
    actionsTaken: [
      ...(actions.length > 0
        ? actions.slice(0, p.letters > 0 ? 4 : 5).map((a) => `${a.at} ${a.actionReal}, ${a.department} (Analyst ${a.who}).`)
        : ['No containment actions were taken.']),
      ...(p.letters > 0
        ? [`Phishing triage ${p.right}/${p.letters} correct${p.breaches > 0 ? `, ${p.breaches} payload${p.breaches > 1 ? 's' : ''} executed` : p.wrong + p.missed > 0 ? ', payloads blocked by isolation' : ''}.`]
        : []),
    ],
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
    lessons: { museum: f.lessons.slice(0, 3).map((l) => l.game), soc: f.lessons.slice(0, 3).map((l) => l.soc) },
  };
}
