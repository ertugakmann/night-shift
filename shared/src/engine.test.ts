import { describe, expect, it } from 'vitest';
import {
  advance,
  applyIntent,
  clockToMs,
  initialState,
  isIntent,
  msToClock,
  world,
  padlocks,
  type ActionKind,
  type GameState,
} from './index';

const w = world('demo');
const HOUR = w.sc.night.realSecondsPerGameHour;
const at = (clock: string) => clockToMs(clock, HOUR);

/** A night with the shift-start intro skipped, clock at 00:00 and running. */
function started(): GameState {
  const intro = applyIntent(initialState(), { type: 'start' }).state;
  return applyIntent(intro, { type: 'skipIntro' }).state;
}

function runUntil(s: GameState, done: (s: GameState) => boolean, limitMs = w.ms.night + 1000): GameState {
  while (s.phase === 'running' && !done(s) && s.timeMs < limitMs) s = advance(s, 100);
  return s;
}

function runFor(s: GameState, ms: number): GameState {
  const until = s.timeMs + ms;
  return runUntil(s, (x) => x.timeMs >= until);
}

function act(s: GameState, action: ActionKind, room: string, guard?: string): GameState {
  const result = applyIntent(s, { type: 'action', action, room, guard });
  expect(result.error).toBeUndefined();
  return result.state;
}

/** Test setup: replace the gang with a single group in `room` (later in the night: no entry split pending). */
function placeGang(s: GameState, room: string): GameState {
  const copy: GameState = JSON.parse(JSON.stringify(s));
  copy.groups = [{ id: 99, room, enteredMs: copy.timeMs, spotted: false, visited: [room] }];
  copy.entrySplit = false;
  return copy;
}

const idleNight = () => runUntil(started(), () => false);

/** Evict, and win the catch: wait for the guard to arrive, then click every intruder. */
function evictAndCatch(s: GameState, room: string, guard?: string): GameState {
  s = act(s, 'evict', room, guard);
  s = runUntil(s, (x) => (x.catch?.room === room && x.catch.result === null) || !x.guards.some((g) => g.task?.action === 'evict'));
  if (!s.catch || s.catch.result !== null) return s;
  for (const f of s.catch.figures.filter((f) => f.kind === 'intruder')) s = applyIntent(s, { type: 'catch', figure: f.id }).state;
  return s;
}


describe('determinism', () => {
  it('replays an idle night identically', () => {
    expect(JSON.stringify(idleNight())).toBe(JSON.stringify(idleNight()));
  });

  it('gives the same night whatever size the server ticks are', () => {
    const even = idleNight();

    let s = started();
    let lcg = 12345;
    while (s.phase === 'running') {
      lcg = (lcg * 1103515245 + 12345) % 2147483648;
      s = advance(s, 1 + (lcg % 700));
    }
    expect({ ...s, accMs: 0 }).toEqual({ ...even, accMs: 0 });
  });

  it('does not move while paused', () => {
    let s = runFor(started(), 5000);
    s = applyIntent(s, { type: 'togglePause' }).state;
    expect(advance(s, 5000)).toBe(s);
  });
});

describe('an idle night (nobody touches anything)', () => {
  const night = idleNight();
  const lostAt = night.outcome?.atMs ?? Infinity;

  it('lasts about two and a half real minutes from 00:00 to dawn', () => {
    expect(w.ms.night).toBe(150_000);
  });

  it('is lost at the Vault at 60–70% of the night', () => {
    expect(night.outcome?.result).toBe('lost');
    expect(lostAt / w.ms.night).toBeGreaterThanOrEqual(0.6);
    expect(lostAt / w.ms.night).toBeLessThanOrEqual(0.7);
    expect(msToClock(lostAt, HOUR)).toBe('03:48');
  });

  it('leaves dark exhibits along the way', () => {
    const dark = Object.values(night.rooms).filter((r) => r.dark).length;
    expect(dark).toBeGreaterThanOrEqual(4);
    expect(night.rooms.lab.dark).toBe(true);
  });

  it('gives the player clues early', () => {
    const reports = night.log.filter((l) => l.kind === 'staff' && l.truth);
    const cctv = night.log.filter((l) => l.kind === 'cctv' && l.truth);
    expect(reports.length).toBeGreaterThanOrEqual(5);
    expect(reports[0].atMs).toBeLessThan(at('01:00'));
    expect(cctv.length).toBeGreaterThanOrEqual(3);
    expect(cctv[0].atMs).toBeLessThan(at('01:00'));
  });

  it('includes decoys and false alarms', () => {
    expect(night.log.some((l) => l.kind === 'staff' && l.truth === false)).toBe(true);
    expect(night.log.some((l) => l.kind === 'cctv' && l.truth === false)).toBe(true);
  });

  it('runs up patient impact', () => {
    expect(night.impact.tests).toBeGreaterThan(0);
    expect(night.care).toBeLessThan(100);
  });
});

