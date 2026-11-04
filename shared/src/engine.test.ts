import { describe, expect, it } from 'vitest';
import {
  advance,
  applyIntent,
  clockToMs,
  initialState,
  isIntent,
  msToClock,
  world,
  type ActionKind,
  type GameState,
} from './index';

const w = world('demo');
const HOUR = w.sc.night.realSecondsPerGameHour;
const at = (clock: string) => clockToMs(clock, HOUR);

function started(): GameState {
  return applyIntent(initialState(), { type: 'start' }).state;
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

/** Test setup: replace the gang with a single group in `room`. */
function placeGang(s: GameState, room: string): GameState {
  const copy: GameState = JSON.parse(JSON.stringify(s));
  copy.groups = [{ id: 99, room, enteredMs: copy.timeMs, spotted: false, visited: [room] }];
  return copy;
}

const idleNight = () => runUntil(started(), () => false);

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

  it('is lost at the Vault between 03:00 and 04:00', () => {
    expect(night.outcome?.result).toBe('lost');
    expect(lostAt).toBeGreaterThanOrEqual(at('03:00'));
    expect(lostAt).toBeLessThan(at('04:00'));
    expect(msToClock(lostAt, HOUR)).toBe('03:34');
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

  it('counts following a bark for the trust analysis', () => {
    let s = runUntil(started(), (x) => x.rex.mistake !== null);
    s = act(s, 'patrol', s.rex.mistake!.room);
    expect(s.stats.rexFollowed).toBe(1);
    expect(s.stats.rexFollowedWrong).toBe(1);
  });
});

describe('find, trap, evict, repair', () => {
  const afterBreakIn = () => runUntil(started(), (s) => s.brokenIn);

  it('a patrol reveals the gang, and they flee at the next spread tick', () => {
    let s = act(afterBreakIn(), 'patrol', 'mail-room', 'tom');
    s = runUntil(s, (x) => x.groups[0].spotted);
    expect(s.groups[0].spotted).toBe(true);
    expect(s.log.at(-1)).toMatchObject({ kind: 'radio', speaker: 'Tom' });

    s = runUntil(s, (x) => x.groups[0].room !== 'mail-room', s.nextSpreadMs);
    expect(s.groups[0].room).toBe('entrance-hall');
  });

  it('locking traps them, evicting them all wins the night', () => {
    let s = act(afterBreakIn(), 'patrol', 'mail-room', 'tom');
    s = act(s, 'lock', 'mail-room', 'sam');
    s = runUntil(s, (x) => x.rooms['mail-room'].locked);
    expect(s.care).toBe(98);

    s = runFor(s, 20_000);
    expect(s.groups[0].room).toBe('mail-room');

    s = act(s, 'evict', 'mail-room', 'sam');
    s = runUntil(s, (x) => x.groups.length === 0);
    expect(s.phase).toBe('ended');
    expect(s.outcome?.result).toBe('won');
    expect(s.stats.evicted).toBe(1);
  });

  it('evict needs a locked room', () => {
    const result = applyIntent(afterBreakIn(), { type: 'action', action: 'evict', room: 'mail-room' });
    expect(result.error).toMatch(/Lock/);
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

describe('special rooms', () => {
  it('Key Room: master keys make the gang faster', () => {
    let s = placeGang(runUntil(started(), (x) => x.brokenIn), 'key-room');
    s.rooms['key-room'].locked = true;
    s = runUntil(s, (x) => x.masterKeys);
    const first = s.nextSpreadMs;
    s = runUntil(s, (x) => x.nextSpreadMs > first);
    expect(s.nextSpreadMs - first).toBe(10_000);
  });

  it('Archive: once wrecked, repair is disabled', () => {
    let s = placeGang(runUntil(started(), (x) => x.brokenIn), 'archive');
    s.rooms.archive.locked = true;
    s = runUntil(s, (x) => x.backupsLost);
    expect(s.backupsLost).toBe(true);
    expect(applyIntent(s, { type: 'action', action: 'repair', room: 'archive' }).error).toMatch(/Archive/);
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
