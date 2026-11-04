import { ACTIONS, type ActionKind, type Snapshot } from '@night-shift/shared';
import { ACTION_LABEL, worldOf } from '../game/view';
import { selectRoom, sendIntent, showNotice } from '../net/game';
import { ROOMS } from '../building/layout';
import { Paw } from './MiniMap';
import { useState } from 'react';
import { SPOT_FIRST, SPOT_FIRST_REAL, actionBlocked, mapX, mapY, nearestFreeGuard } from './util';

const W = 470;
const H = 236;
const INK = '#2a1d5c';

function ActionIcon({ action }: { action: ActionKind }) {
  switch (action) {
    case 'patrol':
      return (
        <g>
          <line x1={0} y1={-20} x2={0} y2={-12} stroke="#c9913c" strokeWidth={3} />
          <rect x={-11} y={-12} width={22} height={26} rx={6} fill="#c9913c" />
          <rect x={-7} y={-8} width={14} height={18} rx={4} fill="#fff1b8" />
        </g>
      );
    case 'lock':
      return (
        <g>
          <path d="M-9 -2 V-9 A9 9 0 0 1 9 -9 V-2" fill="none" stroke="#e8e0ff" strokeWidth={4} />
          <rect x={-13} y={-3} width={26} height={20} rx={5} fill="#9c86f5" />
          <circle cy={7} r={3} fill={INK} />
        </g>
      );
    case 'unlock':
      return (
        <g>
          <path d="M-9 -2 V-9 A9 9 0 0 1 9 -9 V-14" fill="none" stroke="#e8e0ff" strokeWidth={4} transform="rotate(-18 -9 -2)" />
          <rect x={-13} y={-3} width={26} height={20} rx={5} fill="#c9b8ff" />
          <circle cy={7} r={3} fill={INK} />
        </g>
      );
    case 'evict':
      return (
        <g>
          <rect x={-14} y={-16} width={20} height={32} rx={3} fill="#a8714a" />
          <path d="M2 0 H18 M12 -6 L18 0 L12 6" fill="none" stroke="#ffd27a" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );
    case 'repair':
      return (
        <g transform="rotate(-40)">
          <rect x={-4} y={-6} width={8} height={24} rx={3} fill="#bfb2d6" />
          <path d="M-11 -16 A11 11 0 1 0 11 -16 L5 -10 L-5 -10 Z" fill="#bfb2d6" />
          <path d="M14 -20 l3 -6 l3 6 l6 3 l-6 3 l-3 6 l-3 -6 l-6 -3 Z" fill="#ffd27a" transform="rotate(40)" />
        </g>
      );
    case 'candlelight':
      return (
        <g>
          <rect x={-6} y={-4} width={12} height={22} rx={3} fill="#fff1d6" />
          <path d="M0 -20 Q7 -11 0 -5 Q-7 -11 0 -20 Z" fill="#ffb84d" />
        </g>
      );
  }
}

/** The little action menu that opens over the desk when a room is picked. */
/**
 * `floating`: shown over a zoomed-in monitor in /wall, where the desk map is off screen. Centred low on the
 * view, with no pointer to the map.
 */
