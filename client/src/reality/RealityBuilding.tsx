// The reality view of a building screen: the same floor plan, redrawn as a hospital network in a clean
// SOC style. Departments instead of galleries, systems instead of exhibits, ransomware instead of the
// gang, analysts instead of guards. The game names stay underneath, so the mapping is always visible.
import { useId } from 'react';
import { motion } from 'motion/react';
import type { Room as RoomData, Snapshot } from '@night-shift/shared';
import { guardPose } from '../building/geometry';
import { DOORS, ROOMS, SLICE_H, SLICE_W, doorBounds, intersects, sliceRect, type BuildingScreenId } from '../building/layout';
import { wrap } from '../desk/util';
import { worldOf } from '../game/view';
import { selectRoom, useGame } from '../net/game';
import { DangerGlow } from '../building/VaultExtras';
import { BuildingEnd } from '../end/EndMoment';
import { Effects } from '../building/Effects';
import { DangerMeter, dangerLevel } from '../game/danger';
import { CatchBadge } from '../catch/CatchViews';
import { RealityStrip, type StripMode } from './RealityStrip';
import { RealityVaultPanel } from './RealityVaultPanel';

const C = {
  bg: '#0a1120',
  room: '#101a2c',
  line: '#2a3a58',
  text: '#e6edf7',
  sub: '#7f8ea8',
  ok: '#3ee0d8',
  isolated: '#9c86f5',
  encrypted: '#ff6b6b',
  amber: '#f2c65e',
};

type Status = 'ONLINE' | 'ISOLATED' | 'ENCRYPTED';
const STATUS_COLOR: Record<Status, string> = { ONLINE: C.ok, ISOLATED: C.isolated, ENCRYPTED: C.encrypted };

function StatusChip({ x, y, status }: { x: number; y: number; status: Status }) {
  const w = status.length * 11 + 22;
  return (
    <g>
      <rect x={x} y={y - 16} width={w} height={24} rx={12} fill={STATUS_COLOR[status]} fillOpacity={0.16} stroke={STATUS_COLOR[status]} strokeWidth={2} />
      <text x={x + w / 2} y={y + 1} textAnchor="middle" fontSize={14} fontWeight={700} fill={STATUS_COLOR[status]} letterSpacing={1}>
        {status}
      </text>
    </g>
  );
}

/** A system as an asset card: icon, name, status, criticality. */
function SystemCard({
  x,
  y,
  name,
  status,
  criticality,
  database = false,
  width,
  compact = false,
}: {
  x: number;
  y: number;
  name: string;
  status: Status;
  criticality: number;
  database?: boolean;
  width?: number;
  compact?: boolean;
}) {
  const w = width ?? (database ? 440 : 360);
  const h = database ? 120 : compact ? 84 : 100;
  // about 10.5 units per character at 20px; the text starts 88 units in
  const lines = wrap(name, Math.max(10, Math.floor((w - 104) / 10.5)), compact ? 1 : 2);
  const color = STATUS_COLOR[status];
  return (
    <g transform={`translate(${x - w / 2},${y - h / 2})`}>
      <rect width={w} height={h} rx={12} fill="#0d1729" stroke={color} strokeOpacity={0.55} strokeWidth={2} />
      <rect width={6} height={h} rx={3} fill={color} />
      {database ? (
        // database cylinder
        <g transform="translate(22,22)">
          <path d="M0 10 V62 A28 10 0 0 0 56 62 V10" fill="#16243d" stroke="#2f4a73" strokeWidth={2} />
          <ellipse cx={28} cy={10} rx={28} ry={10} fill="#1d2f4d" stroke="#2f4a73" strokeWidth={2} />
          <path d="M0 28 A28 10 0 0 0 56 28 M0 45 A28 10 0 0 0 56 45" fill="none" stroke="#2f4a73" strokeWidth={2} />
          <circle cx={46} cy={56} r={4} fill={color} />
        </g>
      ) : (
        // server glyph
        <g transform="translate(22,22)">
          <rect width={50} height={56} rx={8} fill="#16243d" stroke="#2f4a73" strokeWidth={2} />
          {[12, 26, 40].map((yy) => (
            <g key={yy}>
              <rect x={9} y={yy - 3} width={24} height={6} rx={3} fill="#2f4a73" />
              <circle cx={40} cy={yy} r={3.5} fill={color} />
            </g>
          ))}
        </g>
      )}
      {lines.map((l, i) => (
        <text key={i} x={database ? 96 : 88} y={lines.length === 1 ? 44 : 34 + i * 24} fontSize={database ? 22 : 20} fontWeight={600} fill={C.text}>
          {l}
        </text>
      ))}
      <StatusChip x={database ? 96 : 88} y={h - 16} status={status} />
      <text x={w - 16} y={h - 14} textAnchor="end" className="soc-mono" fontSize={14} fill={C.sub}>
        CRIT {criticality}
      </text>
    </g>
  );
}

