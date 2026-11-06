import { describe, expect, it } from 'vitest';
import { advance, applyIntent, factorText, initialState, lessonsFrom, nightFacts, pointsText, reportKey, SOC_SECTIONS, templateReport, type ActionKind, type GameState } from './index';

function started(): GameState {
  return applyIntent(applyIntent(initialState(), { type: 'start' }).state, { type: 'skipIntro' }).state;
}
function runUntil(s: GameState, done: (s: GameState) => boolean): GameState {
  while (s.phase === 'running' && !done(s)) s = advance(s, 100);
  return s;
}
function act(s: GameState, action: ActionKind, room: string, guard?: string): GameState {
  const r = applyIntent(s, { type: 'action', action, room, guard });
  expect(r.error).toBeUndefined();
  return r.state;
}

/** Evict (the gang marked as spotted by a patrol), and win the catch by clicking every intruder. */
function evictAndCatch(s: GameState, room: string, guard: string): GameState {
  const seen: GameState = JSON.parse(JSON.stringify(s));
  for (const g of seen.groups) if (g.room === room) g.spotted = true;
  s = act(seen, 'evict', room, guard);
  s = runUntil(s, (x) => (x.catch?.room === room && x.catch.result === null) || !x.guards.some((g) => g.task?.action === 'evict'));
  if (!s.catch || s.catch.result !== null) return s;
  for (const f of s.catch.figures.filter((f) => f.kind === 'intruder')) s = applyIntent(s, { type: 'catch', figure: f.id }).state;
  return s;
}

/** A won night: both groups trapped and evicted early on. */
function wonNight(): GameState {
  let s = runUntil(started(), (x) => x.brokenIn);
  s = act(s, 'patrol', 'mail-room', 'mia');
  s = runUntil(s, (x) => x.groups.length > 1);
  s = act(s, 'lock', 'mail-room', 'sam');
  s = act(s, 'lock', 'entrance-hall', 'tom');
  s = runUntil(s, (x) => !x.guards.some((g) => g.task));
  s = evictAndCatch(s, 'mail-room', 'sam');
  s = evictAndCatch(s, 'entrance-hall', 'tom');
  return runUntil(s, () => false);
}

const idle = runUntil(started(), () => false);
const won = wonNight();

describe('morning report template', () => {
  it('belongs to the night that just ended', () => {
    expect(templateReport(idle).key).toBe(reportKey(idle.outcome!));
    expect(templateReport(idle).source).toBe('template');
  });

  it('tells a lost night as a lost night, in both voices', () => {
    const r = templateReport(idle);
    expect(r.museum.title).toMatch(/Rough/);
    expect(r.museum.paragraphs[0]).toMatch(/cracked the Vault at 03:48/);
    expect(r.soc.incidentSummary.join(' ')).toMatch(/Major incident declared at 03:48/);
    expect(r.soc.affectedSystems[0]).toMatch(/^Encrypted: /);
    expect(r.soc.actionsTaken).toEqual(['No containment actions were taken.', 'Phishing triage 0/2 correct, 2 payloads executed.']);
  });

  it('credits the guards and names what they did on a won night', () => {
    const r = templateReport(won);
    expect(won.outcome!.result).toBe('won');
    const guards = r.museum.paragraphs[2];
    expect(guards).toMatch(/Sam caught the gang in the Mail Room/); // the Catch action, in the museum's words
    expect(guards).not.toMatch(/evict|showed the gang out/i);
    expect(guards).toMatch(/Tom .*the Entrance Hall/);
    expect(r.soc.actionsTaken.join(' ')).toMatch(/Eradicate, Email/); // reality: still Eradicate
    expect(r.soc.affectedSystems).toEqual(['No systems encrypted.']);
  });

  it('fills every SOC section with short lines, and keeps the note short', () => {
    for (const night of [idle, won]) {
      const r = templateReport(night);
      for (const [key] of SOC_SECTIONS) {
        expect(r.soc[key].length).toBeGreaterThan(0);
        for (const line of r.soc[key]) expect(line.length).toBeLessThanOrEqual(200);
      }
      expect(r.museum.paragraphs.join(' ').length).toBeLessThanOrEqual(900);
    }
  });

  it('reports what the AI got right and wrong from the trust analysis', () => {
    const f = nightFacts(idle);
    expect(f.rex.followed).toBe(0);
    expect(templateReport(idle).soc.aiCopilotPerformance.join(' ')).toMatch(new RegExp(`${f.rex.barks} alerts, 1 false positive`));
  });


});

