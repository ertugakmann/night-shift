import { AnimatePresence, motion } from 'motion/react';
import type { Room as RoomData, Snapshot } from '@night-shift/shared';
import { IntruderArt } from './Characters';
import { ExhibitArt, EXHIBIT_RADIUS } from './Exhibit';
import { guardPose } from './geometry';
import { ROOMS } from './layout';

const LIGHT_SPRING = { type: 'spring', stiffness: 26, damping: 11 } as const;

function farthestCorner(cx: number, cy: number, r: { x: number; y: number; w: number; h: number }): number {
  const xs = [r.x, r.x + r.w];
  const ys = [r.y, r.y + r.h];
  return Math.max(...xs.flatMap((x) => ys.map((y) => Math.hypot(x - cx, y - cy))));
}

/** Zig-zag crack across a vandalised exhibit. */
function Crack({ x, y, r }: { x: number; y: number; r: number }) {
  const w = Math.max(40, r * 0.6);
  return (
    <path
      d={`M${x - w} ${y - 30} L${x - w * 0.4} ${y - 4} L${x - w * 0.1} ${y - 26} L${x + w * 0.3} ${y + 6} L${x + w} ${y - 14}`}
      fill="none"
      stroke="#ff6b6b"
      strokeWidth={5}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={0.85}
    />
  );
}

function Candle({ x, y, glowId }: { x: number; y: number; glowId: string }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <g className="flicker">
        <circle r={26} fill={`url(#${glowId})`} />
      </g>
      <rect x={-5} y={-4} width={10} height={20} rx={3} fill="#fff1d6" />
      <path d="M0 -18 Q6 -10 0 -4 Q-6 -10 0 -18 Z" fill="#ffb84d" className="flame" />
    </g>
  );
}

