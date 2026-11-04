import { useId, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Snapshot } from '@night-shift/shared';
import { worldOf } from '../game/view';
import { selectRoom, useGame } from '../net/game';
import { GuardArt, IntruderArt } from './Characters';
import { Effects } from './Effects';
import { guardPose } from './geometry';
import {
  DOORS,
  DOOR_WIDTH,
  ROOMS,
  SLICE_H,
  SLICE_W,
  intersects,
  sliceRect,
  type BuildingScreenId,
  type DoorLayout,
  type Rect,
} from './layout';
import { INTRUDER_SCALE, Room } from './Room';
import { VaultExtras } from './VaultExtras';

/** A building screen: its slice of the one continuous museum floor plan. */
export function BuildingScreen({ screen }: { screen: BuildingScreenId }) {
  const { snapshot, selected } = useGame();
  const uid = useId().replace(/:/g, '');
  const slice = sliceRect(screen);
  if (!snapshot) return <svg viewBox={`${slice.x} 0 ${SLICE_W} ${SLICE_H}`} className="h-full w-full" />;

  const w = worldOf(snapshot);
  const rooms = w.sc.rooms.filter((r) => intersects(ROOMS[r.id].rect, slice));
  const doors = DOORS.filter((d) => intersects({ x: d.x - 60, y: d.y - 60, w: 120, h: 120 }, slice));
  const visibleRooms = new Set(rooms.map((r) => r.id));

  return (
    <svg
      viewBox={`${slice.x} 0 ${SLICE_W} ${SLICE_H}`}
      preserveAspectRatio="xMidYMid meet"
      className="block h-full w-full select-none"
      role="img"
      aria-label="Museum floor plan"
    >
      <Defs uid={uid} />
      <rect x={slice.x} y={0} width={SLICE_W} height={SLICE_H} fill="#0c0922" />

      {rooms.map((room) => (
        <Room
          key={room.id}
          room={room}
          snapshot={snapshot}
          uid={uid}
          selected={selected === room.id}
          onSelect={(id) => selectRoom(selected === id ? null : id)}
        />
      ))}
      {doors.map((d) => (
        <Door key={`${d.a}-${d.b}`} door={d} locked={snapshot.rooms[d.a].locked || snapshot.rooms[d.b].locked} />
      ))}

      <Effects snapshot={snapshot} rooms={visibleRooms} />
      {snapshot.debug && <GangGhosts snapshot={snapshot} />}
      <Guards snapshot={snapshot} uid={uid} />
      <Dust slice={slice} />
      {screen === 5 && <VaultExtras snapshot={snapshot} slice={slice} uid={uid} />}
    </svg>
  );
}

function Defs({ uid }: { uid: string }) {
  return (
    <defs>
      <radialGradient id={`${uid}-lightmask`}>
        <stop offset="0" stopColor="#fff" />
        <stop offset="0.72" stopColor="#fff" />
        <stop offset="1" stopColor="#000" />
      </radialGradient>
      <radialGradient id={`${uid}-warmth`}>
        <stop offset="0" stopColor="#fff6d8" stopOpacity={0.35} />
        <stop offset="0.5" stopColor="#ffd27a" stopOpacity={0.08} />
        <stop offset="1" stopColor="#3a1f5c" stopOpacity={0.45} />
      </radialGradient>
      <radialGradient id={`${uid}-glow`}>
        <stop offset="0" stopColor="#ffd27a" stopOpacity={0.55} />
        <stop offset="1" stopColor="#ffd27a" stopOpacity={0} />
      </radialGradient>
      {(
        [
          ['ok', '#3ee0d8'],
          ['closed', '#9c86f5'],
          ['broken', '#ff6b6b'],
        ] as const
      ).map(([name, color]) => (
        <radialGradient key={name} id={`${uid}-pip-${name}`}>
          <stop offset="0" stopColor={color} stopOpacity={0.75} />
          <stop offset="1" stopColor={color} stopOpacity={0} />
        </radialGradient>
      ))}
      {/* Chequered museum floor: night tones in the dark, warm marble under the lantern */}
      <pattern id={`${uid}-checker-dark`} width={120} height={120} patternUnits="userSpaceOnUse">
        <rect width={120} height={120} fill="#2a2263" />
        <rect width={60} height={60} fill="#352c78" />
        <rect x={60} y={60} width={60} height={60} fill="#352c78" />
      </pattern>
      <pattern id={`${uid}-checker-lit`} width={120} height={120} patternUnits="userSpaceOnUse">
        <rect width={120} height={120} fill="#e9d3ad" />
        <rect width={60} height={60} fill="#fbf0dc" />
        <rect x={60} y={60} width={60} height={60} fill="#fbf0dc" />
      </pattern>
    </defs>
  );
}