describe('phishing in the morning report', () => {
  it('an idle night: both letters missed, the extra intruders, and blocking the fake domain', () => {
    const f = nightFacts(idle);
    expect(f.phishing).toMatchObject({ letters: 2, right: 0, wrong: 0, missed: 2, fakeDomains: ['nhs-secure-login.co'] });
    expect(f.phishing.breaches).toBe(2);
    const r = templateReport(idle);
    expect(r.museum.paragraphs.join(' ')).toMatch(/0 of 2 letters called right \(2 nobody checked in time\), and that let 2 more groups in/);
    expect(r.soc.actionsTaken.join(' ')).toMatch(/Phishing triage 0\/2 correct, 2 payloads executed\./);
    expect(r.soc.nextSteps[0]).toBe('Block nhs-secure-login.co and retrain staff on reporting phishing.');
  });

  it('both letters called right: a well-spotted line and a clean triage', () => {
    let s = runUntil(started(), (x) => x.letter !== null && x.letter.result === null);
    s = applyIntent(s, { type: 'letter', answer: 'phishing' }).state;
    s = runUntil(s, (x) => x.letter !== null && x.letter.result === null);
    s = applyIntent(s, { type: 'letter', answer: 'safe' }).state;
    s = runUntil(s, () => false);
    const r = templateReport(s);
    expect(nightFacts(s).phishing).toMatchObject({ right: 2, breaches: 0 });
    expect(r.museum.paragraphs.join(' ')).toMatch(/we called every one right/);
    expect(r.soc.actionsTaken.join(' ')).toMatch(/Phishing triage 2\/2 correct\./);
  });
});