describe('Rex', () => {
  it('is wrong exactly once, at the Pharmacy, after 02:00', () => {
    const night = idleNight();
    const wrong = night.log.filter((l) => l.kind === 'rex' && l.truth === false);
    expect(wrong).toHaveLength(1);
    expect(wrong[0].room).toBe('pharmacy');
    expect(wrong[0].atMs).toBeGreaterThanOrEqual(at('02:00'));
    expect(night.stats.wrongBarks).toBe(1);
    expect(night.log.filter((l) => l.kind === 'rex' && l.truth).length).toBeGreaterThan(2);
  });

  it('barks at another empty room if the gang really is in the Pharmacy', () => {
    let s = runUntil(started(), (x) => x.timeMs >= at('02:00'));
    s = placeGang(s, 'pharmacy');
    s = runUntil(s, (x) => x.rex.mistakeDone);

    const wrong = s.log.filter((l) => l.kind === 'rex' && l.truth === false);
    expect(wrong).toHaveLength(1);
    expect(wrong[0].room).not.toBe('pharmacy');
    expect(s.groups.some((g) => g.room === wrong[0].room)).toBe(false);
  });

  it('barks only above 50% confidence', () => {
    const barks = idleNight().log.filter((l) => l.kind === 'rex');
    expect(barks.length).toBeGreaterThan(5);
    for (const b of barks) expect(Number(/\((\d+)%\)/.exec(b.text)![1])).toBeGreaterThan(50);
  });

  it('a patrol sent soon after a bark follows him', () => {
    let s = runUntil(started(), (x) => x.rex.mistake !== null);
    s = act(s, 'patrol', s.rex.mistake!.room);
    expect(s.stats.rexFollowed).toBe(1);
    expect(s.stats.rexFollowedWrong).toBe(1); // the planned mistake: nobody there
  });

  it('no patrol within the window ignores him, and a late patrol does not count', () => {
    let s = runUntil(started(), (x) => x.rex.mistake !== null);
    const room = s.rex.mistake!.room;
    // The planned mistake is the night's only wrong bark, so it shows up as "ignored, and he was wrong".
    const wrongIgnored = (x: GameState) => x.stats.rexIgnored - x.stats.rexIgnoredRight;
    const before = wrongIgnored(s);
    s = runFor(s, w.ms.followWindow + 200);
    expect(wrongIgnored(s)).toBe(before + 1);
    s = act(s, 'patrol', room);
    expect(s.stats.rexFollowed).toBe(0);
  });

  it('one bark is one decision: locks and repeated orders do not count', () => {
    let s = runUntil(started(), (x) => x.rex.mistake !== null);
    const room = s.rex.mistake!.room;
    s = act(s, 'lock', room, 'sam');
    expect(s.stats.rexFollowed).toBe(0);
    s = act(s, 'patrol', room, 'priya');
    const again = applyIntent(s, { type: 'action', action: 'patrol', room, guard: 'tom' });
    expect(again.error).toMatch(/already/);
    expect(again.state.stats.rexFollowed).toBe(1);
    expect(s.stats.rexFollowed).toBe(1);
    s = runFor(s, w.ms.followWindow + 200);
    expect(s.stats.rexIgnored + s.stats.rexFollowed).toBeLessThanOrEqual(s.stats.barks);
  });
});