/** The Emergency Hall's second door: a heavy steel vault portal, split across the screen border. */
function VaultPortal({ door }: { door: DoorLayout }) {
  // side -1: the frame on the left of the border (Emergency Hall), +1: on the right (the Vault).
  const frame = (side: -1 | 1) => (
    <g key={side} transform={`translate(${door.x},${door.y}) scale(${side},1)`}>
      <rect x={0} y={-104} width={92} height={208} rx={20} fill="#8b82c4" stroke="#5b4ba8" strokeWidth={6} />
      <rect x={0} y={-70} width={36} height={140} fill="#1c1645" />
      {[-84, 84].map((y) => (
        <circle key={y} cx={66} cy={y} r={7} fill="#f2c65e" />
      ))}
      <g transform="translate(64,0)">
        <circle r={20} fill="#5b4ba8" stroke="#f2c65e" strokeWidth={3} />
        {[0, 60, 120].map((a) => (
          <line key={a} x1={-15} y1={0} x2={15} y2={0} stroke="#f2c65e" strokeWidth={4} strokeLinecap="round" transform={`rotate(${a})`} />
        ))}
      </g>
    </g>
  );
  return (
    <g>
      {frame(-1)}
      {frame(1)}
      {/* this way to the Vault */}
      {[-270, -220, -170].map((dx, i) => (
        <path
          key={dx}
          d={`M${door.x + dx} ${door.y - 22} L${door.x + dx + 22} ${door.y} L${door.x + dx} ${door.y + 22}`}
          fill="none"
          stroke="#f2c65e"
          strokeWidth={8}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shimmer"
          style={{ animationDelay: `${i * 0.3}s` }}
        />
      ))}
    </g>
  );
}