describe('lessons: advice about the player’s own decisions', () => {
  /** Run until Rex's first right bark, wait `waitMs`, then act on that room, and play the night out. */
  function answerFirstBark(waitMs: number, action: ActionKind): { s: GameState; room: string } {
    let s = runUntil(started(), (x) => x.log.some((e) => e.kind === 'rex' && e.truth === true));
    const bark = s.log.find((e) => e.kind === 'rex' && e.truth === true)!;
    const until = s.timeMs + waitMs;
    s = runUntil(s, (x) => x.timeMs >= until);
    s = act(s, action, bark.room!);
    return { s: runUntil(s, () => false), room: bark.room! };
  }

  it('every report carries 2 or 3 tips, in both voices, short enough for the screen', () => {
    for (const night of [idle, won]) {
      const r = templateReport(night);
      expect(r.lessons.museum.length).toBeGreaterThanOrEqual(2);
      expect(r.lessons.museum.length).toBeLessThanOrEqual(3);
      expect(r.lessons.soc).toHaveLength(r.lessons.museum.length);
      for (const l of [...r.lessons.museum, ...r.lessons.soc]) expect(l.length).toBeLessThanOrEqual(150);
    }
  });

  it('an idle night: Rex was right and nobody went, and the fake letter got no answer', () => {
    const r = templateReport(idle);
    expect(r.lessons.museum[0]).toMatch(/^Rex was right about the .+ at \d\d:\d\d, but nobody went\. Next time, send a guard when he barks\.$/);
    expect(r.lessons.soc[0]).toMatch(/^True AI alert on .+ was never actioned\. Triage AI alerts within 10 s\.$/);
    expect(r.lessons.museum.join(' ')).toMatch(/Nurse Ada's letter waited too long/);
  });

  it('acted on Rex late: "You locked … N seconds after Rex\'s first warning. Next time, act on Rex sooner."', () => {
    const { s } = answerFirstBark(20_000, 'lock');
    const lessons = nightFacts(s).lessons;
    const late = lessons.find((l) => l.game.includes("after Rex's first warning"))!;
    expect(late.game).toMatch(/^You locked the .+ 20 seconds after Rex's first warning\. Next time, act on Rex sooner\.$/);
    expect(late.soc).toMatch(/^Isolate on .+ came 20 s after a true AI alert\. Aim for under 10 s\.$/);
    expect(lessons[0]).toBe(late); // the most important one
  });

  it('acted on Rex at once: praise, with the seconds', () => {
    // Read a few seconds later (a whole night has bigger problems to report first: praise ranks low).
    let s = runUntil(started(), (x) => x.log.some((e) => e.kind === 'rex' && e.truth === true));
    const bark = s.log.find((e) => e.kind === 'rex' && e.truth === true)!;
    const until = s.timeMs + 2000;
    s = act(runUntil(s, (x) => x.timeMs >= until), 'patrol', bark.room!);
    s = runUntil(s, (x) => x.timeMs >= until + 3000);
    const praise = lessonsFrom(s).find((l) => l.game.includes('Trusting him paid off'));
    expect(praise?.game).toMatch(/^You checked the .+ 2 seconds after Rex barked\. Trusting him paid off\.$/);
  });

  it('a lock on an empty room: patrol first, then lock', () => {
    let s = runUntil(started(), (x) => x.timeMs >= 20_000);
    s = act(s, 'lock', 'radiology', 'mia');
    s = runUntil(s, () => false);
    const lesson = nightFacts(s).lessons.find((l) => l.game.startsWith('You locked the Radiology'));
    expect(lesson?.game).toMatch(/with nobody inside, so its exhibits closed for nothing\. Patrol first, then lock\.$/);
    expect(lesson?.soc).toMatch(/isolated with no infection present/);
  });

  it('the same night gives the same lessons (read from the log, no randomness)', () => {
    expect(nightFacts(idle).lessons).toEqual(nightFacts(runUntil(started(), () => false)).lessons);
  });

  it('a template report is marked as a template (the screen shows no AI tag for it)', () => {
    expect(templateReport(idle).source).toBe('template');
    expect(templateReport(idle).model).toBeNull();
  });
});

describe('time to spot / time to stop (MTTD and MTTR)', () => {
  it('the museum note says it in plain words, never MTTD or MTTR', () => {
    const note = templateReport(won).museum.paragraphs.join(' ');
    expect(note).toMatch(/Time to spot: \d+ (min|h)[^.]* on the night clock \(\d of \d groups\)\./);
    expect(note).toMatch(/Time to stop: (at once|\d+ (min|h)[^.]* on the night clock \(\d of \d\))\./);
    expect(note).not.toMatch(/MTTD|MTTR/);
    // a night where nobody ever saw them
    expect(templateReport(idle).museum.paragraphs.join(' ')).toMatch(/Time to spot: never\. Time to stop: never\./);
  });

  it('the SOC handover writes the terms out: MTTD (mean time to detect), MTTR (mean time to respond)', () => {
    const summary = templateReport(won).soc.incidentSummary.join(' ');
    expect(summary).toMatch(/MTTD \(mean time to detect\): \d/);
    const f = nightFacts(won);
    if (!f.respondedAtOnce) expect(summary).toMatch(/MTTR \(mean time to respond\): \d/);
  });

  it('the numbers are the same in both voices (only the words change)', () => {
    const f = nightFacts(won);
    const note = templateReport(won).museum.paragraphs.join(' ');
    expect(note).toContain(f.timeToDetect!.split(',')[0]);
    expect(templateReport(won).soc.incidentSummary.join(' ')).toContain(f.timeToDetect!);
  });
});

describe('why the care score is what it is', () => {
  it('factors read the same in both voices, with their points', () => {
    const f = { key: 'locked:lab', kind: 'locked', target: 'lab', points: -8.2, ms: 33_333, count: 0, atMs: null } as const;
    expect(factorText(f, 'demo')).toEqual({ game: 'The Lab Gallery locked for 1h 20m', soc: 'Laboratory isolated 1h 20m' });
    expect(pointsText(f.points)).toBe('−8');
    expect(factorText({ ...f, key: 'phish', kind: 'phish', target: null, count: 1 }, 'demo')).toEqual({ game: 'Wrong call on a letter', soc: 'Phishing email released' });
    expect(factorText({ ...f, key: 'repair:pharmacy', kind: 'repair', target: 'pharmacy', points: 5, count: 1 }, 'demo').game).toBe('The Pharmacy Gallery repaired early');
    expect(pointsText(4.6)).toBe('+5');
    expect(factorText({ ...f, key: 'candle:west', kind: 'candle', target: 'west', points: 3 }, 'demo')).toEqual({ game: 'Candles in the West Wing', soc: 'Downtime procedures: Lab and pharmacy' });
  });

  it('a lost night: the Vault is the biggest reason, in the note and in the handover', () => {
    const f = nightFacts(idle);
    expect(f.why[0].game).toBe('Vault cracked at 03:48');
    const r = templateReport(idle);
    expect(r.museum.paragraphs[0]).toMatch(/Our care score for the night: \d+%\. What moved it most: Vault cracked at 03:48 \(−\d+\)/);
    expect(r.soc.patientImpact.join(' ')).toMatch(/Care score \d+% \(night average\)\. Main drivers: Patient records encrypted at 03:48 \(−\d+\)/);
    expect(r.soc.patientImpact.join(' ')).not.toMatch(/average 72|best 86/);
  });

  it('the tips follow the factors: what cost the most care gets advice', () => {
    const lessons = nightFacts(idle).lessons.map((l) => l.game).join(' ');
    expect(lessons).toMatch(/dark for .* cost \d+ points\. Lock it once it's clear and repair it/);
  });
});