const IDLE_REAL = { look: 'monitoring', yawn: 'idle', biscuit: 'coffee break' } as const;

export function Analyst({ x, y, name, initial, act }: { x: number; y: number; name: string; initial: string; act: keyof typeof IDLE_REAL | null }) {
  return (
    <motion.g initial={false} animate={{ x, y: y - 46 }} transition={{ duration: 0.12, ease: 'linear' }}>
      {act && (
        <g>
          <rect x={-58} y={34} width={116} height={24} rx={12} fill="#0d1729" stroke="#2f4a73" strokeWidth={2} />
          <text y={51} textAnchor="middle" fontSize={14} fill="#8494ad">
            {IDLE_REAL[act]}
          </text>
        </g>
      )}
      <circle r={28} fill="#16243d" stroke={C.ok} strokeWidth={3} />
      <text y={9} textAnchor="middle" fontSize={24} fontWeight={700} fill={C.ok}>
        {initial}
      </text>
      {/* headset */}
      <path d="M-22 -4 A22 22 0 0 1 22 -4" fill="none" stroke="#cfe0f5" strokeWidth={4} />
      <rect x={-27} y={-6} width={8} height={14} rx={3} fill="#cfe0f5" />
      <rect x={19} y={-6} width={8} height={14} rx={3} fill="#cfe0f5" />
      <rect x={-56} y={-66} width={112} height={26} rx={13} fill="#0d1729" stroke="#2f4a73" strokeWidth={2} />
      <text y={-48} textAnchor="middle" fontSize={15} fontWeight={600} fill="#cfe0f5">
        Analyst {name}
      </text>
    </motion.g>
  );
}

export function Ransomware({ x, y, detected }: { x: number; y: number; detected: boolean }) {
  return (
    <g transform={`translate(${x},${y - 34})`}>
      {detected && <circle r={44} fill="none" stroke={C.encrypted} strokeWidth={3} className="shimmer" />}
      <path d="M0 -32 L28 -16 L28 16 L0 32 L-28 16 L-28 -16 Z" fill="#3a1220" stroke={C.encrypted} strokeWidth={3} />
      {/* padlock: encryption */}
      <path d="M-8 -2 V-9 A8 8 0 0 1 8 -9 V-2" fill="none" stroke={C.encrypted} strokeWidth={4} />
      <rect x={-12} y={-3} width={24} height={18} rx={4} fill={C.encrypted} />
      <rect x={-74} y={38} width={148} height={26} rx={13} fill={C.encrypted} />
      <text y={56} textAnchor="middle" fontSize={15} fontWeight={800} fill="#2a0a12" letterSpacing={1}>
        RANSOMWARE
      </text>
    </g>
  );
}

