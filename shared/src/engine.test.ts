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
  finaleActive,
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

/** Test setup: a patrol has spotted the gang in `room` (Evict needs that). */
function spotted(s: GameState, room: string): GameState {
  const copy: GameState = JSON.parse(JSON.stringify(s));
  for (const g of copy.groups) if (g.room === room) g.spotted = true;
  return copy;
}

/** Repair, and win the wires: wait for the guard to arrive, then join every cable to its colour. */
function repairAndWire(s: GameState, room: string, guard?: string): GameState {
  s = act(s, 'repair', room, guard);
  s = runUntil(s, (x) => (x.wires?.room === room && x.wires.result === null) || !x.guards.some((g) => g.task?.action === 'repair'));
  if (!s.wires || s.wires.result !== null) return s;
  const { left, right } = s.wires;
  left.forEach((colour, from) => {
    s = applyIntent(s, { type: 'wire', from, to: right.indexOf(colour) }).state;
  });
  return s;
}

/** Evict, and win the catch: wait for the guard to arrive, then click every intruder. */
function evictAndCatch(s: GameState, room: string, guard?: string): GameState {
  s = act(spotted(s, room), 'evict', room, guard);
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
    for (const b of barks) expect(Number(/(\d+)% sure/.exec(b.text)![1])).toBeGreaterThan(50);
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

  it('a lock (or evict) on the room he barked at follows him too; one bark is one decision', () => {
    let s = runUntil(started(), (x) => x.rex.mistake !== null);
    const room = s.rex.mistake!.room;
    s = act(s, 'lock', room, 'sam');
    expect(s.stats.rexFollowed).toBe(1);
    expect(s.stats.rexFollowedWrong).toBe(1); // the planned mistake: nobody there
    s = act(s, 'patrol', room, 'priya');
    expect(s.stats.rexFollowed).toBe(1); // the same bark only counts once
    s = runFor(s, w.ms.followWindow + 200);
    expect(s.stats.rexIgnored + s.stats.rexFollowed).toBeLessThanOrEqual(s.stats.barks);
  });

  it('the window is 10 seconds: a lock 9 s after the bark still follows him', () => {
    expect(w.ms.followWindow).toBe(10_000);
    let s = runUntil(started(), (x) => x.rex.mistake !== null);
    const room = s.rex.mistake!.room;
    s = runFor(s, 9000);
    s = act(s, 'lock', room, 'tom');
    expect(s.stats.rexFollowed).toBe(1);
  });

  it('candlelight is not an answer to a bark: after 10 s it counts as ignored', () => {
    let s = runUntil(started(), (x) => x.rex.mistake !== null);
    const room = s.rex.mistake!.room;
    const wrongIgnored = (x: GameState) => x.stats.rexIgnored - x.stats.rexIgnoredRight;
    const before = wrongIgnored(s);
    s = act(s, 'lock', 'lab', 'priya'); // close something in the wing so candles are allowed
    s = runUntil(s, (x) => x.rooms.lab.locked);
    const lit = applyIntent(s, { type: 'action', action: 'candlelight', room, guard: 'sam' });
    s = lit.error ? s : lit.state;
    s = runFor(s, w.ms.followWindow + 200);
    expect(s.stats.rexFollowed).toBe(0);
    expect(wrongIgnored(s)).toBe(before + 1);
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
    let s = act(spotted(afterBreakIn(), 'mail-room'), 'evict', 'mail-room', 'tom');
    const second = applyIntent(s, { type: 'action', action: 'evict', room: 'entrance-hall', guard: 'sam' });
    expect(second.error).toMatch(/One mini game at a time/);
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

    s = repairAndWire(s, 'lab', 'sam');
    expect(s.rooms.lab.locked).toBe(false);
    s = runFor(s, 200);
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
    s = act(spotted(s, 'mail-room'), 'evict', 'mail-room', 'sam');
    return runUntil(s, (x) => x.catch !== null);
  }

  it('starts when the guard arrives: intruders hidden among innocent visitors, 8.5 seconds on the clock', () => {
    const s = catching();
    const c = s.catch!;
    expect(c.room).toBe('mail-room');
    expect(c.endsMs - c.startedMs).toBe(8500);
    expect(c.aim).toBeNull();
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
    s = act(spotted(s, 'mail-room'), 'evict', 'mail-room', 'sam');
    s = runUntil(s, (x) => x.catch !== null);
    s = runUntil(s, (x) => x.catch?.result !== null);
    expect(s.catch!.result).toBe('escaped');
    expect(s.catch!.to).toBe('west-corridor');
    expect(s.groups.filter((g) => !g.stream).map((g) => g.room)).toEqual(['west-corridor']); // (phishing letters may let others in)
  });

  it('time runs out in an open room with every way out blocked: they stay put', () => {
    let s = placeGang(runUntil(started(), (x) => x.brokenIn), 'mail-room');
    s.rooms['entrance-hall'].locked = true;
    s.rooms['west-corridor'].locked = true;
    s = act(spotted(s, 'mail-room'), 'evict', 'mail-room', 'sam');
    s = runUntil(s, (x) => x.catch !== null);
    s = runUntil(s, (x) => x.catch?.result !== null);
    expect(s.catch!.result).toBe('held');
    expect(s.groups.map((g) => g.room)).toEqual(['mail-room']);
  });

  it('needs the gang spotted first: no Evict in a room nobody has patrolled', () => {
    const s = runUntil(started(), (x) => x.groups.length > 1);
    const blind = applyIntent(s, { type: 'action', action: 'evict', room: 'mail-room', guard: 'sam' });
    expect(blind.error).toMatch(/Spot them first/);
    // a patrol reveals them, then Evict is fine
    let p = act(s, 'patrol', 'mail-room', 'sam');
    p = runUntil(p, (x) => x.groups.some((g) => g.room === 'mail-room' && g.spotted));
    expect(applyIntent(p, { type: 'action', action: 'evict', room: 'mail-room', guard: 'tom' }).error).toBeUndefined();
  });

  it('the flashlight: every screen sees where the player points it', () => {
    let s = catching();
    s = applyIntent(s, { type: 'aim', x: 420, y: 515 }).state;
    expect(s.catch!.aim).toEqual({ x: 420, y: 515 });
    s = applyIntent(s, { type: 'aim', x: -50, y: 2000 }).state;
    expect(s.catch!.aim).toEqual({ x: 0, y: 900 });
    expect(isIntent({ type: 'aim', x: 1, y: Number.NaN })).toBe(false);
  });

  it('a click without a catch is refused', () => {
    expect(applyIntent(started(), { type: 'catch', figure: 1 }).error).toMatch(/No catch/);
    expect(isIntent({ type: 'catch', figure: 2 })).toBe(true);
    expect(isIntent({ type: 'catch', figure: 'x' })).toBe(false);
  });
});

