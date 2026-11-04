import { describe, expect, it } from 'vitest';
import { DEFAULT_ROOM_ORDER, parseRoomOrder } from './screens';

describe('ROOM_ORDER', () => {
  it('reads a physical order, spaces allowed', () => {
    expect(parseRoomOrder('2,1,3,4,5')).toEqual([2, 1, 3, 4, 5]);
    expect(parseRoomOrder(' 5, 4 ,3,2,1 ')).toEqual([5, 4, 3, 2, 1]);
  });

  it('rejects anything that is not each screen exactly once', () => {
    for (const bad of [undefined, '', '1,2,3,4', '1,2,3,4,5,1', '1,1,3,4,5', '0,1,2,3,4', '1,2,3,4,x', '1;2;3;4;5']) {
      expect(parseRoomOrder(bad)).toBeNull();
    }
  });

  it('defaults to the desk on the far left', () => {
    expect(DEFAULT_ROOM_ORDER).toEqual([2, 1, 3, 4, 5]);
  });
});