/** One room: dark by default, filled with warm lantern light while a guard patrols it. */
export function Room({ room, snapshot, uid, selected, onSelect }: {
  room: RoomData;
  snapshot: Snapshot;
  uid: string;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const layout = ROOMS[room.id];
  const rs = snapshot.rooms[room.id];
  const { rect } = layout;
  const lighter = rs.litBy ? snapshot.guards.find((g) => g.id === rs.litBy) : undefined;
  const lit = !!lighter;
  const center = lighter ? guardPose(lighter) : layout.anchor;
  // The mask gradient is solid to 72% of the radius, so this lights the whole room with a soft edge.
  const radius = farthestCorner(center.x, center.y, rect) / 0.72 + 40;
  const status: 'ok' | 'closed' | 'broken' = rs.dark ? 'broken' : rs.locked ? 'closed' : 'ok';
  const candles = snapshot.candlelight[room.wing] && status !== 'ok';
  const groups = snapshot.groups.filter((g) => g.room === room.id);
  const clip = `${uid}-${room.id}-clip`;
  const mask = `${uid}-${room.id}-mask`;
  const exhibits = Object.entries(layout.exhibits);

  return (
    <g onClick={() => onSelect(room.id)} style={{ cursor: 'pointer' }}>
      <defs>
        <clipPath id={clip}>
          <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} rx={22} />
        </clipPath>
        <mask id={mask} maskUnits="userSpaceOnUse" x={rect.x} y={rect.y} width={rect.w} height={rect.h}>
          <motion.circle
            cx={center.x}
            cy={center.y}
            fill={`url(#${uid}-lightmask)`}
            initial={false}
            animate={{ r: lit ? radius : 0 }}
            transition={LIGHT_SPRING}
          />
        </mask>
      </defs>

      <g clipPath={`url(#${clip})`}>
        {/* Dark room: faint floor and outlines only */}
        <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill={layout.corridor ? '#18123c' : '#1c1645'} />
        <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill={`url(#${uid}-tiles)`} />
        {layout.corridor && (
          <rect x={rect.x - 20} y={rect.y + 38} width={rect.w + 40} height={rect.h - 76} rx={30} fill="#221a52" />
        )}
        <g className={`ex-dark ${status === 'broken' ? 'ex-off' : ''}`}>
          {exhibits.map(([id, ex]) => (
            <g key={id} transform={`translate(${ex.x},${ex.y})`}>
              <ExhibitArt kind={ex.kind} />
            </g>
          ))}
        </g>
        {/* Night lights under each exhibit: cyan running, violet closed, red vandalised */}
        {exhibits.map(([id, ex]) =>
          ex.kind === 'lamps' ? null : (
            <ellipse
              key={id}
              cx={ex.x}
              cy={ex.y + (EXHIBIT_RADIUS[ex.kind] ?? 80) * 0.45 + 30}
              rx={(EXHIBIT_RADIUS[ex.kind] ?? 80) * 0.7}
              ry={20}
              className={status === 'ok' ? 'shimmer' : ''}
              fill={`url(#${uid}-pip-${status})`}
            />
          ),
        )}

        {/* Lantern light: a warm, fully coloured copy of the room revealed through a growing circle */}
        <g mask={`url(#${mask})`}>
          <g className="flicker">
            <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill={`url(#${uid}-parquet)`} />
            {layout.corridor && (
              <rect x={rect.x - 20} y={rect.y + 38} width={rect.w + 40} height={rect.h - 76} rx={30} fill="#7a4a8c" />
            )}
            <g className={status === 'broken' ? 'ex-broken' : status === 'closed' ? 'ex-closed' : ''}>
              {exhibits.map(([id, ex]) => (
                <g key={id} transform={`translate(${ex.x},${ex.y})`}>
                  <ExhibitArt kind={ex.kind} />
                </g>
              ))}
            </g>
            <AnimatePresence>
              {lit &&
                groups.map((g, i) => {
                  const spot = layout.spots[i % layout.spots.length];
                  return (
                    <motion.g
                      key={g.id}
                      initial={{ opacity: 0, scale: 0.5, x: spot.x, y: spot.y }}
                      animate={{ opacity: 1, scale: layout.corridor ? 0.85 : 1, x: spot.x, y: spot.y }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 18 }}
                    >
                      <IntruderArt spotted={g.spotted} />
                    </motion.g>
                  );
                })}
            </AnimatePresence>
            <circle cx={center.x} cy={center.y} r={radius} fill={`url(#${uid}-warmth)`} />
          </g>
        </g>

        {status === 'broken' &&
          exhibits.map(([id, ex]) =>
            ex.kind === 'lamps' ? null : <Crack key={id} x={ex.x} y={ex.y} r={EXHIBIT_RADIUS[ex.kind] ?? 80} />,
          )}
        {candles &&
          exhibits.map(([id, ex]) => (
            <Candle
              key={id}
              glowId={`${uid}-glow`}
              x={ex.kind === 'lamps' ? ex.x - 300 : ex.x + (EXHIBIT_RADIUS[ex.kind] ?? 80) + 20}
              y={ex.kind === 'lamps' ? ex.y : ex.y + 40}
            />
          ))}

        {/* Debug: where the gang really is, even in the dark */}
        {snapshot.debug &&
          !lit &&
          groups.map((g, i) => {
            const spot = layout.spots[i % layout.spots.length];
            return (
              <g key={g.id} transform={`translate(${spot.x},${spot.y})`}>
                <IntruderArt spotted={false} ghost />
                <text y={-84} textAnchor="middle" className="game-text" fontSize={20} fill="#ff6b6b">
                  {Math.floor(rs.occupiedMs / 1000)}s
                </text>
              </g>
            );
          })}
      </g>

      {/* Walls */}
      <rect
        x={rect.x}
        y={rect.y}
        width={rect.w}
        height={rect.h}
        rx={22}
        fill="none"
        stroke={rs.locked ? '#9c86f5' : '#3a3186'}
        strokeWidth={10}
        style={{ transition: 'stroke 600ms ease' }}
      />
      {selected && (
        <rect
          x={rect.x + 10}
          y={rect.y + 10}
          width={rect.w - 20}
          height={rect.h - 20}
          rx={16}
          fill="none"
          stroke="#ffd27a"
          strokeWidth={4}
          strokeDasharray="14 10"
          className="march"
        />
      )}

      {/* Name, with the real hospital system underneath */}
      <g className="game-text" pointerEvents="none">
        <text
          x={layout.corridor ? rect.x + 70 : rect.x + 30}
          y={layout.corridor ? rect.y + 58 : rect.y + 46}
          fontSize={30}
          fontWeight={600}
          fill={lit ? '#5a3a22' : '#a99ce6'}
          opacity={lit ? 0.9 : 0.75}
          style={{ transition: 'fill 500ms ease, opacity 500ms ease' }}
        >
          {room.name}
        </text>
        <text
          x={layout.corridor ? rect.x + 70 : rect.x + 30}
          y={layout.corridor ? rect.y + 84 : rect.y + 72}
          fontSize={18}
          fill={lit ? '#7a5638' : '#a99ce6'}
          opacity={lit ? 0.75 : 0.5}
          style={{ transition: 'fill 500ms ease, opacity 500ms ease' }}
        >
          {room.real}
        </text>
      </g>
    </g>
  );
}
