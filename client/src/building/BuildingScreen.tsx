import { useId, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Snapshot } from '@night-shift/shared';
import { worldOf } from '../game/view';
import { selectRoom, useGame } from '../net/game';
import { GuardArt } from './Characters';
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
import { Room } from './Room';

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
      <Garden slice={slice} />

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
      <Guards snapshot={snapshot} uid={uid} />
      <Dust slice={slice} />
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
      <pattern id={`${uid}-tiles`} width={80} height={80} patternUnits="userSpaceOnUse">
        <path d="M80 0 L0 0 0 80" fill="none" stroke="#241d58" strokeWidth={2} />
      </pattern>
      <pattern id={`${uid}-parquet`} width={120} height={40} patternUnits="userSpaceOnUse">
        <rect width={120} height={40} fill="#e7c48c" />
        <rect width={120} height={20} fill="#efcf98" />
        <path d="M0 20 H120 M60 0 V20 M0 20 V40 M120 20 V40" stroke="#d1a96d" strokeWidth={2} />
      </pattern>
    </defs>
  );
}

/** Round tree tops and bushes in the gaps outside the walls. */
function Garden({ slice }: { slice: Rect }) {
  const trees = useMemo(() => {
    const out: { x: number; y: number; r: number }[] = [];
    let seed = slice.x + 7;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 14; i++) {
      const top = i % 2 === 0;
      out.push({ x: slice.x + 40 + rnd() * (SLICE_W - 80), y: top ? 12 + rnd() * 30 : SLICE_H - 40 + rnd() * 30, r: 14 + rnd() * 16 });
    }
    return out;
  }, [slice.x]);
  return (
    <g>
      {trees.map((t, i) => (
        <g key={i} transform={`translate(${t.x},${t.y})`}>
          <circle cx={-t.r * 0.7} cy={t.r * 0.15} r={t.r * 0.7} fill="#10233b" />
          <circle cx={t.r * 0.7} cy={t.r * 0.2} r={t.r * 0.65} fill="#10233b" />
          <circle r={t.r} fill="#132a45" />
          <circle cx={-t.r * 0.3} cy={-t.r * 0.35} r={t.r * 0.35} fill="#1a3757" />
        </g>
      ))}
    </g>
  );
}

function Door({ door, locked }: { door: DoorLayout; locked: boolean }) {
  const half = DOOR_WIDTH / 2;
  const v = door.orient === 'v';
  return (
    <g pointerEvents="none">
      <rect
        x={v ? door.x - 9 : door.x - half}
        y={v ? door.y - half : door.y - 9}
        width={v ? 18 : DOOR_WIDTH}
        height={v ? DOOR_WIDTH : 18}
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

function GuardSprite({ snapshot, id, uid }: { snapshot: Snapshot; id: string; uid: string }) {
  const guard = snapshot.guards.find((g) => g.id === id)!;
  const pose = guardPose(guard);
  const last = useRef({ x: pose.x, facing: 1 as 1 | -1 });
  if (Math.abs(pose.x - last.current.x) > 0.5) last.current.facing = pose.x < last.current.x ? -1 : 1;
  last.current.x = pose.x;
  return (
    <motion.g initial={false} animate={{ x: pose.x, y: pose.y }} transition={{ duration: 0.12, ease: 'linear' }}>
      <circle r={110} cy={-30} fill={`url(#${uid}-glow)`} className="flicker" />
      <GuardArt id={id} raised={pose.raised} walking={pose.walking} facing={last.current.facing} />
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
