import type { Snapshot } from '@night-shift/shared';
import { logClock, worldOf } from '../game/view';
import { SEVERITY_COLOR, severity, truncate } from './util';

const X = 1040;
const Y = 352;
const W = 530;
const H = 290;
const ROWS = 5;

/** A little CRT on the desk with the CCTV alert feed: time, severity, camera. */
export function Cctv({ snapshot }: { snapshot: Snapshot }) {
  const w = worldOf(snapshot);
  const alerts = snapshot.log.filter((e) => e.kind === 'cctv').slice(-ROWS);
  return (
    <g className="game-text">
      {/* stand */}
      <rect x={X + W / 2 - 50} y={Y + H - 6} width={100} height={30} rx={8} fill="#4b3f99" />
      {/* case */}
      <rect x={X} y={Y} width={W} height={H} rx={30} fill="#d9cfe9" />
      <rect x={X + 22} y={Y + 22} width={W - 44} height={H - 62} rx={22} fill="#141033" stroke="#4a3d99" strokeWidth={4} />
      <circle cx={X + W - 40} cy={Y + H - 22} r={8} fill="#3ee0d8" />
      <text x={X + 40} y={Y + 58} fontSize={20} fontWeight={700} fill="#e8e0ff">
        CCTV
      </text>
      <circle cx={X + 112} cy={Y + 51} r={7} fill="#ff6b6b" className="shimmer" />
      <text x={X + 126} y={Y + 58} fontSize={17} fill="#ff9a8a">
        REC
      </text>
      {alerts.length === 0 && (
        <text x={X + 40} y={Y + 110} fontSize={19} fill="#a99ce6">
          All cameras quiet.
        </text>
      )}
      {alerts.map((a, i) => {
        const sev = severity(w, a.room);
        const y = Y + 94 + i * 34;
        const newest = i === alerts.length - 1;
        return (
          <g key={a.id} opacity={newest ? 1 : 0.8}>
            <text x={X + 40} y={y} fontSize={18} fill="#8a7cf0">
              {logClock(snapshot, a.atMs)}
            </text>
            <rect x={X + 100} y={y - 18} width={58} height={24} rx={6} fill={SEVERITY_COLOR[sev]} opacity={0.9} />
            <text x={X + 129} y={y} textAnchor="middle" fontSize={16} fontWeight={700} fill="#17123a">
              {sev}
            </text>
            <text x={X + 168} y={y} fontSize={18} fill="#e8e0ff">
              {truncate(a.text, 30)}
            </text>
            {snapshot.debug && a.truth === false && (
              <text x={X + W - 40} y={y} textAnchor="end" fontSize={16} fill="#ff6b6b">
                [D] false
              </text>
            )}
          </g>
        );
      })}
      {/* scanlines */}
      {Array.from({ length: 10 }, (_, i) => (
        <rect key={i} x={X + 22} y={Y + 26 + i * 22} width={W - 44} height={2} fill="#ffffff" opacity={0.03} pointerEvents="none" />
      ))}
    </g>
  );
}
