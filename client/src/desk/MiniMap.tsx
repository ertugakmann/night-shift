import type { Snapshot } from '@night-shift/shared';
import { guardPose } from '../building/geometry';
import { DOORS, ROOMS } from '../building/layout';
import { worldOf } from '../game/view';
import { selectRoom } from '../net/game';
import { MAP_SCALE, MAP_X, MAP_Y, mapX, mapY, truncate } from './util';

const GUARD_COLOR: Record<string, string> = { sam: '#3ee0d8', priya: '#ff9ec7', tom: '#a8e07a' };

function Paw({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`} fill="#c9a6ff">
      <ellipse cy={4} rx={8} ry={7} />
      <circle cx={-8} cy={-6} r={3.5} />
      <circle cx={-3} cy={-10} r={3.5} />
      <circle cx={3} cy={-10} r={3.5} />
      <circle cx={8} cy={-6} r={3.5} />
    </g>
  );
}

/** The building plan pinned to the desk: every room, its state, the guards, and Rex's hunches. */
export function MiniMap({ snapshot, selected, reality = false }: { snapshot: Snapshot; selected: string | null; reality?: boolean }) {
  const w = worldOf(snapshot);
  const bark = w.sc.rex.barkThreshold;
  const width = 6400 * MAP_SCALE;
  const height = 900 * MAP_SCALE;
  return (
    <g>
      {/* paper, taped to the desk */}
      <rect x={MAP_X - 26} y={MAP_Y - 22} width={width + 52} height={height + 44} rx={14} fill={reality ? '#0a1424' : '#1f1a4a'} stroke={reality ? '#2f4a73' : '#4a3d99'} strokeWidth={4} />
      {!reality && [
        [MAP_X - 10, MAP_Y - 18, -12],
        [MAP_X + width - 30, MAP_Y - 18, 10],
      ].map(([x, y, r]) => (
        <rect key={x} x={x} y={y} width={60} height={20} rx={3} fill="#f3e3c3" opacity={0.7} transform={`rotate(${r} ${x + 30} ${y + 10})`} />
      ))}
      {[1, 2, 3].map((i) => (
        <line key={i} x1={mapX(i * 1600)} y1={MAP_Y - 8} x2={mapX(i * 1600)} y2={MAP_Y + height + 8} stroke="#4a3d99" strokeWidth={2} strokeDasharray="6 8" />
      ))}

      {w.sc.rooms.map((room) => {
        const r = ROOMS[room.id].rect;
        const rs = snapshot.rooms[room.id];
        const x = mapX(r.x);
        const y = mapY(r.y);
        const rw = r.w * MAP_SCALE;
        const rh = r.h * MAP_SCALE;
        const lit = rs.litBy !== null;
        const fill = reality ? (lit ? '#0f3a40' : rs.dark ? '#3a1220' : '#101a2c') : lit ? '#f3d9a4' : rs.dark ? '#4a2547' : '#2c2468';
        const stroke = rs.locked ? '#b9a8ff' : rs.dark ? '#ff6b6b' : '#6f61d0';
        const estimate = snapshot.rex.estimates[room.id] ?? 0;
        const isSelected = selected === room.id;
        const label = rh < 50 || rw < 150 ? 16 : 18;
        return (
          <g
            key={room.id}
            onClick={(e) => {
              e.stopPropagation();
              selectRoom(isSelected ? null : room.id);
            }}
            style={{ cursor: 'pointer' }}
          >
            <rect x={x} y={y} width={rw} height={rh} rx={6} fill={fill} stroke={stroke} strokeWidth={rs.locked ? 5 : 3} style={{ transition: 'fill 400ms ease' }} />
            {rs.dark && (
              <path
                d={`M${x + rw * 0.35} ${y + rh * 0.4} l${rw * 0.08} ${rh * 0.2} l${rw * 0.06} ${-rh * 0.15} l${rw * 0.1} ${rh * 0.25}`}
                fill="none"
                stroke="#ff6b6b"
                strokeWidth={3}
                strokeLinecap="round"
              />
            )}
            <text x={x + 8} y={y + label + 5} className={reality ? 'soc-text' : 'game-text'} fontSize={label} fontWeight={600} fill={lit && !reality ? '#5a3a22' : reality ? '#e6edf7' : '#d8cffd'} pointerEvents="none">
              {reality ? truncate(room.real, Math.floor((rw - (estimate > bark ? 78 : 14)) / (label * 0.55))) : room.name}
            </text>
            {rs.locked && (
              <g transform={`translate(${x + rw - 18},${y + rh - 16})`} pointerEvents="none">
                <path d="M-6 -2 V-7 A6 6 0 0 1 6 -7 V-2" fill="none" stroke="#e8e0ff" strokeWidth={3} />
                <rect x={-9} y={-3} width={18} height={14} rx={4} fill="#9c86f5" />
              </g>
            )}
            {snapshot.candlelight[room.wing] && (rs.locked || rs.dark) && (
              <path d={`M${x + rw - 44} ${y + rh - 26} q6 8 0 14 q-6 -6 0 -14 Z`} fill="#ffb84d" className="flame" pointerEvents="none" />
            )}
            {estimate > bark && (
              <g pointerEvents="none">
                <Paw x={x + rw - 18} y={y + 18} />
                <text x={x + rw - 32} y={y + 24} textAnchor="end" className="game-text" fontSize={16} fontWeight={700} fill="#c9a6ff">
                  {estimate}%
                </text>
              </g>
            )}
            {isSelected && (
              <rect x={x - 5} y={y - 5} width={rw + 10} height={rh + 10} rx={10} fill="none" stroke="#ffd27a" strokeWidth={4} strokeDasharray="10 7" className="march" pointerEvents="none" />
            )}
          </g>
        );
      })}

      {DOORS.map((d) => (
        <circle key={`${d.a}-${d.b}`} cx={mapX(d.x)} cy={mapY(d.y)} r={d.grand ? 7 : 5} fill={d.grand ? '#f2c65e' : '#8a7cf0'} pointerEvents="none" />
      ))}

      {/* the gang: only where a lantern is shining (or in debug) */}
      {snapshot.groups.map((g, i) => {
        if (!snapshot.rooms[g.room].litBy && !snapshot.debug) return null;
        const spots = ROOMS[g.room].spots;
        const spot = spots[i % spots.length];
        return (
          <g key={g.id} transform={`translate(${mapX(spot.x)},${mapY(spot.y) - 8})`} pointerEvents="none" opacity={snapshot.rooms[g.room].litBy ? 1 : 0.6}>
            <circle r={10} fill="#1a1131" stroke={snapshot.rooms[g.room].litBy ? '#f2994a' : '#ff6b6b'} strokeWidth={2} />
            <circle cx={-3.5} cy={-1} r={2.5} fill="#fff" />
            <circle cx={3.5} cy={-1} r={2.5} fill="#fff" />
          </g>
        );
      })}

      {/* guards */}
      {snapshot.guards.map((g) => {
        const p = guardPose(g);
        return (
          <g key={g.id} transform={`translate(${mapX(p.x)},${mapY(p.y) - 10})`} pointerEvents="none" style={{ transition: 'transform 120ms linear' }}>
            <circle r={13} fill="#17123a" stroke={GUARD_COLOR[g.id] ?? '#fff'} strokeWidth={4} />
            <text y={6} textAnchor="middle" className="game-text" fontSize={16} fontWeight={700} fill={GUARD_COLOR[g.id] ?? '#fff'}>
              {g.name[0]}
            </text>
          </g>
        );
      })}
    </g>
  );
}

export { Paw };
