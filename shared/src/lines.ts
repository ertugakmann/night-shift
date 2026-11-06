// Guard radio lines. Picked by a counter, not the RNG, so dialogue never changes how the gang moves.
// Sam is calm and dry, Mia is keen, Tom is cheerful and always thinking about snacks.
import type { ActionKind } from './engine';

type GuardLines = {
  reply: string[];
  found: string[];
  empty: string[];
  locked: string[];
  evicted: string[];
  evictEmpty: string[];
  repaired: string[];
  candles: string[];
};

const LINES: Record<string, GuardLines> = {
  sam: {
    reply: ['On my way, chief.', 'Copy that.', 'Heading there now.', 'Got it. Walking.', 'Already moving.'],
    found: ['Got them. Shadows in {room}.', 'Eyes on them in {room}.', 'Berets spotted in {room}. Two at least.'],
    empty: ['All quiet in {room}.', 'Nothing in {room}, chief.', '{room} is empty. Just the exhibits.'],
    locked: ['{Room} is locked.', 'Doors shut on {room}.', '{Room} sealed. Nobody in or out.'],
    evicted: ['Caught them. {Room} is clear.', '{Room} cleared. Caught and shown the door.'],
    evictEmpty: ['Nobody in {room}, chief.', 'Searched {room}. No one here.'],
    repaired: ['{Room} is back on and open.', 'Fixed. {Room} is running again.'],
    candles: ['Candles lit in {wing}. Staff are on paper.', '{Wing} is on candlelight. Slower, but it works.'],
  },
  mia: {
    reply: ['On it!', 'Already moving, chief.', 'Leave it to me.', 'Running! Well, power-walking.', "Say no more, I'm going."],
    found: ['There! Intruders in {room}!', 'Found them, {room}!', 'Gotcha! They’re in {room}!'],
    empty: ['{room} is clear.', 'Nobody in {room}. Just a very judgemental statue.', 'Checked every corner of {room}. Empty.'],
    locked: ['{Room} locked tight!', 'Click! {Room} is sealed.', '{Room} locked. Not even a mouse gets in.'],
    evicted: ['Caught them all! {Room} is clear.', 'Gotcha! Bye bye, berets. {Room} cleared.'],
    evictEmpty: ['Nobody in {room}. They must have slipped off.', '{Room} was empty when I got here.'],
    repaired: ['{Room} is good as new!', 'Polished and running. {Room} is open again.'],
    candles: ['{Wing} is on candles now. Very romantic.', 'Candles lit in {wing}!'],
  },
  tom: {
    reply: ['On my way. Slowly.', 'Roger, chief.', 'Putting the biscuit down. Going.', 'Right after this sip. Kidding, going.', 'Aye aye. Bringing my torch and my snacks.'],
    found: ["Uh, chief? Something's moving in {room}.", 'Torch on... yep. Intruders in {room}.', 'Chief! Little shadows in berets in {room}!'],
    empty: ['Just me and the mops in {room}.', 'Empty. {room} is all quiet.', 'Nothing in {room}. Found a lost glove, though.'],
    locked: ['{Room} is locked. I checked twice.', 'Locked {room}. Keys back in my pocket.', '{Room} sealed. Like my lunchbox.'],
    evicted: ['Caught them! Shoo! {Room} is clear.', 'Caught them faster than I eat biscuits. {Room} is clear.'],
    evictEmpty: ['Nobody in {room}. Just echoes.', '{Room} is empty, chief. Did they hear me coming?'],
    repaired: ['{Room} is fixed. Mostly with tape.', 'Back on! {Room} is open again.'],
    candles: ['Candles lit in {wing}. Smells like birthday cake.', '{Wing} on candlelight, chief.'],
  },
};

const FALLBACK: GuardLines = LINES.sam;

/** How the head guard asks, a few ways per action. {name} is the guard, {target} the room or wing. */
const DISPATCH: Record<ActionKind, string[]> = {
  patrol: ['{name}, check {target}.', '{name}, take a look in {target}.', '{name}, shine a light in {target}, please.'],
  lock: ['{name}, lock {target}.', '{name}, seal {target}.', '{name}, lock up {target} now.'],
  unlock: ['{name}, take the padlock off {target}.', '{name}, open {target} again.'],
  evict: ['{name}, catch them in {target}.', '{name}, go catch the intruders in {target}.', '{name}, catch those berets in {target}.'],
  repair: ['{name}, repair {target}.', '{name}, get {target} running again.', '{name}, fix up {target}.'],
  candlelight: ['{name}, light the candles in {target}.', '{name}, switch {target} to candlelight.'],
};

function pick(list: string[], n: number): string {
  return list[((n % list.length) + list.length) % list.length];
}

function upper(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Fill {room}/{Room}/{wing}/{Wing} and capitalise the sentence. */
function fill(line: string, values: { room?: string; wing?: string }): string {
  const out = line
    .replaceAll('{Room}', upper(values.room ?? ''))
    .replaceAll('{room}', values.room ?? '')
    .replaceAll('{Wing}', upper(values.wing ?? ''))
    .replaceAll('{wing}', values.wing ?? '');
  return upper(out);
}

function lines(guardId: string): GuardLines {
  return LINES[guardId] ?? FALLBACK;
}

export function dispatchLine(guardName: string, action: ActionKind, target: string, n = 0): string {
  return pick(DISPATCH[action], n).replace('{name}', guardName).replace('{target}', target);
}

export function replyLine(guardId: string, n: number): string {
  return pick(lines(guardId).reply, n);
}

export function foundLine(guardId: string, n: number, room: string): string {
  return fill(pick(lines(guardId).found, n), { room });
}

export function emptyLine(guardId: string, n: number, room: string): string {
  return fill(pick(lines(guardId).empty, n), { room });
}

export function lockedLine(guardId: string, n: number, room: string): string {
  return fill(pick(lines(guardId).locked, n), { room });
}

export function evictedLine(guardId: string, n: number, room: string): string {
  return fill(pick(lines(guardId).evicted, n), { room });
}

export function evictEmptyLine(guardId: string, n: number, room: string): string {
  return fill(pick(lines(guardId).evictEmpty, n), { room });
}

export function repairedLine(guardId: string, n: number, room: string): string {
  return fill(pick(lines(guardId).repaired, n), { room });
}

export function candlesLine(guardId: string, n: number, wing: string): string {
  return fill(pick(lines(guardId).candles, n), { wing });
}
