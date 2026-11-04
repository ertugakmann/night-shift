import { createContext, useContext } from 'react';
import { PLAN_ORDER, type ScreenId } from '@night-shift/shared';
import { useGame } from '../net/game';

/**
 * Which order a screen belongs to. 'room': a /screen/x page on a physical screen, placed by ROOM_ORDER.
 * 'plan': /wall and /preview, which always keep the plan order 1 to 5.
 */
export const OrderContext = createContext<'room' | 'plan'>('plan');

/** Where this screen stands, left to right: 0 is the leftmost, 4 the rightmost. */
export function useScreenPosition(id: ScreenId): number {
  const kind = useContext(OrderContext);
  const { roomOrder } = useGame();
  const order = kind === 'room' ? roomOrder : PLAN_ORDER;
  const i = order.indexOf(id);
  return i === -1 ? PLAN_ORDER.indexOf(id) : i;
}
