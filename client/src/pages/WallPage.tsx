import { WALL_TOP_ROW } from '@night-shift/shared';
import { ScreenPanel } from '../components/ScreenPanel';

/** Security Office view: building monitors 1, 3, 4, 5 across the top, the big desk (screen 2) below. */
export function WallPage() {
  return (
    <main className="grid h-full w-full grid-rows-[2fr_3fr] gap-2 p-2">
      <div className="grid min-h-0 grid-cols-4 gap-2">
        {WALL_TOP_ROW.map((id) => (
          <ScreenPanel key={id} id={id} />
        ))}
      </div>
      <div className="min-h-0">
        <ScreenPanel id={2} />
      </div>
    </main>
  );
}