function RealityRoom({ room, snapshot, uid, selected }: { room: RoomData; snapshot: Snapshot; uid: string; selected: boolean }) {
  const layout = ROOMS[room.id];
  const rs = snapshot.rooms[room.id];
  const { rect } = layout;
  const scanning = rs.litBy !== null;
  const roomStatus: Status = rs.dark ? 'ENCRYPTED' : rs.locked ? 'ISOLATED' : 'ONLINE';
  const stroke = rs.dark ? C.encrypted : rs.locked ? C.isolated : scanning ? C.ok : C.line;
  const groups = snapshot.groups.filter((g) => g.room === room.id);
  const visible = scanning || snapshot.debug;
  const scanner = scanning ? snapshot.guards.find((g) => g.id === rs.litBy)?.name : null;
  const downtime = snapshot.candlelight[room.wing] && (rs.locked || rs.dark);
  const clip = `${uid}-r-${room.id}`;
  const labelX = rect.x + 34 + (layout.labelDx ?? 0);
  // Long department names shrink to fit the room (about 0.56 em per character in this font).
  // Corridors keep their right half for the system card, so their label gets the left half.
  const labelRoom = layout.corridor ? rect.w * 0.5 : rect.w - 120;
  const labelSize = Math.min(36, Math.floor(labelRoom / (room.real.length * 0.56)));
  const cards = room.exhibits;
  const gap = 24;
  const usable = layout.corridor ? rect.w * 0.45 - 30 : rect.w - 80;
  const cardW = Math.min(room.special === 'vault' ? 440 : 380, (usable - gap * (cards.length - 1)) / cards.length);
  const cardsLeft = layout.corridor ? rect.x + rect.w * 0.55 : rect.x + 40 + (usable - (cardW * cards.length + gap * (cards.length - 1))) / 2;
  // Most critical rooms: cards just under the tier tag, clear of where analysts stand.
  const cardY = layout.corridor ? rect.y + rect.h - 50 : layout.vip ? rect.y + 236 : rect.y + Math.max(170, rect.h * 0.58);

  return (
    <g onClick={() => selectRoom(selected ? null : room.id)} style={{ cursor: 'pointer' }}>
      <clipPath id={clip}>
        <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} rx={10} />
      </clipPath>
      <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} rx={10} fill={rs.dark ? '#1c1020' : C.room} />
      <g clipPath={`url(#${clip})`}>
        {!scanning && <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill={`url(#${uid}-unknown)`} />}
        {layout.corridor && (
          <line
            x1={rect.x}
            y1={rect.y + rect.h * 0.74}
            x2={rect.x + rect.w}
            y2={rect.y + rect.h * 0.74}
            stroke={rs.dark ? C.encrypted : C.ok}
            strokeOpacity={0.45}
            strokeWidth={6}
            strokeDasharray="18 14"
            className="march"
          />
        )}
        {scanning && (
          <rect
            x={rect.x}
            y={rect.y}
            width={rect.w}
            height={10}
            fill={C.ok}
            opacity={0.35}
            className="scanline"
            style={{ '--scan': `${rect.h}px` } as React.CSSProperties}
          />
        )}
      </g>
      <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} rx={10} fill="none" stroke={stroke} strokeWidth={rs.locked ? 5 : 3} strokeDasharray={rs.locked ? '14 8' : undefined} />
      {selected && <rect x={rect.x + 10} y={rect.y + 10} width={rect.w - 20} height={rect.h - 20} rx={8} fill="none" stroke={C.amber} strokeWidth={4} strokeDasharray="14 10" className="march" />}

      {/* department first, the game name underneath */}
      <text x={labelX} y={rect.y + (layout.corridor ? 60 : 58)} fontSize={labelSize} fontWeight={700} fill={C.text}>
        {room.real}
      </text>
      {layout.vip && (
        <g transform={`translate(${labelX},${rect.y + 106})`}>
          <rect width={196} height={26} rx={13} fill="#3a2a10" stroke={C.amber} strokeWidth={2} />
          <text x={98} y={18} textAnchor="middle" fontSize={14} fontWeight={800} fill={C.amber} letterSpacing={1}>
            TIER 1 · MOST CRITICAL
          </text>
        </g>
      )}
      <text x={labelX} y={rect.y + (layout.corridor ? 88 : 86)} fontSize={19} fill={C.sub}>
        in the game: {room.name}
      </text>

      {/* status, top right */}
      <g transform={`translate(${rect.x + rect.w - 24},${rect.y + 40})`}>
        <text textAnchor="end" fontSize={16} fill={scanning ? C.ok : C.sub} fontWeight={scanning ? 700 : 400}>
          {scanning ? `EDR scan · ${scanner}` : 'Visibility: unknown'}
        </text>
        {downtime && (
          <text y={26} textAnchor="end" fontSize={16} fontWeight={700} fill={C.amber}>
            Downtime procedures (paper)
          </text>
        )}
      </g>

      {cards.map((exhibit, i) => (
        <SystemCard
          key={exhibit.id}
          x={cardsLeft + cardW / 2 + i * (cardW + gap)}
          y={cardY}
          name={exhibit.real}
          status={roomStatus}
          criticality={exhibit.criticality}
          database={room.special === 'vault'}
          width={cardW}
          compact={layout.corridor}
        />
      ))}

      {visible &&
        groups.map((g, i) => {
          const spot = layout.spots[i % layout.spots.length];
          return <Ransomware key={g.id} x={spot.x} y={spot.y} detected={g.spotted} />;
        })}
    </g>
  );
}

