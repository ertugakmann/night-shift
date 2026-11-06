import type { ScreenId } from '@night-shift/shared';
import { BuildingScreen } from '../building/BuildingScreen';
import { DeskScreen } from '../desk/DeskScreen';
import { IntroOverlay } from '../intro/IntroOverlay';
import { BriefingOverlay } from '../intro/Briefing';
import { RealityBuilding } from '../reality/RealityBuilding';
import type { StripMode } from '../reality/RealityStrip';
import { RealitySwitch } from '../reality/RealitySwitch';
import { ControlCodeCard } from './ControlCodeCard';
import { DeskReport } from '../report/DeskReport';
import { DeskCatch } from '../catch/CatchViews';
import { BannerStrip } from '../brand/Banner';

/**
 * One wall screen, drawn as an SVG scene that scales cleanly: full screen on the real wall, or inside a
 * small monitor in /wall. Screens 1, 3, 4, 5 are slices of the building; screen 2 is the head guard's desk.
 * "Lights on" (L) flips each one into its reality view as the wave reaches it.
 *
 * `strip`: how the Input → NIGHT SHIFT → Output strip shows in the reality view. 'split' on the real
 * wall (one line across the five screens), 'full' in /preview, 'none' inside /wall (the office shows it).
 */
export function ScreenPanel({ id, embedded = false, strip = 'split' }: { id: ScreenId; embedded?: boolean; strip?: StripMode }) {
  const museum = id === 2 ? <DeskScreen /> : <BuildingScreen screen={id} />;
  const reality = id === 2 ? <DeskScreen reality strip={strip} /> : <RealityBuilding screen={id} strip={strip} />;
  return (
    <section className="panel relative flex h-full w-full flex-col overflow-hidden bg-[#0c0922]">
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0">
          <RealitySwitch id={id} museum={museum} reality={reality} />
        </div>
      </div>
      {/* Screen 5: the MoSAIcSOC banner along the bottom, always there (both views, and in the /wall monitor) */}
      {id === 5 && <BannerStrip />}
      {id === 2 && <DeskCatch />}
      {id === 2 && <DeskReport />}
      {id === 2 && <ControlCodeCard />}
      <IntroOverlay id={id} quiet={embedded} />
      <BriefingOverlay id={id} />
    </section>
  );
}
