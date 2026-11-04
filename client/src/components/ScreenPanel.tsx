import type { ScreenId } from '@night-shift/shared';
import { BuildingScreen } from '../building/BuildingScreen';
import { DeskScreen } from '../desk/DeskScreen';
import { IntroOverlay } from '../intro/IntroOverlay';
import { RealityBuilding } from '../reality/RealityBuilding';
import { RealitySwitch } from '../reality/RealitySwitch';
import { ControlCodeCard } from './ControlCodeCard';

/**
 * One wall screen, drawn as an SVG scene that scales cleanly: full screen on the real wall, or inside a
 * small monitor in /wall. Screens 1, 3, 4, 5 are slices of the building; screen 2 is the head guard's desk.
 */
export function ScreenPanel({ id, embedded = false }: { id: ScreenId; embedded?: boolean }) {
  return (
    <section className="panel relative h-full w-full overflow-hidden bg-[#0c0922]">
      {id === 2 ? (
        <DeskScreen />
      ) : id === 3 ? (
        // Reality view: screen 3 first, to agree the look. The others follow once it is approved.
        <RealitySwitch id={id} museum={<BuildingScreen screen={id} />} reality={<RealityBuilding screen={id} />} />
      ) : (
        <BuildingScreen screen={id} />
      )}
      {id === 2 && <ControlCodeCard />}
      <IntroOverlay id={id} quiet={embedded} />
    </section>
  );
}