describe('find, trap, evict, repair', () => {
  const afterBreakIn = () => runUntil(started(), (s) => s.brokenIn);

  it('the gang splits 3–4 s after breaking in: one group stays, one slips into the Entrance Hall', () => {
    const s = runUntil(started(), (x) => x.groups.length > 1);
    const after = s.timeMs - s.stats.brokenInMs!;
    expect(after).toBeGreaterThanOrEqual(3000);
    expect(after).toBeLessThanOrEqual(4000);
    expect(s.groups.map((g) => g.room)).toEqual(['mail-room', 'entrance-hall']);
  });

  it('a Mail Room locked in advance: they come in through the front door, and Tom warns on the radio', () => {
    let s = act(started(), 'lock', 'mail-room', 'sam');
    s = runUntil(s, (x) => x.brokenIn);
    expect(s.groups.map((g) => g.room)).toEqual(['entrance-hall']);
    expect(s.log.some((l) => l.speaker === 'Tom' && l.text === "Someone's at the front door!")).toBe(true);
    s = runUntil(s, (x) => x.groups.length > 1);
    expect(s.groups.map((g) => g.room)).toEqual(['entrance-hall', 'west-corridor']);
    expect(s.groups.some((g) => g.room === 'mail-room')).toBe(false);
  });

  it('both ways in locked: the gang waits outside until one opens', () => {
    let s = act(started(), 'lock', 'mail-room', 'sam');
    s = act(s, 'lock', 'entrance-hall', 'tom');
    s = runFor(s, w.ms.breakIn + 5000);
    expect(s.brokenIn).toBe(false);
    s = act(s, 'unlock', 'entrance-hall', 'tom');
    s = runUntil(s, (x) => x.brokenIn);
    expect(s.groups.map((g) => g.room)).toEqual(['entrance-hall']);
  });

  it('a lock on the Entrance Hall stops the split', () => {
    let s = act(started(), 'lock', 'entrance-hall', 'tom');
    s = runUntil(s, (x) => x.brokenIn);
    s = runFor(s, 5000);
    expect(s.groups.map((g) => g.room)).toEqual(['mail-room']);
  });

  it('a patrol reveals the gang, and spotted intruders flee at the next spread tick', () => {
    let s = act(afterBreakIn(), 'patrol', 'mail-room', 'tom');
    const first = s.groups[0].id;
    s = runUntil(s, (x) => x.groups[0].spotted);
    expect(s.log.at(-1)).toMatchObject({ kind: 'radio', speaker: 'Tom' });

    s = runUntil(s, (x) => x.groups.length > 1); // the split tick: the spotted group stays put
    s = runUntil(s, (x) => x.groups.find((g) => g.id === first)!.room !== 'mail-room', s.nextSpreadMs);
    expect(s.groups.find((g) => g.id === first)!.room).toBe('entrance-hall');
  });

  it('catching the first group alone does not win the night', () => {
    let s = runUntil(afterBreakIn(), (x) => x.groups.length > 1);
    s = act(s, 'lock', 'mail-room', 'sam');
    s = runUntil(s, (x) => x.rooms['mail-room'].locked);
    expect(s.care).toBe(98);
    s = evictAndCatch(s, 'mail-room', 'sam');
    expect(s.stats.evicted).toBe(1);
    expect(s.phase).toBe('running');
    expect(s.groups.length).toBeGreaterThan(0); // the other group is still out there (and may have split again)
    expect(s.groups.some((g) => g.room === 'mail-room')).toBe(false);
  });

  it('trapping and evicting both groups wins the night', () => {
    let s = runUntil(afterBreakIn(), (x) => x.groups.length > 1);
    s = act(s, 'lock', 'mail-room', 'sam');
    s = act(s, 'lock', 'entrance-hall', 'tom');
    s = runUntil(s, (x) => x.rooms['mail-room'].locked && x.rooms['entrance-hall'].locked);
    expect(s.groups.every((g) => s.rooms[g.room].locked)).toBe(true);

    s = evictAndCatch(s, 'mail-room', 'sam');
    s = evictAndCatch(s, 'entrance-hall', 'tom');
    expect(s.groups).toHaveLength(0);
    expect(s.phase).toBe('ended');
    expect(s.outcome?.result).toBe('won');
    expect(s.stats.evicted).toBe(2);
  });

  it('the Mail Room has a second door, straight into the West Corridor', () => {
    expect(w.neighbours.get('mail-room')).toEqual(expect.arrayContaining(['entrance-hall', 'west-corridor']));
  });

  it('evict works in an open room too, but only one catch at a time', () => {
    let s = act(afterBreakIn(), 'evict', 'mail-room', 'tom');
    const second = applyIntent(s, { type: 'action', action: 'evict', room: 'entrance-hall', guard: 'sam' });
    expect(second.error).toMatch(/One catch at a time/);
    s = runUntil(s, (x) => x.catch !== null);
    expect(s.catch!.room).toBe('mail-room');
  });

  it('every lock has a cost, candlelight halves it, repair restores it', () => {
    let s = act(started(), 'lock', 'lab', 'sam');
    s = runUntil(s, (x) => x.rooms.lab.locked);
    expect(s.care).toBe(86);

    s = act(s, 'candlelight', 'pharmacy', 'sam');
    s = runUntil(s, (x) => x.candlelight.west);
    expect(s.care).toBe(93);

    s = act(s, 'repair', 'lab', 'sam');
    s = runUntil(s, (x) => !x.rooms.lab.locked);
    expect(s.care).toBe(100);
  });

  it('three guards, no more', () => {
    let s = act(started(), 'patrol', 'lab');
    s = act(s, 'patrol', 'radiology');
    s = act(s, 'patrol', 'key-room');
    expect(applyIntent(s, { type: 'action', action: 'patrol', room: 'vault' }).error).toMatch(/busy/);
  });

  it('guards take longer to reach far rooms', () => {
    const near = act(started(), 'patrol', 'lab', 'sam').guards.find((g) => g.id === 'sam')!.task!;
    const far = act(started(), 'patrol', 'vault', 'sam').guards.find((g) => g.id === 'sam')!.task!;
    expect(far.walkMs).toBeGreaterThan(near.walkMs);
  });
});

