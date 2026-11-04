import { WALL_TOP_ROW } from '@night-shift/shared';
import { ScreenPanel } from '../components/ScreenPanel';

/**
 * Security Office view (placeholder until Phase 4b): building monitors 1, 3, 4, 5 across the top,
 * the desk (screen 2) below. Monitors are 16:9 like the real screens, so each screen fills its monitor.
 */
export function WallPage() {
  return (
    <main className="flex h-full w-full flex-col gap-2 p-2">
      <div className="grid shrink-0 grid-cols-4 gap-2">
        {WALL_TOP_ROW.map((id) => (
          <div key={id} className="aspect-video min-w-0 overflow-hidden rounded-lg ring-1 ring-white/10">
            <ScreenPanel id={id} />
          </div>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        <ScreenPanel id={2} />
      </div>
    </main>
  );
}
