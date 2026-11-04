import type { ScreenId } from '@night-shift/shared';
import { BuildingScreen } from '../building/BuildingScreen';
import { DeskScreen } from '../desk/DeskScreen';
import { ControlCodeCard } from './ControlCodeCard';

/**
 * One wall screen, drawn as an SVG scene that scales cleanly: full screen on the real wall, or inside a
 * small monitor in /wall. Screens 1, 3, 4, 5 are slices of the building; screen 2 is the head guard's desk.
 */
export function ScreenPanel({ id }: { id: ScreenId }) {
  return (
    <section className="panel relative h-full w-full overflow-hidden bg-[#0c0922]">
      {id === 2 ? <DeskScreen /> : <BuildingScreen screen={id} />}
      {id === 2 && <ControlCodeCard />}
    </section>
  );
}