describe('Catch the intruders (Evict)', () => {
  /** The gang split, the Mail Room locked with one group inside, and a guard sent to evict. */
  function catching(locked = true): GameState {
    let s = runUntil(runUntil(started(), (x) => x.brokenIn), (x) => x.groups.length > 1);
    if (locked) {
      s = act(s, 'lock', 'mail-room', 'sam');
      s = runUntil(s, (x) => x.rooms['mail-room'].locked && !x.guards.some((g) => g.task));
    }
    s = act(s, 'evict', 'mail-room', 'sam');
    return runUntil(s, (x) => x.catch !== null);
  }

  it('starts when the guard arrives: intruders hidden among innocent visitors, 7 seconds on the clock', () => {
    const s = catching();
    const c = s.catch!;
    expect(c.room).toBe('mail-room');
    expect(c.endsMs - c.startedMs).toBe(7000);
    expect(c.figures.filter((f) => f.kind === 'intruder').length).toBe(3);
    expect(c.figures.filter((f) => f.kind === 'innocent').length).toBe(4);
    for (const f of c.figures) {
      expect(f.x).toBeGreaterThan(0);
      expect(f.x).toBeLessThan(1);
      expect(f.y).toBeGreaterThan(0);
      expect(f.y).toBeLessThan(1);
    }
    expect(s.guards.find((g) => g.id === 'sam')!.task?.action).toBe('evict');
  });

  it('the night keeps running while the catch is on', () => {
    const s = catching();
    const later = runFor(s, 3000);
    expect(later.timeMs).toBe(s.timeMs + 3000);
    expect(later.catch?.result).toBeNull();
  });

  it('a wrong click on an innocent costs 1.5 seconds', () => {
    let s = catching();
    const innocent = s.catch!.figures.find((f) => f.kind === 'innocent')!;
    const before = s.catch!.endsMs;
    s = applyIntent(s, { type: 'action', action: 'patrol', room: 'lab', guard: 'tom' }).state; // unrelated, fine
    s = applyIntent(s, { type: 'catch', figure: innocent.id }).state;
    expect(s.catch!.endsMs).toBe(before - 1500);
    expect(s.catch!.wrong).toBe(1);
    expect(s.catch!.figures.find((f) => f.id === innocent.id)!.oopsAtMs).toBe(s.timeMs);
  });

  it('catching every intruder throws the gang out at once', () => {
    let s = catching();
    for (const f of s.catch!.figures.filter((f) => f.kind === 'intruder')) s = applyIntent(s, { type: 'catch', figure: f.id }).state;
    expect(s.catch!.result).toBe('caught');
    expect(s.groups.some((g) => g.room === 'mail-room')).toBe(false);
    expect(s.stats.evicted).toBe(1);
    expect(s.guards.find((g) => g.id === 'sam')!.task).toBeNull();
  });

  it('time runs out in a locked room: they stay, and Evict has to be tried again', () => {
    let s = catching();
    s = runUntil(s, (x) => x.catch?.result !== null);
    expect(s.catch!.result).toBe('held');
    expect(s.groups.some((g) => g.room === 'mail-room')).toBe(true);
    s = runFor(s, 2000);
    expect(s.catch).toBeNull();
    s = evictAndCatch(s, 'mail-room', 'sam');
    expect(s.groups.some((g) => g.room === 'mail-room')).toBe(false);
  });

  it('time runs out in an open room: they slip into a neighbouring room, never a locked one', () => {
    // One group in the open Mail Room; its way to the Entrance Hall is locked, the mail tube is open.
    let s = placeGang(runUntil(started(), (x) => x.brokenIn), 'mail-room');
    s.rooms['entrance-hall'].locked = true;
    s.guards.find((g) => g.id === 'tom')!.room = 'key-room';
    s = act(s, 'evict', 'mail-room', 'sam');
    s = runUntil(s, (x) => x.catch !== null);
    s = runUntil(s, (x) => x.catch?.result !== null);
    expect(s.catch!.result).toBe('escaped');
    expect(s.catch!.to).toBe('west-corridor');
    expect(s.groups.map((g) => g.room)).toEqual(['west-corridor']);
  });

  it('time runs out in an open room with every way out blocked: they stay put', () => {
    let s = placeGang(runUntil(started(), (x) => x.brokenIn), 'mail-room');
    s.rooms['entrance-hall'].locked = true;
    s.rooms['west-corridor'].locked = true;
    s = act(s, 'evict', 'mail-room', 'sam');
    s = runUntil(s, (x) => x.catch !== null);
    s = runUntil(s, (x) => x.catch?.result !== null);
    expect(s.catch!.result).toBe('held');
    expect(s.groups.map((g) => g.room)).toEqual(['mail-room']);
  });

  it('a click without a catch is refused', () => {
    expect(applyIntent(started(), { type: 'catch', figure: 1 }).error).toMatch(/No catch/);
    expect(isIntent({ type: 'catch', figure: 2 })).toBe(true);
    expect(isIntent({ type: 'catch', figure: 'x' })).toBe(false);
  });
});