/** Reality view of one building screen. */
export function RealityBuilding({ screen, strip = 'split' }: { screen: BuildingScreenId; strip?: StripMode }) {
  const { snapshot, selected } = useGame();
  const uid = useId().replace(/:/g, '');
  const slice = sliceRect(screen);
  if (!snapshot) return null;
  const w = worldOf(snapshot);
  const rooms = w.sc.rooms.filter((r) => intersects(ROOMS[r.id].rect, slice));
  const doors = DOORS.filter((d) => intersects(doorBounds(d), slice));

  return (
    <svg viewBox={`${slice.x} 0 ${SLICE_W} ${SLICE_H}`} preserveAspectRatio="xMidYMid meet" className="soc-text block h-full w-full select-none" role="img" aria-label="Hospital network, reality view">
      <defs>
        <pattern id={`${uid}-unknown`} width={28} height={28} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width={28} height={28} fill="none" />
          <line x1={0} y1={0} x2={0} y2={28} stroke="#7f8ea8" strokeOpacity={0.07} strokeWidth={10} />
        </pattern>
        <pattern id={`${uid}-grid`} width={40} height={40} patternUnits="userSpaceOnUse">
          <path d="M40 0 L0 0 0 40" fill="none" stroke="#16243d" strokeWidth={1.5} />
        </pattern>
      </defs>
      <rect x={slice.x} y={0} width={SLICE_W} height={SLICE_H} fill={C.bg} />
      <rect x={slice.x} y={0} width={SLICE_W} height={SLICE_H} fill={`url(#${uid}-grid)`} />

      {rooms.map((room) => (
        <RealityRoom key={room.id} room={room} snapshot={snapshot} uid={uid} selected={selected === room.id} />
      ))}

      {/* network links between departments */}
      {doors.map((d) => {
        const isolated = snapshot.rooms[d.a].locked || snapshot.rooms[d.b].locked;
        const v = d.orient === 'v';
        if (d.tube) {
          // The mail tube: a direct link from the email server into the internal network.
          const path = d.tube.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ');
          const ends = [d.tube[0], d.tube[d.tube.length - 1]];
          return (
            <g key={`${d.a}-${d.b}`} pointerEvents="none">
              <path d={path} fill="none" stroke={isolated ? C.isolated : '#3a5680'} strokeWidth={6} strokeDasharray="14 10" strokeLinejoin="round" className={isolated ? '' : 'march'} />
              <g transform="translate(1110,22)">
                <rect x={-150} y={-15} width={300} height={30} rx={8} fill="#0d1729" stroke={isolated ? C.isolated : '#3a5680'} strokeWidth={2} />
                <text y={6} textAnchor="middle" fontSize={15} fontWeight={600} fill={isolated ? C.isolated : C.sub}>
                  direct link: email → internal network
                </text>
              </g>
              {ends.map((p, i) => (
                <g key={i} transform={`translate(${p.x},${p.y})`}>
                  <circle r={14} fill="#0d1729" stroke={isolated ? C.isolated : '#3a5680'} strokeWidth={3} />
                  {isolated ? (
                    <g>
                      <path d="M-6 -1 V-6 A6 6 0 0 1 6 -6 V-1" fill="none" stroke={C.isolated} strokeWidth={3} />
                      <rect x={-9} y={-2} width={18} height={13} rx={3} fill={C.isolated} />
                    </g>
                  ) : (
                    <circle r={6} fill={C.ok} className="shimmer" />
                  )}
                </g>
              ))}
            </g>
          );
        }
        return (
          <g key={`${d.a}-${d.b}`} pointerEvents="none">
            <rect x={v ? d.x - 14 : d.x - 40} y={v ? d.y - 40 : d.y - 14} width={v ? 28 : 80} height={v ? 80 : 28} rx={8} fill="#0d1729" stroke={isolated ? C.isolated : '#3a5680'} strokeWidth={3} />
            {isolated ? (
              <g transform={`translate(${d.x},${d.y})`}>
                <path d="M-6 -1 V-6 A6 6 0 0 1 6 -6 V-1" fill="none" stroke={C.isolated} strokeWidth={3} />
                <rect x={-9} y={-2} width={18} height={13} rx={3} fill={C.isolated} />
              </g>
            ) : (
              <circle cx={d.x} cy={d.y} r={6} fill={C.ok} className="shimmer" />
            )}
          </g>
        );
      })}

      {screen === 5 && <RealityVaultPanel snapshot={snapshot} />}
      {screen === 5 && (
        <g transform="translate(4842,160)">
          <rect x={-12} y={-10} width={312} height={84} rx={10} fill="#0d1729" stroke="#2f4a73" strokeWidth={2} />
          <DangerMeter x={0} y={0} w={288} h={64} level={dangerLevel(snapshot)} label="EPR RISK: HOPS AWAY" reality />
        </g>
      )}

      <RealityStrip x0={slice.x} mode={strip} screen={screen} />

      <Effects snapshot={snapshot} rooms={new Set(rooms.map((r) => r.id))} reality />
      <CatchBadge snapshot={snapshot} rooms={new Set(rooms.map((r) => r.id))} reality />
      {/* analysts, on top of everything */}
      {snapshot.guards.map((g) => {
        const p = guardPose(g, snapshot.timeMs);
        return <Analyst key={g.id} x={p.x} y={p.y} name={g.name} initial={g.name[0]} act={p.act} />;
      })}

      {screen === 5 && <DangerGlow snapshot={snapshot} slice={slice} uid={uid} />}
      <BuildingEnd screen={screen} slice={slice} snapshot={snapshot} reality />
    </svg>
  );
}
