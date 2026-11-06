import { describe, expect, it } from 'vitest';
import { NO_POINTER, parsePointer, shownSelection } from './mirror';
import { DEMO } from './scenario';

const lab = DEMO.rooms[0].id;

describe('presenter pointer mirror', () => {
  it('keeps a valid pointer, rounds and clamps the cursor to the desk', () => {
    expect(parsePointer({ selected: lab, hover: lab, cursor: { x: 812.6, y: -40, touch: true } })).toEqual({
      selected: lab,
      hover: lab,
      cursor: { x: 813, y: 0, touch: true },
    });
    expect(parsePointer({ cursor: { x: 99999, y: 1e9 } })?.cursor).toEqual({ x: 1600, y: 900, touch: false });
  });

  it('drops anything untrusted', () => {
    expect(parsePointer(null)).toBeNull();
    expect(parsePointer('x')).toBeNull();
    expect(parsePointer({ selected: 'no-such-room', hover: 3, cursor: { x: NaN, y: 1 } })).toEqual(NO_POINTER);
    expect(parsePointer({ cursor: { x: '1', y: 2 } })?.cursor).toBeNull();
  });

  it('watchers see the presenter selection, controllers keep their own', () => {
    const p = { ...NO_POINTER, selected: lab };
    expect(shownSelection('watcher', null, p)).toBe(lab);
    expect(shownSelection('watcher', 'other', null)).toBeNull();
    expect(shownSelection('controller', null, p)).toBeNull();
    expect(shownSelection('presenter', 'x', p)).toBe('x');
  });
});
