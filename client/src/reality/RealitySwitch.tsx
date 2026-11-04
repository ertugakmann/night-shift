import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import type { ScreenId } from '@night-shift/shared';
import { SWEEP_MS, useRealityWave } from './useRealityWave';

const EASE = [0.45, 0, 0.2, 1] as const;

/**
 * Shows the museum or the reality view of one screen. When the lights flip, a band of light sweeps
 * across the screen and the new view is revealed behind it: left to right going on, right to left going off.
 */
export function RealitySwitch({ id, museum, reality }: { id: ScreenId; museum: ReactNode; reality: ReactNode }) {
  const { shown, sweep } = useRealityWave(id);
  if (!sweep) return <>{shown ? reality : museum}</>;

  const forward = sweep.to; // lights on: left → right
  const transition = { duration: SWEEP_MS / 1000, ease: EASE };
  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-0">{shown ? reality : museum}</div>
      <motion.div
        key={sweep.key}
        className="absolute inset-0"
        initial={{ clipPath: forward ? 'inset(0% 100% 0% 0%)' : 'inset(0% 0% 0% 100%)' }}
        animate={{ clipPath: 'inset(0% 0% 0% 0%)' }}
        transition={transition}
      >
        {sweep.to ? reality : museum}
      </motion.div>
      {/* the band of light riding the edge */}
      <motion.div
        key={`band-${sweep.key}`}
        className="pointer-events-none absolute inset-y-0 w-[22%]"
        initial={{ left: forward ? '-11%' : '89%' }}
        animate={{ left: forward ? '89%' : '-11%' }}
        transition={transition}
        style={{
          background: forward
            ? 'linear-gradient(90deg, transparent, rgba(255,210,122,0.35) 25%, rgba(255,240,205,0.9) 44%, #ffffff 50%, rgba(160,250,245,0.85) 56%, rgba(62,224,216,0.3) 75%, transparent)'
            : 'linear-gradient(270deg, transparent, rgba(62,224,216,0.3) 25%, rgba(160,250,245,0.85) 44%, #ffffff 50%, rgba(255,240,205,0.9) 56%, rgba(255,210,122,0.35) 75%, transparent)',
          mixBlendMode: 'screen',
        }}
      />
    </div>
  );
}