export function ActionPopup({
  snapshot,
  roomId,
  canAct,
  floating = false,
  reality = false,
}: {
  snapshot: Snapshot;
  roomId: string;
  canAct: boolean;
  floating?: boolean;
  reality?: boolean;
}) {
  const [hover, setHover] = useState<ActionKind | null>(null);
  const w = worldOf(snapshot);
  const room = w.room.get(roomId);
  if (!room) return null;
  const reason = (a: ActionKind) => {
    const r = actionBlocked(snapshot, roomId, a);
    return r === SPOT_FIRST && reality ? SPOT_FIRST_REAL : r;
  };
  const rect = ROOMS[roomId].rect;
  const anchorX = mapX(rect.x + rect.w / 2);
  const anchorY = mapY(rect.y + rect.h);
  const x = floating ? (1600 - W) / 2 : Math.min(1600 - W - 24, Math.max(24, anchorX - W / 2));
  const y = floating ? 900 - H - 40 : 292;
  const estimate = snapshot.rex.estimates[roomId] ?? 0;
  const barking = estimate > w.sc.rex.barkThreshold;
  const nearest = nearestFreeGuard(snapshot, roomId);
  const who = nearest
    ? `${nearest.guard.name} goes · ${nearest.rooms === 0 ? 'already there' : `${nearest.rooms} room${nearest.rooms > 1 ? 's' : ''} away`}`
    : 'All guards are busy';

  function act(action: ActionKind) {
    if (!canAct) return showNotice('Watching only. Enter the control code to take part.');
    const blocked = reason(action);
    if (blocked) return showNotice(blocked);
    if (!nearest) return showNotice('All three guards are busy.');
    sendIntent({ type: 'action', action, room: roomId });
    selectRoom(null);
  }

  return (
    <g className="game-text" onClick={(e) => e.stopPropagation()}>
      {/* pointer up to the room on the map */}
      {!floating && <path d={`M${anchorX - 16} ${y + 2} L${anchorX} ${Math.min(anchorY + 6, y - 10)} L${anchorX + 16} ${y + 2} Z`} fill="#fff4e0" />}
      <rect x={x + 6} y={y + 8} width={W} height={H} rx={24} fill="#000" opacity={0.3} />
      <rect x={x} y={y} width={W} height={H} rx={reality ? 14 : 24} fill={reality ? '#0d1729' : '#fff4e0'} stroke={reality ? '#3ee0d8' : '#f2c65e'} strokeWidth={reality ? 3 : 5} />

      <text x={x + 24} y={y + 42} fontSize={30} fontWeight={700} fill={INK}>
        {reality ? room.real : room.name}
      </text>
      <text x={x + 24} y={y + 70} fontSize={19} fill="#6a5a8a">
        {reality ? `in the game: ${room.name}` : room.real}
      </text>
      <Paw x={x + 34} y={y + 100} scale={1.1} />
      <text x={x + 52} y={y + 106} fontSize={19} fontWeight={600} fill={barking ? '#7a4fd0' : '#6a5a8a'}>
        {reality ? 'AI copilot' : 'Rex'} {estimate}%
      </text>
      <text x={x + 150} y={y + 106} fontSize={19} fill="#6a5a8a">
        · {who}
      </text>

      {/* close */}
      <g onClick={() => selectRoom(null)} style={{ cursor: 'pointer' }}>
        <circle cx={x + W - 30} cy={y + 30} r={18} fill="#e8dcc8" />
        <path d={`M${x + W - 37} ${y + 23} l14 14 M${x + W - 23} ${y + 23} l-14 14`} stroke={INK} strokeWidth={4} strokeLinecap="round" />
      </g>

      {/* five slots: Lock turns into Unlock on a locked room */}
      {ACTIONS.filter((a) => a !== 'unlock')
        .map((a) => (a === 'lock' && snapshot.rooms[roomId].locked ? ('unlock' as const) : a))
        .map((action, i) => {
        const blocked = !canAct || actionBlocked(snapshot, roomId, action) !== null;
        const bx = x + 18 + i * 88;
        const by = y + 124;
        const label = reality
          ? ({ patrol: 'EDR scan', lock: 'Isolate', unlock: 'Reconnect', evict: 'Eradicate', repair: 'Restore', candlelight: 'Downtime' } as const)[action]
          : action === 'candlelight'
            ? 'Candles'
            : action === 'lock'
              ? 'Lock'
              : ACTION_LABEL[action];
        return (
          <g key={action} onClick={() => act(action)} onPointerEnter={() => setHover(action)} onPointerLeave={() => setHover((h) => (h === action ? null : h))} style={{ cursor: 'pointer' }} opacity={blocked ? 0.38 : 1}>
            <rect x={bx} y={by} width={82} height={98} rx={18} fill={blocked ? '#e8dcc8' : '#2c2468'} />
            <circle cx={bx + 41} cy={by + 38} r={27} fill={blocked ? '#d6c8b0' : '#3a2f7a'} />
            <g transform={`translate(${bx + 41},${by + 38})`}>
              <ActionIcon action={action} />
            </g>
            <text x={bx + 41} y={by + 86} textAnchor="middle" fontSize={17} fontWeight={600} fill={blocked ? '#8a7a9a' : '#fff1cf'}>
              {label}
            </text>
          </g>
        );
      })}

      {/* why a button is greyed out, on hover (a tap shows the same as a notice) */}
      {(() => {
        if (!hover) return null;
        const why = reason(hover);
        if (!why || !canAct) return null;
        const slots = ACTIONS.filter((a) => a !== 'unlock').map((a) => (a === 'lock' && snapshot.rooms[roomId].locked ? 'unlock' : a));
        const i = slots.indexOf(hover);
        if (i < 0) return null;
        const tw = Math.max(150, why.length * 10 + 32);
        const cx = Math.min(x + W - tw / 2, Math.max(x + tw / 2, x + 18 + i * 88 + 41));
        const ty = y + H + 10;
        return (
          <g pointerEvents="none" className={reality ? 'soc-text' : 'game-text'}>
            <path d={`M${x + 18 + i * 88 + 31} ${ty} L${x + 18 + i * 88 + 41} ${ty - 10} L${x + 18 + i * 88 + 51} ${ty} Z`} fill={reality ? '#3ee0d8' : INK} />
            <rect x={cx - tw / 2} y={ty} width={tw} height={40} rx={20} fill={reality ? '#3ee0d8' : INK} />
            <text x={cx} y={ty + 27} textAnchor="middle" fontSize={19} fontWeight={700} fill={reality ? '#04212a' : '#fff1cf'}>
              {why}
            </text>
          </g>
        );
      })()}
    </g>
  );
}
