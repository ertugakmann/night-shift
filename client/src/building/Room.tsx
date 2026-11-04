import { AnimatePresence, motion } from 'motion/react';
import type { Room as RoomData, Snapshot } from '@night-shift/shared';
import { IntruderArt } from './Characters';
import { Barrier, Column, ExhibitArt, Frame, FrontDoor, Letterbox, NO_BARRIER, Statue, exhibitBox } from './Exhibit';
import { guardPose } from './geometry';
import { ROOMS, type Rect, type RoomLayout } from './layout';

const LIGHT_SPRING = { type: 'spring', stiffness: 26, damping: 11 } as const;
// Closing uses an ease, not the spring: a spring overshoots below zero and SVG rejects a negative radius.
const LIGHT_OUT = { duration: 0.6, ease: 'easeIn' } as const;
const WALL = 16;
/** Room name and real system name sizes, in plan units (1600 wide → ×1.2 on a 1080p screen: 48 px and 29 px). */
const NAME_SIZE = 40;
const REAL_SIZE = 24;
export const INTRUDER_SCALE = 1.3;

/** Carpet runners: corridors get one down the middle; halls can declare their own. */
function runnersOf(layout: RoomLayout): Rect[] {
  const { rect } = layout;
  const own = layout.runners ?? [];
  return layout.corridor ? [{ x: rect.x - 20, y: rect.y + 52, w: rect.w + 40, h: rect.h - 104 }, ...own] : own;
}

function Runners({ layout, fill, edge }: { layout: RoomLayout; fill: string; edge: string }) {
  return (
    <>
      {/* Edged first, then filled again on top, so joins between runners show no seam. */}
      {runnersOf(layout).map((r, i) => (
        <rect key={`e${i}`} x={r.x} y={r.y} width={r.w} height={r.h} rx={30} fill={fill} stroke={edge} strokeWidth={6} />
      ))}
      {runnersOf(layout).map((r, i) => (
        <rect key={`f${i}`} x={r.x} y={r.y} width={r.w} height={r.h} rx={30} fill={fill} />
      ))}
    </>
  );
}

function farthestCorner(cx: number, cy: number, r: { x: number; y: number; w: number; h: number }): number {
  const xs = [r.x, r.x + r.w];
  const ys = [r.y, r.y + r.h];
  return Math.max(...xs.flatMap((x) => ys.map((y) => Math.hypot(x - cx, y - cy))));
}

/** Zig-zag crack across a vandalised exhibit. */
function Crack({ x, y, half }: { x: number; y: number; half: number }) {
  const w = Math.max(50, half * 0.7);
  return (
    <path
      d={`M${x - w} ${y - 30} L${x - w * 0.4} ${y} L${x - w * 0.1} ${y - 30} L${x + w * 0.3} ${y + 8} L${x + w} ${y - 18}`}
      fill="none"
      stroke="#ff6b6b"
      strokeWidth={7}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={0.9}
    />
  );
}

function Candle({ x, y, glowId }: { x: number; y: number; glowId: string }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <g className="flicker">
        <circle r={34} fill={`url(#${glowId})`} />
      </g>
      <rect x={-7} y={-6} width={14} height={28} rx={4} fill="#fff1d6" />
      <path d="M0 -26 Q8 -15 0 -7 Q-8 -15 0 -26 Z" fill="#ffb84d" className="flame" />
    </g>
  );
}

/** Columns, picture frames and velvet barriers. Drawn in both the dark and the lit layer. */
function Decor({ layout }: { layout: RoomLayout }) {
  const { rect } = layout;
  const inset = 50;
  const height = 130;
  return (
    <g>
      {layout.columns &&
        [
          [rect.x + inset, rect.y + 18 + height],
          [rect.x + rect.w - inset, rect.y + 18 + height],
          [rect.x + inset, rect.y + rect.h - 16],
          [rect.x + rect.w - inset, rect.y + rect.h - 16],
        ].map(([x, y]) => <Column key={`${x}-${y}`} x={x} baseY={y} height={height} />)}
      {layout.frames?.map((x, i) => <Frame key={x} x={x} top={rect.y + WALL / 2} variant={i + Math.round(rect.y / 100)} />)}
      {layout.statues?.map((p) => <Statue key={`${p.x}-${p.y}`} x={p.x} y={p.y} />)}
      {layout.frontDoor && <FrontDoor x={layout.frontDoor.x} y={layout.frontDoor.y} />}
      {layout.letterbox && <Letterbox x={layout.letterbox.x} y={layout.letterbox.y} />}
      {Object.entries(layout.exhibits).map(([id, ex]) => {
        if (NO_BARRIER.has(ex.kind)) return null;
        const box = exhibitBox(ex.kind, ex.scale);
        return <Barrier key={id} x={ex.x} y={ex.y + box.bottom + 34} half={box.half + 10} />;
      })}
    </g>
  );
}