describe('Reconnect the exhibit (Repair)', () => {
  /** The Lab locked (no gang inside) and a guard arrived to repair it. */
  function wiring(): GameState {
    let s = act(started(), 'lock', 'lab', 'sam');
    s = runUntil(s, (x) => x.rooms.lab.locked && !x.guards.some((g) => g.task));
    s = act(s, 'repair', 'lab', 'sam');
    return runUntil(s, (x) => x.wires !== null);
  }

  it('starts when the guard arrives: 4 cables in mixed order, 8 seconds', () => {
    const s = wiring();
    const g = s.wires!;
    expect(g.room).toBe('lab');
    expect(g.endsMs - g.startedMs).toBe(8000);
    expect([...g.left].sort()).toEqual([0, 1, 2, 3]);
    expect([...g.right].sort()).toEqual([0, 1, 2, 3]);
    expect(g.left.every((c, i) => g.right[i] !== c)).toBe(true); // no cable runs straight across
  });

  it('joining every cable to its colour repairs the room at once and gives the padlock back', () => {
    let s = wiring();
    const { left, right } = s.wires!;
    left.forEach((colour, from) => {
      s = applyIntent(s, { type: 'wire', from, to: right.indexOf(colour) }).state;
    });
    expect(s.wires!.result).toBe('fixed');
    expect(s.rooms.lab.locked).toBe(false);
    expect(s.stats.repairs).toBe(1);
    expect(padlocks(s).free).toBe(3);
    expect(s.guards.find((g) => g.id === 'sam')!.task).toBeNull();
  });

  it('a wrong socket sparks, joins nothing and costs no time', () => {
    let s = wiring();
    const { left, right, endsMs } = s.wires!;
    const wrongTo = right.findIndex((c) => c !== left[0]);
    s = applyIntent(s, { type: 'wire', from: 0, to: wrongTo }).state;
    expect(s.wires!.connected).toEqual([]);
    expect(s.wires!.sparkAtMs).toBe(s.timeMs);
    expect(s.wires!.endsMs).toBe(endsMs);
  });

  it('out of time: the repair fails, the room stays as it was, and it can be tried again', () => {
    let s = wiring();
    s = runUntil(s, (x) => x.wires?.result !== null);
    expect(s.wires!.result).toBe('failed');
    expect(s.rooms.lab.locked).toBe(true);
    expect(s.stats.repairs).toBe(0);
    s = runFor(s, 2000);
    expect(s.wires).toBeNull();
    s = repairAndWire(s, 'lab', 'sam');
    expect(s.rooms.lab.locked).toBe(false);
  });

  it('one mini game at a time: a guard who arrives while another one runs waits for it', () => {
    let s = act(started(), 'lock', 'lab', 'sam');
    s = act(s, 'lock', 'pharmacy', 'priya');
    s = runUntil(s, (x) => x.rooms.lab.locked && x.rooms.pharmacy.locked && !x.guards.some((g) => g.task));
    s = act(s, 'repair', 'lab', 'sam');
    expect(applyIntent(s, { type: 'action', action: 'repair', room: 'pharmacy', guard: 'priya' }).error).toMatch(/One mini game at a time/);
    // the Key Room game can still start on its own, so a guard can arrive to a busy desk: they wait
    s = runUntil(s, (x) => x.wires !== null);
    const paused: GameState = JSON.parse(JSON.stringify(s));
    paused.guards.find((g) => g.id === 'priya')!.task = { action: 'repair', room: 'pharmacy', path: ['pharmacy'], walkMs: 0, workMs: 0, elapsedMs: 0, arrived: false, found: false };
    paused.guards.find((g) => g.id === 'priya')!.room = 'pharmacy';
    let w2 = runFor(paused, 1000);
    expect(w2.wires!.room).toBe('lab');
    expect(w2.guards.find((g) => g.id === 'priya')!.task?.started).toBeFalsy();
    w2 = runUntil(w2, (x) => x.wires?.room === 'pharmacy');
    expect(w2.wires!.room).toBe('pharmacy');
  });

  it('a wire without a repair is refused', () => {
    expect(applyIntent(started(), { type: 'wire', from: 0, to: 0 }).error).toMatch(/No repair/);
    expect(isIntent({ type: 'wire', from: 1, to: 2 })).toBe(true);
    expect(isIntent({ type: 'wire', from: 'a', to: 2 })).toBe(false);
  });
});