describe('padlocks and the lock rule', () => {
  const afterBreakIn = () => runUntil(started(), (s) => s.brokenIn);

  it('three padlocks: a fourth lock is refused, a lock on its way counts', () => {
    let s = act(started(), 'lock', 'lab', 'sam');
    s = act(s, 'lock', 'pharmacy', 'priya');
    expect(padlocks(s)).toEqual({ max: 3, used: 2, free: 1 });
    s = act(s, 'lock', 'radiology', 'tom');
    expect(padlocks(s).free).toBe(0);
    s = runUntil(s, (x) => !x.guards.some((g) => g.task));
    const fourth = applyIntent(s, { type: 'action', action: 'lock', room: 'ward4' });
    expect(fourth.error).toMatch(/padlocks are in use/);
  });

  it('unlocking gives a padlock back and reopens the exhibits', () => {
    let s = act(started(), 'lock', 'lab', 'sam');
    s = runUntil(s, (x) => x.rooms.lab.locked);
    expect(s.care).toBe(86);
    s = act(s, 'unlock', 'lab', 'sam');
    s = runUntil(s, (x) => !x.rooms.lab.locked);
    expect(s.care).toBe(100);
    expect(padlocks(s).free).toBe(3);
    expect(applyIntent(s, { type: 'action', action: 'unlock', room: 'lab' }).error).toMatch(/not locked/);
  });

  it('a repair gives the padlock back too', () => {
    let s = act(started(), 'lock', 'lab', 'sam');
    s = runUntil(s, (x) => x.rooms.lab.locked);
    s = act(s, 'repair', 'lab', 'sam');
    s = runUntil(s, (x) => !x.rooms.lab.locked);
    expect(padlocks(s).free).toBe(3);
  });

  it('nobody gets out of a locked room: a trapped group stays put all night', () => {
    let s = placeGang(afterBreakIn(), 'west-corridor');
    s.rooms['west-corridor'].locked = true;
    s.groups[0].spotted = true; // even a spotted group, which always tries to flee
    s = runFor(s, 6 * w.ms.spreadTick);
    expect(s.groups.map((g) => g.room)).toEqual(['west-corridor']);
  });

  it('nobody gets in: a locked room next to the gang is never entered', () => {
    let s = placeGang(afterBreakIn(), 'west-corridor');
    for (const id of ['lab', 'pharmacy', 'east-corridor']) s.rooms[id].locked = true;
    s = runFor(s, 8 * w.ms.spreadTick);
    for (const id of ['lab', 'pharmacy', 'east-corridor']) expect(s.groups.some((g) => g.room === id)).toBe(false);
  });

  it('master keys make the gang faster, but never open a locked door', () => {
    let s = placeGang(afterBreakIn(), 'key-room');
    s.rooms['key-room'].locked = true;
    s = runUntil(s, (x) => x.masterKeys);
    s = runFor(s, 10 * w.ms.masterKeysTick);
    expect(s.groups.map((g) => g.room)).toEqual(['key-room']);
  });
});