function Door({ door, locked }: { door: DoorLayout; locked: boolean }) {
  const half = (door.grand ? 132 : DOOR_WIDTH) / 2;
  const v = door.orient === 'v';
  return (
    <g pointerEvents="none">
      {door.grand && <VaultPortal door={door} />}
      <rect
        x={v ? door.x - 9 : door.x - half}
        y={v ? door.y - half : door.y - 9}
        width={v ? 18 : half * 2}
        height={v ? half * 2 : 18}
        fill="#1c1645"
      />
      {[-1, 1].map((s) => (
        <circle key={s} cx={v ? door.x : door.x + s * half} cy={v ? door.y + s * half : door.y} r={9} fill="#5b4ba8" />
      ))}
      <AnimatePresence>
        {locked && (
          // Outer group places the padlock at the door; the inner one drops and grows around its own centre.
          <g transform={`translate(${door.x},${door.y})`}>
            <motion.g
              initial={{ scale: 0, opacity: 0, y: -30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
            >
              <circle r={30} fill="#9c86f5" opacity={0.25} />
              <path d="M-12 -4 V-14 A12 12 0 0 1 12 -14 V-4" fill="none" stroke="#e8e0ff" strokeWidth={6} />
              <rect x={-19} y={-6} width={38} height={30} rx={8} fill="#9c86f5" />
              <circle cy={7} r={5} fill="#2a1d5c" />
            </motion.g>
          </g>
        )}
      </AnimatePresence>
    </g>
  );
}

function Guards({ snapshot, uid }: { snapshot: Snapshot; uid: string }) {
  return (
    <g pointerEvents="none">
      {snapshot.guards.map((g) => (
        <GuardSprite key={g.id} snapshot={snapshot} id={g.id} uid={uid} />
      ))}
    </g>
  );
}

const GUARD_SCALE = 1.4;

/**
 * Debug only (D): where the gang really is, even in the dark. Drawn over the whole building and
 * gliding between rooms, so a group moving across a screen border leaves one screen and enters the next.
 */
function GangGhosts({ snapshot }: { snapshot: Snapshot }) {
  return (
    <g pointerEvents="none">
      {snapshot.groups.map((g) => {
        const inRoom = snapshot.groups.filter((o) => o.room === g.room);
        const spots = ROOMS[g.room].spots;
        const spot = spots[inRoom.indexOf(g) % spots.length];
        const occupied = Math.floor(snapshot.rooms[g.room].occupiedMs / 1000);
        return (
          <motion.g
            key={g.id}
            initial={false}
            animate={{ x: spot.x, y: spot.y }}
            transition={{ type: 'spring', stiffness: 40, damping: 14 }}
          >
            <g transform={`scale(${INTRUDER_SCALE})`}>
              <IntruderArt spotted={false} ghost />
            </g>
            <text y={-112} textAnchor="middle" className="game-text" fontSize={26} fontWeight={600} fill="#ff6b6b">
              #{g.id} · {occupied}s
            </text>
          </motion.g>
        );
      })}
    </g>
  );
}

/** Small rounded label floating above a guard. */
function NameTag({ name, y }: { name: string; y: number }) {
  const w = name.length * 14 + 28;
  return (
    <g transform={`translate(0,${y})`} className="game-text">
      <rect x={-w / 2} y={-18} width={w} height={34} rx={17} fill="#17123a" opacity={0.85} stroke="#ffd27a" strokeWidth={2} />
      <text y={8} textAnchor="middle" fontSize={22} fontWeight={600} fill="#fff1cf">
        {name}
      </text>
    </g>
  );
}

function GuardSprite({ snapshot, id, uid }: { snapshot: Snapshot; id: string; uid: string }) {
  const guard = snapshot.guards.find((g) => g.id === id)!;
  const pose = guardPose(guard);
  const last = useRef({ x: pose.x, facing: 1 as 1 | -1 });
  if (Math.abs(pose.x - last.current.x) > 0.5) last.current.facing = pose.x < last.current.x ? -1 : 1;
  last.current.x = pose.x;
  return (
    <motion.g initial={false} animate={{ x: pose.x, y: pose.y }} transition={{ duration: 0.12, ease: 'linear' }}>
      <circle r={150} cy={-40} fill={`url(#${uid}-glow)`} className="flicker" />
      <g transform={`scale(${GUARD_SCALE})`}>
        <GuardArt id={id} raised={pose.raised} walking={pose.walking} facing={last.current.facing} />
      </g>
      <NameTag name={guard.name} y={-170} />
    </motion.g>
  );
}

/** A few slow motes drifting through the dark. Pure CSS animation, cheap on every screen. */
function Dust({ slice }: { slice: Rect }) {
  const motes = useMemo(() => {
    let seed = slice.x + 3;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    return Array.from({ length: 14 }, () => ({
      x: slice.x + rnd() * SLICE_W,
      y: 60 + rnd() * (SLICE_H - 120),
      r: 2 + rnd() * 3,
      delay: -rnd() * 20,
      dur: 14 + rnd() * 12,
    }));
  }, [slice.x]);
  return (
    <g pointerEvents="none">
      {motes.map((m, i) => (
        <circle
          key={i}
          cx={m.x}
          cy={m.y}
          r={m.r}
          fill="#fff3d0"
          className="dust"
          style={{ animationDelay: `${m.delay}s`, animationDuration: `${m.dur}s` }}
        />
      ))}
    </g>
  );
}