describe('Change the locks (the Key Room falls)', () => {
  /** The gang in the Key Room until it falls. */
  function keyRoomFalls(): GameState {
    const s = placeGang(runUntil(started(), (x) => x.brokenIn), 'key-room');
    s.rooms['key-room'].locked = true; // keep them there
    return runUntil(s, (x) => x.keys !== null);
  }

  it('starts on its own when the master keys are stolen: a short code, 6 seconds', () => {
    const s = keyRoomFalls();
    expect(s.masterKeys).toBe(true);
    expect(s.keys!.code).toMatch(/^[A-Z]{3}-\d$/);
    expect(s.keys!.endsMs - s.keys!.startedMs).toBe(6000);
    for (const c of s.keys!.code.replace('-', '')) expect(s.keys!.tiles).toContain(c);
    expect(s.log.some((l) => l.kind === 'event' && l.text.startsWith('Change the locks!'))).toBe(true);
  });

  it('typing the code in time takes the master keys away: the gang slows down again', () => {
    let s = keyRoomFalls();
    for (const c of s.keys!.code.replace('-', '')) s = applyIntent(s, { type: 'code', char: c.toLowerCase() }).state;
    expect(s.keys!.result).toBe('changed');
    expect(s.masterKeys).toBe(false);
    expect(s.stats.keysChanged).toBe(true);
    const first = s.nextSpreadMs;
    s = runUntil(s, (x) => x.nextSpreadMs > first);
    expect(s.nextSpreadMs - first).toBe(w.ms.spreadTick);
  });

  it('a wrong character starts the typing again', () => {
    let s = keyRoomFalls();
    const code = s.keys!.code.replace('-', '');
    s = applyIntent(s, { type: 'code', char: code[0] }).state;
    expect(s.keys!.typed).toBe(1);
    s = applyIntent(s, { type: 'code', char: code[0] === 'Q' ? 'X' : 'Q' }).state;
    expect(s.keys!.typed).toBe(0);
    expect(s.keys!.wrongAtMs).toBe(s.timeMs);
  });

  it('too slow: the gang keeps the master keys', () => {
    let s = keyRoomFalls();
    s = runUntil(s, (x) => x.keys?.result !== null);
    expect(s.keys!.result).toBe('kept');
    expect(s.masterKeys).toBe(true);
  });

  it('an idle night keeps the same route: the locks are never changed', () => {
    const night = idleNight();
    expect(night.stats.keysStolen).toBe(true);
    expect(night.stats.keysChanged).toBe(false);
  });
});

describe('patient impact stays realistic', () => {
  it('a lost night: a few dozen tests at most, and the major incident diverts ambulances', () => {
    const n = idleNight();
    expect(n.outcome!.result).toBe('lost');
    expect(Math.floor(n.impact.tests)).toBeGreaterThan(3);
    expect(n.impact.tests).toBeLessThanOrEqual(40);
    expect(n.impact.medicines).toBeLessThanOrEqual(30);
    expect(n.impact.surgeries).toBeLessThanOrEqual(6);
    expect(Math.floor(n.impact.ambulances)).toBeGreaterThanOrEqual(2);
    expect(n.impact.ambulances).toBeLessThanOrEqual(6);
  });

  it('the lab closed for three hours delays about thirty tests', () => {
    let s = act(started(), 'lock', 'lab', 'sam');
    s = runUntil(s, (x) => x.rooms.lab.locked);
    const after = runFor(s, 3 * w.ms.gameHour);
    const tests = after.impact.tests - s.impact.tests;
    expect(tests).toBeGreaterThan(20);
    expect(tests).toBeLessThanOrEqual(36);
  });
});

describe('critical departments and candlelight', () => {
  it('staff complain on the radio when a critical room is locked, once per closure', () => {
    let s = act(started(), 'lock', 'lab', 'sam');
    s = runUntil(s, (x) => x.rooms.lab.locked);
    s = runFor(s, 300);
    const lines = s.log.filter((l) => l.kind === 'staff' && l.room === 'lab');
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toMatch(/blood tests/);
    s = act(s, 'unlock', 'lab', 'sam');
    s = runUntil(s, (x) => !x.rooms.lab.locked);
    s = act(s, 'lock', 'lab', 'sam');
    s = runUntil(s, (x) => x.rooms.lab.locked);
    s = runFor(s, 300);
    expect(s.log.filter((l) => l.kind === 'staff' && l.room === 'lab')).toHaveLength(2);
  });

  it('a non-critical room closes quietly', () => {
    let s = act(started(), 'lock', 'archive', 'sam');
    s = runUntil(s, (x) => x.rooms.archive.locked);
    s = runFor(s, 300);
    expect(s.log.some((l) => l.kind === 'staff' && l.room === 'archive')).toBe(false);
  });

  it('without candlelight the patient impact climbs four times as fast', () => {
    let s = act(started(), 'lock', 'lab', 'sam');
    s = runUntil(s, (x) => x.rooms.lab.locked);
    const dark = runFor(s, 10_000);
    const darkRate = dark.impact.tests - s.impact.tests;
    let c = act(s, 'candlelight', 'pharmacy', 'priya');
    c = runUntil(c, (x) => x.candlelight.west);
    const lit = runFor(c, 10_000);
    const litRate = lit.impact.tests - c.impact.tests;
    expect(darkRate / litRate).toBeCloseTo(4, 1);
  });
});

