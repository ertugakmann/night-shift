import { Navigate, useLocation, useParams } from 'react-router';
import { parseScreenId, type ScreenId } from '@night-shift/shared';
import { OrderContext, useScreenPosition } from '../components/position';
import { ScreenPanel } from '../components/ScreenPanel';

/**
 * One physical wall screen, full size. It knows where it stands in the room (ROOM_ORDER), which sets
 * its turn in the power-on, the Lights on wave and its piece of the Input → Output strip.
 */
export function ScreenPage() {
  const id = parseScreenId(useParams().id);
  const { search } = useLocation();
  if (id === null) return <Navigate to={`/${search}`} replace />;
  return (
    <OrderContext.Provider value="room">
      <PhysicalScreen id={id} />
    </OrderContext.Provider>
  );
}

function PhysicalScreen({ id }: { id: ScreenId }) {
  const position = useScreenPosition(id);
  return (
    <main className="h-full w-full" data-screen={id} data-position={position}>
      <ScreenPanel id={id} />
    </main>
  );
}
