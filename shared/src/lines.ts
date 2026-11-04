// Guard radio lines. Picked by a counter, not the RNG, so dialogue never changes how the gang moves.
import type { ActionKind } from './engine';

type GuardLines = {
  reply: string[];
  found: string[];
  empty: string[];
};

const LINES: Record<string, GuardLines> = {
  sam: {
    reply: ['On my way, chief.', 'Copy that.', 'Heading there now.'],
    found: ['Got them. Shadows in {room}.', 'Eyes on them in {room}.'],
    empty: ['All quiet in {room}.', 'Nothing in {room}, chief.'],
  },
  priya: {
    reply: ['On it!', 'Already moving, chief.', 'Leave it to me.'],
    found: ['There! Intruders in {room}!', 'Found them, {room}!'],
    empty: ['{room} is clear.', 'Nobody in {room}. Just a very judgemental statue.'],
  },
  tom: {
    reply: ['On my way. Slowly.', 'Roger, chief.', 'Putting the biscuit down. Going.'],
    found: ["Uh, chief? Something's moving in {room}.", 'Torch on... yep. Intruders in {room}.'],
    empty: ['Just me and the mops in {room}.', 'Empty. {room} is all quiet.'],
  },
};

const FALLBACK: GuardLines = LINES.sam;

const VERB: Record<ActionKind, string> = {
  patrol: 'check',
  lock: 'lock',
  evict: 'clear out',
  repair: 'repair',
  candlelight: 'light the candles in',
};

function pick(list: string[], n: number): string {
  return list[n % list.length];
}

export function dispatchLine(guardName: string, action: ActionKind, target: string): string {
  return `${guardName}, ${VERB[action]} ${target}.`;
}

export function replyLine(guardId: string, n: number): string {
  return pick((LINES[guardId] ?? FALLBACK).reply, n);
}

export function foundLine(guardId: string, n: number, room: string): string {
  return pick((LINES[guardId] ?? FALLBACK).found, n).replace('{room}', room);
}

export function emptyLine(guardId: string, n: number, room: string): string {
  const line = pick((LINES[guardId] ?? FALLBACK).empty, n).replace('{room}', room);
  return line.charAt(0).toUpperCase() + line.slice(1);
}