describe('Rex explains himself', () => {
  it('every bark says what it rests on, in both voices', () => {
    const night = idleNight();
    const barks = night.log.filter((l) => l.kind === 'rex');
    for (const b of barks) {
      expect(b.text).toMatch(/^WOOF! \d+% sure about .+: .+\.$/);
      expect(b.real).toMatch(/\d+% confidence\. Evidence: .+\.$/);
    }
    // the clues are real ones from the log: a camera glitch or a staff report in that room
    expect(barks.some((b) => /camera glitched there/.test(b.text) && /EDR alert/.test(b.real!))).toBe(true);
  });

  it('a staff report in the room is quoted as evidence', () => {
    const night = idleNight();
    const quoted = night.log.filter((l) => l.kind === 'rex' && / reported "/.test(l.text));
    expect(quoted.length).toBeGreaterThan(0);
    // "Evidence: staff report + EDR alert in Network segment (east)." — the place once, no nested brackets
    expect(quoted[0].real).toMatch(/Evidence: staff report( \+ EDR alert)? in [^()]+( \([^()]+\))?\.$/);
  });

  it('when he is wrong, he leans on a camera that glitched for nothing', () => {
    const night = idleNight();
    const wrong = night.log.find((l) => l.kind === 'rex' && l.truth === false)!;
    expect(wrong.text).toMatch(/camera glitched there just now/);
    const glitch = night.log.find((l) => l.kind === 'cctv' && l.room === wrong.room && l.atMs === wrong.atMs);
    expect(glitch?.truth).toBe(false);
  });

  it('the desk can show his latest reasoning', () => {
    const s = runUntil(started(), (x) => x.rex.why !== null);
    expect(s.rex.why!.text).toContain(`${s.rex.why!.confidence}% sure`);
  });
});

describe('idle guards stroll around their wing', () => {
  const night = (() => {
    let s = started();
    const seen: Record<string, Set<string>> = { sam: new Set(), priya: new Set(), tom: new Set() };
    let biscuit = false;
    let lit = false;
    while (s.phase === 'running') {
      s = advance(s, 100);
      for (const g of s.guards) seen[g.id].add(g.room);
      if (s.guards.some((g) => g.wander?.act === 'biscuit')) biscuit = true;
      if (Object.values(s.rooms).some((r) => r.litBy)) lit = true;
    }
    return { s, seen, biscuit, lit };
  })();

  it('they move between rooms, but only in their own wing', () => {
    expect(night.seen.sam.size).toBeGreaterThan(1);
    expect(night.seen.priya.size).toBeGreaterThan(1);
    expect(night.seen.tom.size).toBeGreaterThan(1);
    for (const r of night.seen.sam) expect(w.room.get(r)!.wing).toBe('west');
    for (const r of night.seen.priya) expect(w.room.get(r)!.wing).toBe('east');
    for (const r of night.seen.tom) expect(w.room.get(r)!.wing).toBe('lobby');
  });

  it('Tom has a biscuit now and then', () => {
    expect(night.biscuit).toBe(true);
  });

  it('strolling never lights a room or finds the gang, and the night keeps its route', () => {
    expect(night.lit).toBe(false);
    expect(night.s.stats.spotted).toBe(0);
    expect(msToClock(night.s.outcome!.atMs, HOUR)).toBe('03:48');
  });

  it('an order sends them off from where the stroll has got to', () => {
    let s = runUntil(started(), (x) => x.guards.find((g) => g.id === 'tom')!.room !== 'entrance-hall');
    const tom = s.guards.find((g) => g.id === 'tom')!;
    s = act(s, 'patrol', 'key-room', 'tom');
    const task = s.guards.find((g) => g.id === 'tom')!.task!;
    expect(task.path[0]).toBe(tom.wander?.phase === 'walk' && s.timeMs - tom.wander.startMs > (tom.wander.untilMs - tom.wander.startMs) / 2 ? tom.wander.to : tom.room);
    expect(s.guards.find((g) => g.id === 'tom')!.wander).toBeNull();
  });
});

describe('feedback on the floor', () => {
  it('a guard arriving leaves an effect for the screens', () => {
    let s = act(started(), 'patrol', 'lab', 'sam');
    s = runUntil(s, (x) => x.guards.find((g) => g.id === 'sam')!.task?.arrived === true);
    expect(s.fx.some((e) => e.kind === 'arrived' && e.room === 'lab')).toBe(true);
  });

  it('a lock that lands after the gang has left: "Too late, they\'ve already moved on."', () => {
    // a spotted group in the open West Corridor flees at the next tick; Priya is far away
    let s = placeGang(runUntil(started(), (x) => x.brokenIn), 'west-corridor');
    s.groups[0].spotted = true;
    s.nextSpreadMs = s.timeMs + 1000; // they flee within a second, before the lock can land
    s.guards.find((g) => g.id === 'priya')!.room = 'radiology';
    s.guards.find((g) => g.id === 'sam')!.room = 'pharmacy';
    s = act(s, 'lock', 'west-corridor', 'priya');
    s = runUntil(s, (x) => x.rooms['west-corridor'].locked);
    expect(s.groups.some((g) => g.room === 'west-corridor')).toBe(false);
    const line = s.log.filter((l) => l.speaker === 'Priya').at(-1)!;
    expect(line.text).toBe("Too late, they've already moved on.");
    expect(line.real).toMatch(/Isolation too late/);
    expect(s.fx.some((e) => e.kind === 'late')).toBe(true);
  });

  it('a lock in time says so as usual', () => {
    let s = runUntil(started(), (x) => x.groups.length > 1);
    s = act(s, 'lock', 'mail-room', 'sam');
    s = runUntil(s, (x) => x.rooms['mail-room'].locked);
    expect(s.log.filter((l) => l.speaker === 'Sam').at(-1)!.text).not.toMatch(/Too late/);
  });
});

describe('Safe or phishing? (letters in the Mail Room)', () => {
  /** Run until a letter is on the desk, waiting for its question. */
  const nextLetter = (s: GameState) => runUntil(s, (x) => x.letter !== null && x.letter.result === null);

  it('two letters arrive in the demo night: the first a fake, the second real; a nurse asks on the radio', () => {
    let s = nextLetter(started());
    expect(s.letter!.phishing).toBe(true);
    expect(s.letter!.endsMs - s.letter!.startedMs).toBe(6000);
    expect(s.log.find((e) => e.text === 'Chief, is this letter safe to open?')).toMatchObject({ kind: 'staff', speaker: 'Nurse Ada, Ward 4', text: 'Chief, is this letter safe to open?', real: 'Chief, is this email safe to open?' });
    s = applyIntent(s, { type: 'letter', answer: 'phishing' }).state;
    s = runFor(s, 2000);
    s = nextLetter(s);
    expect(s.letter!.phishing).toBe(false);
    const fake = w.sc.phishing.letters[0];
    expect(fake.address).toBe('it-support@nhs-secure-login.co');
    expect(fake.body).toMatch(/locked in 1 hour/);
    expect(fake.link).toMatch(/nhs-secure-login/);
  });

  it('calling the fake "Phishing" and the real one "Safe": no new intruders, two right calls', () => {
    let s = nextLetter(started());
    const groups = () => s.groupLog.length;
    s = applyIntent(s, { type: 'letter', answer: 'phishing' }).state;
    expect(s.letter!.result).toBe('right');
    const before = groups();
    s = nextLetter(runFor(s, 2000));
    s = applyIntent(s, { type: 'letter', answer: 'safe' }).state;
    expect(s.letter!.result).toBe('right');
    expect(groups()).toBe(before);
    expect(s.stats.letters).toEqual({ right: 2, wrong: 0, missed: 0 });
  });

  it('a wrong call lets a new group in through the Mail Room', () => {
    let s = nextLetter(started());
    s = applyIntent(s, { type: 'letter', answer: 'safe' }).state;
    expect(s.letter!.result).toBe('wrong');
    expect(s.letter!.breach).toBe('mail-room');
    const newcomer = s.groups.at(-1)!;
    expect(newcomer.room).toBe('mail-room');
    expect(newcomer.stream).toBe('phish');
    expect(s.stats.letters.wrong).toBe(1);
  });

  it('no answer in time counts as missed, and lets them in too', () => {
    let s = nextLetter(started());
    s = runUntil(s, (x) => x.letter?.result !== null);
    expect(s.letter!.result).toBe('missed');
    expect(s.groups.some((g) => g.stream === 'phish')).toBe(true);
  });

  it('a lock is a lock: with the Mail Room locked they try the front door; with both locked, nobody gets in', () => {
    let s = act(started(), 'lock', 'mail-room', 'sam');
    s = nextLetter(s);
    s = applyIntent(s, { type: 'letter', answer: 'safe' }).state;
    expect(s.letter!.breach).toBe('entrance-hall');

    let b = act(started(), 'lock', 'mail-room', 'sam');
    b = act(b, 'lock', 'entrance-hall', 'tom');
    b = nextLetter(b);
    const before = b.groups.length;
    b = applyIntent(b, { type: 'letter', answer: 'safe' }).state;
    expect(b.letter!.breach).toBeNull();
    expect(b.groups.length).toBe(before);
  });

  it('a letter waits while another mini game is on', () => {
    let s = act(started(), 'lock', 'lab', 'sam');
    s = runUntil(s, (x) => x.rooms.lab.locked && !x.guards.some((g) => g.task));
    // start a repair just before the first letter is due
    s = runUntil(s, (x) => x.timeMs >= clockToMs(w.sc.phishing.letters[0].at, HOUR) - 1500);
    s = act(s, 'repair', 'lab', 'sam');
    s = runUntil(s, (x) => x.wires !== null);
    s = runUntil(s, (x) => x.lettersDue.length > 0);
    expect(s.letter).toBeNull();
    s = runUntil(s, (x) => x.letter !== null);
    expect(s.wires).toBeNull();
  });

  it('an idle night: both letters missed, yet the original gang keeps its route and the loss stays at 03:48', () => {
    const night = idleNight();
    expect(night.stats.letters.missed).toBe(2);
    expect(night.groupLog.length).toBeGreaterThan(3);
    expect(msToClock(night.outcome!.atMs, HOUR)).toBe('03:48');
  });

  it('the answer intent is checked', () => {
    expect(isIntent({ type: 'letter', answer: 'phishing' })).toBe(true);
    expect(isIntent({ type: 'letter', answer: 'maybe' })).toBe(false);
    expect(applyIntent(started(), { type: 'letter', answer: 'safe' }).error).toMatch(/No letter/);
  });
});

describe('R resets cleanly at any moment (demo hardening)', () => {
  const reset = (s: GameState) => {
    const r = applyIntent(s, { type: 'reset' });
    expect(r.error).toBeUndefined();
    return r.state;
  };
  const clean = (s: GameState) => expect(reset(s)).toEqual(initialState());
  const lightsOn = (s: GameState) => applyIntent(s, { type: 'toggleReality' }).state;

  const moments: [string, () => GameState][] = [
    ['before the start', () => initialState()],
    ['during the intro', () => advance(applyIntent(initialState(), { type: 'start' }).state, 5000)],
    ['mid-night', () => runFor(started(), 60_000)],
    ['paused', () => applyIntent(runFor(started(), 30_000), { type: 'togglePause' }).state],
    ['with a guard on the way', () => act(started(), 'patrol', 'vault', 'sam')],
    ['during Catch the intruders', () => {
      let s = spotted(placeGang(runFor(started(), 20_000), 'west-corridor'), 'west-corridor');
      s = act(s, 'evict', 'west-corridor', 'sam');
      s = runUntil(s, (x) => x.catch !== null);
      expect(s.catch).not.toBeNull();
      return s;
    }],
    ['during Reconnect the exhibit', () => {
      let s = act(started(), 'lock', 'lab', 'sam');
      s = runUntil(s, (x) => x.rooms.lab.locked && !x.guards.some((g) => g.task));
      s = act(s, 'repair', 'lab', 'sam');
      s = runUntil(s, (x) => x.wires !== null);
      expect(s.wires).not.toBeNull();
      return s;
    }],
    ['during Change the locks', () => {
      const s = runUntil(started(), (x) => x.keys !== null);
      expect(s.keys).not.toBeNull();
      return s;
    }],
    ['during Safe or phishing', () => {
      const s = runUntil(started(), (x) => x.letter !== null);
      expect(s.letter).not.toBeNull();
      return s;
    }],
    ['after a lost night', () => idleNight()],
    ['after the night, with Lights on', () => lightsOn(idleNight())],
    ['mid-night with Lights on', () => lightsOn(runFor(started(), 40_000))],
  ];
  for (const [name, make] of moments) it(`${name}: a fresh night, museum view`, () => clean(make()));

  it('debug stays on through a reset (rehearsals), everything else is fresh', () => {
    const s = applyIntent(runFor(started(), 30_000), { type: 'toggleDebug' }).state;
    expect(reset(s)).toEqual({ ...initialState(), debug: true });
  });

  it('after a reset the night plays exactly the same again (lost at 03:48)', () => {
    const again = runUntil(applyIntent(applyIntent(reset(lightsOn(runFor(started(), 70_000))), { type: 'start' }).state, { type: 'skipIntro' }).state, () => false);
    expect(again).toEqual(idleNight());
    expect(msToClock(again.outcome!.atMs, HOUR)).toBe('03:48');
  });

  it('pressing R twice, or S right after R, is harmless', () => {
    const twice = reset(reset(runFor(started(), 50_000)));
    expect(twice).toEqual(initialState());
    expect(applyIntent(twice, { type: 'start' }).state.phase).toBe('intro');
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
    s = repairAndWire(s, 'lab', 'sam');
    expect(s.rooms.lab.locked).toBe(false);
    expect(padlocks(s).free).toBe(3);
  });

  it('nobody gets out of a locked room: a trapped group stays put all night', () => {
    let s = placeGang(afterBreakIn(), 'west-corridor');
    s.rooms['west-corridor'].locked = true;
    s.groups[0].spotted = true; // even a spotted group, which always tries to flee
    s = runFor(s, 6 * w.ms.spreadTick);
    expect(s.groups.filter((g) => !g.stream).map((g) => g.room)).toEqual(['west-corridor']); // (phishing letters may let others in)
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
    expect(s.groups.filter((g) => !g.stream).map((g) => g.room)).toEqual(['key-room']);
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

  it('MTTD and MTTR are measured per group: from appearing to spotted, from spotted to stopped', () => {
    let s = runUntil(runUntil(started(), (x) => x.brokenIn), (x) => x.groups.length > 1);
    const mail = s.groups.find((g) => g.room === 'mail-room')!.id;
    s = act(s, 'patrol', 'mail-room', 'priya');
    s = runUntil(s, (x) => x.groups.some((g) => g.id === mail && g.spotted));
    s = act(s, 'lock', 'mail-room', 'sam');
    s = runUntil(s, (x) => x.rooms['mail-room'].locked);
    const rec = s.groupLog.find((r) => r.id === mail)!;
    expect(rec.spottedMs).not.toBeNull();
    expect(rec.stoppedMs).not.toBeNull();
    s = runUntil(s, () => false); // the other group roams on until the night ends
    const sum = s.outcome!.summary;
    expect(sum.groups).toBeGreaterThanOrEqual(2);
    expect(sum.spotted).toBe(1);
    expect(sum.stopped).toBe(1);
    expect(sum.mttdMs).toBe(rec.spottedMs! - rec.appearedMs);
    expect(sum.mttrMs).toBe(rec.stoppedMs! - rec.spottedMs!);
  });

  it('MTTD is the average over the groups that were spotted', () => {
    let s = runUntil(runUntil(started(), (x) => x.brokenIn), (x) => x.groups.length > 1);
    s = act(s, 'patrol', 'mail-room', 'priya');
    s = act(s, 'patrol', 'entrance-hall', 'tom');
    s = runUntil(s, (x) => x.groupLog.filter((r) => r.spottedMs !== null).length === 2);
    s = runUntil(s, () => false);
    const sum = s.outcome!.summary;
    const seen = s.groupLog.filter((r) => r.spottedMs !== null).map((r) => r.spottedMs! - r.appearedMs);
    expect(sum.spotted).toBe(seen.length);
    expect(seen.length).toBeGreaterThanOrEqual(2);
    expect(sum.mttdMs).toBe(Math.round(seen.reduce((x, y) => x + y, 0) / seen.length));
  });

  it('a group shut in before anyone saw it is stopped at once (no response time)', () => {
    let s = runUntil(runUntil(started(), (x) => x.brokenIn), (x) => x.groups.length > 1);
    s = act(s, 'lock', 'mail-room', 'sam');
    s = runUntil(s, (x) => x.rooms['mail-room'].locked);
    s = runUntil(s, () => false);
    const sum = s.outcome!.summary;
    expect(sum.spotted).toBe(0);
    expect(sum.mttdMs).toBeNull();
    expect(sum.stopped).toBe(1);
    expect(sum.mttrMs).toBe(0);
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

describe('Rex introduces himself (the AI, up front)', () => {
  it('after his very first bark, Sam tells everyone what Rex is: once a night', () => {
    const night = idleNight();
    const firstBark = night.log.find((l) => l.kind === 'rex')!;
    const intro = night.log.filter((l) => l.text.startsWith('Rex is our AI sniffer dog'));
    expect(intro).toHaveLength(1);
    expect(intro[0].speaker).toBe('Sam');
    expect(intro[0].text).toBe("Rex is our AI sniffer dog. He's usually right… usually.");
    expect(intro[0].atMs).toBe(firstBark.atMs);
    expect(intro[0].id).toBeGreaterThan(firstBark.id);
    expect(intro[0].real).toMatch(/AI copilot/);
  });
});

/** A night where the gang (and anyone a letter lets in) is quietly taken away, up to `ms`: a test bench for late moments. */
function quietUntil(ms: number): GameState {
  return runUntil(started(), (x) => {
    if (x.brokenIn) x.groups = [];
    return x.timeMs >= ms;
  });
}

/** Test setup: the gang stays where it is for a few seconds (no spread tick), so a guard can reach it. */
function holdStill(s: GameState): GameState {
  const copy: GameState = JSON.parse(JSON.stringify(s));
  copy.nextSpreadMs = copy.timeMs + 6000;
  return copy;
}

describe('the final dash (last 30 seconds)', () => {
  const finaleFrom = w.ms.night - w.ms.finale;

  it('is 30 real seconds, starting at 04:48 on the night clock', () => {
    expect(w.ms.finale).toBe(30_000);
    expect(msToClock(finaleFrom, HOUR)).toBe('04:48');
  });

  it('sends every free group straight for the Vault, and says so once', () => {
    let s = quietUntil(finaleFrom - 2000);
    s = placeGang(s, 'west-corridor');
    expect(finaleActive(s)).toBe(false);
    s = runUntil(s, (x) => x.timeMs >= finaleFrom + 100);
    expect(finaleActive(s)).toBe(true);
    expect(s.log.filter((l) => l.text === 'The gang makes a last dash for the Vault!')).toHaveLength(1);
    // Every spread tick from now on: one door closer to the Vault (west corridor → east corridor → emergency → vault).
    const path: string[] = [s.groups[0].room];
    s = runUntil(s, (x) => x.groups[0].room === 'vault' || x.phase !== 'running');
    for (const id of s.groups[0].visited) if (!path.includes(id)) path.push(id);
    expect(s.groups[0].room).toBe('vault');
    expect(path.slice(-3)).toEqual(['east-corridor', 'emergency', 'vault']);
  });

  it('a lock still holds: a shut-in group stays put, and the screens do not blush', () => {
    let s = quietUntil(finaleFrom - 4000);
    s = placeGang(s, 'lab');
    s = act(s, 'lock', 'lab', 'sam');
    s = runUntil(s, (x) => x.rooms.lab.locked);
    s = runUntil(s, () => false);
    expect(s.outcome?.result).toBe('won');
    expect(s.groups[0].room).toBe('lab');
    expect(s.log.some((l) => l.text.startsWith('The gang makes a last dash'))).toBe(false);
  });

  it('never touches the idle night: still lost at 03:48, Rex still wrong once at the Pharmacy', () => {
    const night = idleNight();
    expect(msToClock(night.outcome!.atMs, HOUR)).toBe('03:48');
    expect(night.finaleStarted).toBe(false);
    expect(night.log.filter((l) => l.kind === 'rex' && l.truth === false).map((l) => l.room)).toEqual(['pharmacy']);
  });
});

describe('"Phew! That was close!" (stopped one room from the Vault)', () => {
  it('locking a group in next to the Vault: Phew, and a moment of slow motion', () => {
    let s = runUntil(started(), (x) => x.timeMs >= at('02:00'));
    s = placeGang(s, 'archive');
    s = act(s, 'lock', 'archive', 'priya');
    s = runUntil(s, (x) => x.rooms.archive.locked);
    expect(s.fx.some((f) => f.kind === 'phew' && f.room === 'archive')).toBe(true);
    expect(s.log.at(-1)?.text === 'Phew! That was close!' || s.log.some((l) => l.text === 'Phew! That was close!')).toBe(true);
    expect(s.slowMs).toBeGreaterThan(0);
    // Slow motion: one real second moves the night on by only 0.3 s.
    const before = s.timeMs;
    s = advance(s, 1000);
    expect(s.timeMs - before).toBeGreaterThanOrEqual(200);
    expect(s.timeMs - before).toBeLessThanOrEqual(400);
    // ...and then back to normal.
    s = advance(s, 1000);
    s = advance(s, 1000);
    const later = s.timeMs;
    s = advance(s, 1000);
    expect(s.timeMs - later).toBe(1000);
  });

  it('throwing a group out next to the Vault counts too (while others still roam)', () => {
    let s = runUntil(started(), (x) => x.timeMs >= at('02:00'));
    s = placeGang(s, 'emergency');
    s.groups.push({ id: 98, room: 'mail-room', enteredMs: s.timeMs, spotted: false, visited: ['mail-room'] });
    s = act(s, 'lock', 'emergency', 'priya');
    s = runUntil(s, (x) => x.rooms.emergency.locked);
    const phews = s.fx.filter((f) => f.kind === 'phew').length;
    expect(phews).toBe(1);
    // Already stopped by the lock: the catch that follows is no second "Phew!".
    s = runUntil(s, (x) => x.slowMs === 0);
    s = evictAndCatch(s, 'emergency', 'priya');
    expect(s.catch?.result).toBe('caught');
    expect(s.fx.filter((f) => f.kind === 'phew').length).toBe(1);
  });

  it('a catch next to the Vault that stops a group nobody had shut in: Phew', () => {
    let s = runUntil(started(), (x) => x.timeMs >= at('02:00'));
    s = placeGang(s, 'archive');
    s.groups.push({ id: 98, room: 'mail-room', enteredMs: s.timeMs, spotted: false, visited: ['mail-room'] });
    s = evictAndCatch(holdStill(s), 'archive', 'priya');
    expect(s.catch?.result).toBe('caught');
    expect(s.fx.some((f) => f.kind === 'phew' && f.room === 'archive')).toBe(true);
  });

  it('no Phew when that catch ends the night (the end card says it all), nor far from the Vault', () => {
    let s = runUntil(started(), (x) => x.timeMs >= at('02:00'));
    s = placeGang(s, 'archive');
    s = evictAndCatch(holdStill(s), 'archive', 'priya');
    expect(s.outcome?.result).toBe('won');
    expect(s.fx.some((f) => f.kind === 'phew')).toBe(false);

    let t = runUntil(started(), (x) => x.timeMs >= at('02:00'));
    t = placeGang(t, 'lab');
    t = act(t, 'lock', 'lab', 'sam');
    t = runUntil(t, (x) => x.rooms.lab.locked);
    expect(t.fx.some((f) => f.kind === 'phew')).toBe(false);
    expect(t.slowMs).toBe(0);
  });

  it('a reset ends the slow motion', () => {
    let s = runUntil(started(), (x) => x.timeMs >= at('02:00'));
    s = placeGang(s, 'archive');
    s = act(s, 'lock', 'archive', 'priya');
    s = runUntil(s, (x) => x.rooms.archive.locked);
    expect(s.slowMs).toBeGreaterThan(0);
    s = applyIntent(s, { type: 'reset' }).state;
    expect(s.slowMs).toBe(0);
    expect(s.orders).toEqual([]);
    expect(s.finaleStarted).toBe(false);
  });
});

describe('what the morning report learns from (orders, empty locks)', () => {
  it('every order is kept with the moment it was given', () => {
    let s = runUntil(started(), (x) => x.timeMs >= at('00:30'));
    const t = s.timeMs;
    s = act(s, 'patrol', 'lab', 'sam');
    s = act(s, 'lock', 'pharmacy', 'priya');
    expect(s.orders).toEqual([
      { action: 'patrol', room: 'lab', atMs: t },
      { action: 'lock', room: 'pharmacy', atMs: t },
    ]);
  });

  it('a lock on an empty room is marked as such, a lock on the gang is not', () => {
    let s = runUntil(started(), (x) => x.timeMs >= at('02:00'));
    s = placeGang(s, 'lab');
    s = act(s, 'lock', 'lab', 'sam');
    s = act(s, 'lock', 'radiology', 'priya');
    s = runUntil(s, (x) => x.rooms.lab.locked && x.rooms.radiology.locked);
    expect(s.done.find((d) => d.room === 'lab')?.empty).toBe(false);
    expect(s.done.find((d) => d.room === 'radiology')?.empty).toBe(true);
  });
});