describe('special rooms', () => {
  it('Key Room: master keys make the gang faster', () => {
    let s = placeGang(runUntil(started(), (x) => x.brokenIn), 'key-room');
    s.rooms['key-room'].locked = true;
    s = runUntil(s, (x) => x.masterKeys);
    const first = s.nextSpreadMs;
    s = runUntil(s, (x) => x.nextSpreadMs > first);
    expect(s.nextSpreadMs - first).toBe(w.ms.masterKeysTick);
    expect(w.ms.masterKeysTick).toBeLessThan(w.ms.spreadTick);
  });

  it('Archive: once wrecked, repair is disabled', () => {
    let s = placeGang(runUntil(started(), (x) => x.brokenIn), 'archive');
    s.rooms.archive.locked = true;
    s = runUntil(s, (x) => x.backupsLost);
    expect(s.backupsLost).toBe(true);
    expect(applyIntent(s, { type: 'action', action: 'repair', room: 'archive' }).error).toMatch(/Archive/);
  });
});

describe('shift-start intro', () => {
  const radioCheck = (s: GameState) => s.log.filter((l) => l.kind === 'radio').map((l) => l.speaker);

  it('plays before the clock starts, then hands over at 00:00 with the radio check', () => {
    let s = applyIntent(initialState(), { type: 'start' }).state;
    expect(s.phase).toBe('intro');
    s = advance(s, 10_000);
    expect(s.phase).toBe('intro');
    expect(s.timeMs).toBe(0);
    expect(radioCheck(s)).toEqual([]);
    while (s.phase === 'intro') s = advance(s, 100);
    expect(s.phase).toBe('running');
    expect(s.introMs).toBe(w.ms.intro);
    expect(s.timeMs).toBe(0);
    expect(radioCheck(s)).toEqual(['Sam', 'Priya', 'Tom']);
  });

  it('can be skipped, and the radio check still happens', () => {
    const s = started();
    expect(s.phase).toBe('running');
    expect(radioCheck(s)).toEqual(['Sam', 'Priya', 'Tom']);
  });

  it('does not change the night: watching the intro or skipping it gives the same game', () => {
    let watched = applyIntent(initialState(), { type: 'start' }).state;
    while (watched.phase === 'intro') watched = advance(watched, 100);
    const skipped = started();
    const night = (s: GameState) => runUntil(s, () => false);
    expect({ ...night(watched), accMs: 0 }).toEqual({ ...night(skipped), accMs: 0 });
  });

  it('blocks actions and pausing until it is over', () => {
    const s = applyIntent(initialState(), { type: 'start' }).state;
    expect(applyIntent(s, { type: 'action', action: 'patrol', room: 'lab' }).error).toMatch(/Enter/);
    expect(applyIntent(s, { type: 'togglePause' }).error).toMatch(/Enter/);
  });
});

