import { describe, expect, it } from 'vitest';
import { advance, applyIntent, initialState, nightFacts, reportKey, SOC_SECTIONS, templateReport, type ActionKind, type GameState } from './index';

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
  s = act(s, 'patrol', 'mail-room', 'priya');
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
    expect(guards).toMatch(/Sam .*the Mail Room/);
    expect(guards).toMatch(/Tom .*the Entrance Hall/);
    expect(r.soc.actionsTaken.join(' ')).toMatch(/Eradicate, Email/);
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
