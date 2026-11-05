// Screen 5 in the reality view: the stone tower becomes a clean SOC panel. The incident window instead of
// the museum clock, "Care continuity" (clinical service availability) instead of the brass gauge, and the
// patient impact counters, unchanged: success is measured in patient care, not in systems.
import { IMPACT_LABELS, IMPACT_TYPES, type Snapshot } from '@night-shift/shared';
import { ImpactIcon } from '../building/VaultExtras';
import { CLOCK_TOWER } from '../building/layout';
import { gameClock, worldOf } from '../game/view';
import { useRiseKey } from '../game/moments';

const C = { panel: '#0d1729', line: '#2f4a73', text: '#e6edf7', sub: '#7f8ea8', ok: '#3ee0d8' };

export function RealityVaultPanel({ snapshot }: { snapshot: Snapshot }) {
  const w = worldOf(snapshot);
  const x = CLOCK_TOWER.x;
  const width = CLOCK_TOWER.w;
  const progress = Math.min(1, snapshot.timeMs / w.ms.night);
  const care = Math.round(snapshot.care);
  const rise = useRiseKey(care);
  const careColor = care >= 75 ? '#3ee0d8' : care >= 50 ? '#f2994a' : '#ff6b6b';
  const cx = x + width / 2;
  const gy = 412;
  const r = 118;
  const arc = (from: number, to: number) => {
    const a = (v: number) => Math.PI + (v / 100) * Math.PI;
    return `M${cx + Math.cos(a(from)) * r} ${gy + Math.sin(a(from)) * r} A${r} ${r} 0 0 1 ${cx + Math.cos(a(to)) * r} ${gy + Math.sin(a(to)) * r}`;
  };

  return (
    <g className="soc-text">
      <rect x={x} y={8} width={width} height={808} rx={12} fill={C.panel} stroke={C.line} strokeWidth={3} />

      {/* incident window */}
      <text x={x + 24} y={50} fontSize={17} fontWeight={700} fill={C.sub} letterSpacing={1.5}>
        INCIDENT WINDOW
      </text>
      <text x={x + 24} y={104} fontSize={48} fontWeight={700} fill={C.text} className="soc-mono">
        {gameClock(snapshot)}
      </text>
      <text x={x + width - 24} y={104} textAnchor="end" fontSize={17} fill={C.sub}>
        until 06:00
      </text>
      <rect x={x + 24} y={124} width={width - 48} height={12} rx={6} fill="#16243d" />
      <rect x={x + 24} y={124} width={(width - 48) * progress} height={12} rx={6} fill={C.ok} />

      {/* care continuity */}
      <text x={x + 24} y={206} fontSize={26} fontWeight={700} fill={C.text}>
        Care continuity
      </text>
      <text x={x + 24} y={232} fontSize={17} fill={C.sub}>
        clinical service availability
      </text>
      <path d={arc(0, 100)} fill="none" stroke="#16243d" strokeWidth={22} />
      <path d={arc(0, Math.max(0.5, care))} fill="none" stroke={careColor} strokeWidth={22} style={{ transition: 'all 600ms ease' }} />
      <text key={rise} className={rise ? 'care-glow' : undefined} x={cx} y={gy - 14} textAnchor="middle" fontSize={64} fontWeight={800} fill={careColor}>
        {care}%
      </text>

      {/* patient impact: always real */}
      <text x={x + 24} y={474} fontSize={17} fontWeight={700} fill={C.sub} letterSpacing={1.5}>
        PATIENT IMPACT
      </text>
      {IMPACT_TYPES.map((type, i) => {
        const y = 492 + i * 78;
        const value = Math.floor(snapshot.impact[type]);
        return (
          <g key={type} transform={`translate(${x + 20},${y})`}>
            <rect width={width - 40} height={66} rx={10} fill="#101e33" stroke={value > 0 ? '#f2994a' : C.line} strokeWidth={2} />
            <g transform="translate(36,33)">
              <ImpactIcon type={type} />
            </g>
            <text x={72} y={41} fontSize={20} fontWeight={600} fill={C.text}>
              {IMPACT_LABELS[type]}
            </text>
            <text x={width - 60} y={44} textAnchor="end" fontSize={30} fontWeight={800} fill={value > 0 ? '#f2994a' : C.sub} className="soc-mono">
              {value}
            </text>
          </g>
        );
      })}
    </g>
  );
}