describe('radio lines', () => {
  it('vary from dispatch to dispatch', () => {
    let s = started();
    s = act(s, 'patrol', 'lab', 'sam');
    s = runUntil(s, (x) => !x.guards.find((g) => g.id === 'sam')!.task);
    s = act(s, 'patrol', 'pharmacy', 'sam');
    const asks = s.log.filter((l) => l.speaker === 'You').map((l) => l.text);
    const replies = s.log.filter((l) => l.speaker === 'Sam' && l.kind === 'radio').map((l) => l.text);
    expect(asks[0]).toBe('Sam, check the Lab Gallery.');
    expect(asks[1]).not.toBe(asks[0].replace('Lab Gallery', 'Pharmacy Gallery'));
    expect(new Set(replies).size).toBe(replies.length);
  });
});

describe('intents', () => {
  it('rejects malformed actions', () => {
    expect(isIntent({ type: 'action', action: 'explode', room: 'lab' })).toBe(false);
    expect(isIntent({ type: 'action', action: 'patrol' })).toBe(false);
    expect(isIntent({ type: 'action', action: 'patrol', room: 'lab' })).toBe(true);
    expect(isIntent({ type: 'increment' })).toBe(false);
  });

  it('reset brings back the same night', () => {
    const played = runFor(started(), 60_000);
    const reset = applyIntent(played, { type: 'reset' }).state;
    expect(reset).toEqual(initialState());
  });
});

describe('end of night summary', () => {
  it('an idle night: never detected, every decided bark ignored, care collapses after the loss', () => {
    const s = idleNight();
    const sum = s.outcome!.summary;
    expect(sum.mttdMs).toBeNull();
    expect(sum.mttrMs).toBeNull();
    expect(s.stats.rexFollowed).toBe(0);
    // A bark still inside its window when the night ends was never decided.
    expect(s.stats.rexIgnored).toBeGreaterThanOrEqual(s.stats.barks - 1);
    expect(s.stats.rexIgnored).toBeLessThanOrEqual(s.stats.barks);
    expect(s.stats.rexIgnoredRight).toBeLessThanOrEqual(s.stats.rexIgnored);
    expect(sum.careContinuity).toBeLessThan(70);
  });

  it('a quick catch: MTTD from break-in to spotted, MTTR from spotted to trapped', () => {
    let s = act(runUntil(started(), (x) => x.brokenIn), 'patrol', 'mail-room', 'priya');
    s = runUntil(s, (x) => x.groups.length > 1);
    s = act(s, 'lock', 'mail-room', 'sam');
    s = act(s, 'lock', 'entrance-hall', 'tom');
    s = runUntil(s, (x) => x.stats.firstSpottedMs !== null && x.stats.containedMs !== null);
    const { brokenInMs, firstSpottedMs, containedMs } = s.stats;
    s = runUntil(s, (x) => !x.guards.some((g) => g.task));
    s = evictAndCatch(s, 'mail-room', 'sam');
    s = evictAndCatch(s, 'entrance-hall', 'tom');
    s = runUntil(s, (x) => x.phase === 'ended');
    const sum = s.outcome!.summary;
    expect(s.outcome!.result).toBe('won');
    expect(sum.mttdMs).toBe(firstSpottedMs! - brokenInMs!);
    expect(sum.mttrMs).toBe(Math.max(0, containedMs! - firstSpottedMs!));
    expect(sum.careContinuity).toBeGreaterThan(90);
  });

  it('containment is undone when a group roams free again', () => {
    let s = runUntil(runUntil(started(), (x) => x.brokenIn), (x) => x.groups.length > 1);
    s = act(s, 'lock', 'mail-room', 'sam');
    s = act(s, 'lock', 'entrance-hall', 'tom');
    s = runUntil(s, (x) => x.stats.containedMs !== null);
    s = act(s, 'unlock', 'entrance-hall', 'tom');
    s = runUntil(s, (x) => !x.rooms['entrance-hall'].locked);
    expect(s.stats.containedMs).toBeNull();
  });
});