function Exhibits({ layout }: { layout: RoomLayout }) {
  return (
    <>
      {Object.entries(layout.exhibits).map(([id, ex]) => (
        <g key={id} transform={`translate(${ex.x},${ex.y}) scale(${ex.scale ?? 1})`}>
          <ExhibitArt kind={ex.kind} span={ex.span} />
        </g>
      ))}
    </>
  );
}

/**
 * One room: dark by default, filled with warm lantern light while a guard patrols it.
 * At dawn (night won) the same warm light fills every room, sweeping in from the east, after `dawnDelay` s.
 */
export function Room({ room, snapshot, uid, selected, onSelect, dawnDelay = 0 }: {
  room: RoomData;
  snapshot: Snapshot;
  uid: string;
  selected: boolean;
  onSelect: (id: string) => void;
  dawnDelay?: number;
}) {
  const layout = ROOMS[room.id];
  const rs = snapshot.rooms[room.id];
  const { rect } = layout;
  const lighter = rs.litBy ? snapshot.guards.find((g) => g.id === rs.litBy) : undefined;
  const dawn = snapshot.outcome?.result === 'won';
  const lantern = !!lighter;
  const lit = lantern || dawn;
  // At dawn the name turns to its daylight colours once the light has reached the label (west side).
  const labelDelay = dawn && !lantern ? dawnDelay + 1.6 : 0;
  // Daylight comes in from the east wall; a lantern lights from the guard.
  const center = lighter ? guardPose(lighter) : dawn ? { x: rect.x + rect.w, y: rect.y + rect.h / 2 } : layout.anchor;
  // The mask gradient is solid to 72% of the radius, so this lights the whole room with a soft edge.
  const radius = farthestCorner(center.x, center.y, rect) / 0.72 + 40;
  const status: 'ok' | 'closed' | 'broken' = rs.dark ? 'broken' : rs.locked ? 'closed' : 'ok';
  const candles = snapshot.candlelight[room.wing] && status !== 'ok';
  const groups = snapshot.groups.filter((g) => g.room === room.id);
  const clip = `${uid}-${room.id}-clip`;
  const mask = `${uid}-${room.id}-mask`;
  const exhibits = Object.entries(layout.exhibits);
  const labelX = (layout.corridor ? rect.x + 70 : rect.x + (layout.columns ? 100 : 34)) + (layout.labelDx ?? 0);
  const labelY = layout.corridor ? rect.y + 64 : rect.y + 62;

  return (
    <g onClick={() => onSelect(room.id)} style={{ cursor: 'pointer' }}>
      <defs>
        <clipPath id={clip}>
          <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} rx={18} />
        </clipPath>
        <mask id={mask} maskUnits="userSpaceOnUse" x={rect.x} y={rect.y} width={rect.w} height={rect.h}>
          <motion.circle
            cx={center.x}
            cy={center.y}
            fill={`url(#${uid}-lightmask)`}
            initial={false}
            animate={{ r: lit ? radius : 0.01 }}
            transition={lantern ? LIGHT_SPRING : dawn ? { duration: 2.6, delay: dawnDelay, ease: 'easeInOut' } : LIGHT_OUT}
          />
        </mask>
      </defs>

      <g clipPath={`url(#${clip})`}>
        {/* Dark room: chequered museum floor in night tones, everything else as outlines */}
        <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill={`url(#${uid}-checker-dark)`} />
        <Runners layout={layout} fill="#1e1748" edge="#5a4eb8" />
        <g className={`ex-dark ${status === 'broken' ? 'ex-off' : ''}`}>
          <Decor layout={layout} />
          <Exhibits layout={layout} />
        </g>
        {/* Night lights under each exhibit: cyan running, violet closed, red vandalised */}
        {exhibits.map(([id, ex]) => {
          if (ex.kind === 'lamps') return null;
          const box = exhibitBox(ex.kind, ex.scale);
          return (
            <ellipse
              key={id}
              cx={ex.x}
              cy={ex.y + box.bottom + 8}
              rx={box.half * 0.85}
              ry={26}
              className={status === 'ok' ? 'shimmer' : ''}
              fill={`url(#${uid}-pip-${status})`}
            />
          );
        })}

        {/* Lantern light: a warm, fully coloured copy of the room revealed through a growing circle */}
        <g mask={`url(#${mask})`}>
          <g className="flicker">
            <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill={`url(#${uid}-checker-lit)`} />
            <Runners layout={layout} fill="#8a4f8f" edge="#c98fb8" />
            <Decor layout={layout} />
            <g className={status === 'broken' ? 'ex-broken' : status === 'closed' ? 'ex-closed' : ''}>
              <Exhibits layout={layout} />
            </g>
            <AnimatePresence>
              {lantern &&
                groups.map((g, i) => {
                  const spot = layout.spots[i % layout.spots.length];
                  const scale = INTRUDER_SCALE * (layout.corridor ? 0.85 : 1);
                  return (
                    <motion.g
                      key={g.id}
                      initial={{ opacity: 0, scale: scale * 0.5, x: spot.x, y: spot.y }}
                      animate={{ opacity: 1, scale, x: spot.x, y: spot.y }}
                      exit={{ opacity: 0, scale: scale * 0.5 }}
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
            ex.kind === 'lamps' ? null : <Crack key={id} x={ex.x} y={ex.y} half={exhibitBox(ex.kind, ex.scale).half} />,
          )}
        {candles &&
          exhibits.map(([id, ex]) => {
            const box = exhibitBox(ex.kind, ex.scale);
            return (
              <Candle
                key={id}
                glowId={`${uid}-glow`}
                x={ex.kind === 'lamps' ? ex.x - 300 : ex.x + box.half + 40}
                y={ex.kind === 'lamps' ? ex.y : ex.y + box.bottom - 10}
              />
            );
          })}

      </g>

      {/* Walls */}
      <rect
        x={rect.x}
        y={rect.y}
        width={rect.w}
        height={rect.h}
        rx={18}
        fill="none"
        stroke={rs.locked ? '#b9a8ff' : '#6f61d0'}
        strokeWidth={WALL}
        style={{ transition: 'stroke 600ms ease' }}
      />
      {layout.vip && (
        // The most critical room: a gold trim just inside the walls.
        <rect
          x={rect.x + 14}
          y={rect.y + 14}
          width={rect.w - 28}
          height={rect.h - 28}
          rx={12}
          fill="none"
          stroke="#f2c65e"
          strokeWidth={5}
          opacity={0.9}
          pointerEvents="none"
        />
      )}
      {selected && (
        <rect
          x={rect.x + 16}
          y={rect.y + 16}
          width={rect.w - 32}
          height={rect.h - 32}
          rx={14}
          fill="none"
          stroke="#ffd27a"
          strokeWidth={5}
          strokeDasharray="16 12"
          className="march"
        />
      )}

      {/* Name, with the real hospital system underneath */}
      <g className="game-text" pointerEvents="none">
        {layout.vip && (
          // A brass name plaque behind the label.
          <rect
            x={labelX - 24}
            y={labelY - NAME_SIZE - 6}
            width={Math.max(room.name.length * 22, room.real.length * 13) + 48}
            height={NAME_SIZE + REAL_SIZE + 44}
            rx={14}
            fill={lit ? '#f6e3b0' : '#3a2f6e'}
            stroke="#f2c65e"
            strokeWidth={5}
            style={{ transition: `fill 500ms ease ${labelDelay}s` }}
          />
        )}
        <text
          x={labelX}
          y={labelY}
          fontSize={NAME_SIZE}
          fontWeight={600}
          fill={lit ? '#5a3a22' : '#d8cffd'}
          style={{ transition: `fill 500ms ease ${labelDelay}s` }}
        >
          {room.name}
        </text>
        <text
          x={labelX}
          y={labelY + REAL_SIZE + 10}
          fontSize={REAL_SIZE}
          fontWeight={500}
          fill={lit ? '#7a5638' : '#a99ce6'}
          opacity={lit ? 0.85 : 0.7}
          style={{ transition: `fill 500ms ease ${labelDelay}s, opacity 500ms ease ${labelDelay}s` }}
        >
          {room.real}
        </text>
      </g>
    </g>
  );
}
