// "Reconnect the exhibit": Repair as a mini game. Cable ends on the left, sockets on the right, in mixed
// order; drag each cable to the socket of its colour (or tap one, then the other). Reality view: patching
// the restored system's network links, with port names. The server owns the game; every screen watches it.
import { useRef, useState } from 'react';
import { theRoom } from '@night-shift/shared';
import { ROOMS } from '../building/layout';
import { ExhibitArt, exhibitBox } from '../building/Exhibit';
import { worldOf } from '../game/view';
import { sendIntent, useGame } from '../net/game';
import { MiniHeader, MiniResult } from './MiniHeader';

const W = 1600;
const H = 900;
export const WIRE_COLOURS = ['#3ee0d8', '#ffd27a', '#9c86f5', '#ff9fb0'];
const LEFT_X = 330;
const RIGHT_X = 1270;
const rowY = (i: number) => 300 + i * 150;
/** Reality view: what each colour is. */
const VLANS = ['VLAN 10 · clinical', 'VLAN 20 · imaging', 'VLAN 30 · backup', 'VLAN 99 · management'];

function cable(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2;
  return `M${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
}

export function WiresGame({ reality }: { reality: boolean }) {
  const { snapshot, role } = useGame();
  const g = snapshot?.wires;
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ from: number; x: number; y: number; moved: boolean } | null>(null);
  if (!snapshot || !g) return null;
  const canAct = role !== 'watcher' && g.result === null;

  const toSvg = (e: React.PointerEvent) => {
    const m = svg.current?.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };
  const nearest = (x: number, y: number, side: 'left' | 'right') => {
    const cx = side === 'left' ? LEFT_X : RIGHT_X;
    if (Math.abs(x - cx) > 150) return -1;
    let best = -1;
    let dist = 90;
    for (let i = 0; i < g.left.length; i++) {
      const d = Math.abs(y - rowY(i));
      if (d < dist) {
        dist = d;
        best = i;
      }
    }
    return best;
  };

  function down(e: React.PointerEvent) {
    if (!canAct) return;
    const p = toSvg(e);
    const from = nearest(p.x, p.y, 'left');
    if (from >= 0 && !g!.connected.includes(g!.left[from])) {
      e.preventDefault();
      svg.current?.setPointerCapture(e.pointerId);
      setDrag({ from, x: p.x, y: p.y, moved: false });
      return;
    }
    // tap-tap: a cable picked earlier, now a socket
    const to = nearest(p.x, p.y, 'right');
    if (drag && to >= 0) {
      sendIntent({ type: 'wire', from: drag.from, to });
      setDrag(null);
    }
  }
  function move(e: React.PointerEvent) {
    if (!drag) return;
    const p = toSvg(e);
    setDrag({ ...drag, x: p.x, y: p.y, moved: drag.moved || Math.hypot(p.x - LEFT_X, p.y - rowY(drag.from)) > 30 });
  }
  function up(e: React.PointerEvent) {
    if (!drag) return;
    const p = toSvg(e);
    const to = nearest(p.x, p.y, 'right');
    if (to >= 0) {
      sendIntent({ type: 'wire', from: drag.from, to });
      setDrag(null);
    } else if (drag.moved) {
      setDrag(null); // dropped nowhere: the cable springs back
    } // a tap without moving keeps the cable picked: tap a socket next
  }

  const w = worldOf(snapshot);
  const room = w.room.get(g.room)!;
  const spark = g.sparkAtMs !== null && snapshot.timeMs - g.sparkAtMs < 600;
  const main = Object.values(ROOMS[g.room].exhibits).find((e) => e.kind !== 'lamps');
  const guard = snapshot.guards.find((x) => x.id === g.guard);

  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      className="block h-full w-full select-none"
      style={{ touchAction: 'none' }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => setDrag(null)}
      role="application"
      aria-label="Reconnect the exhibit"
    >
      {/* the back of the exhibit, or a network patch panel */}
      {reality ? (
        <g className="soc-text">
          <rect width={W} height={H} fill="#0a1120" />
          <rect x={150} y={180} width={W - 300} height={680} rx={16} fill="#0d1729" stroke="#2f4a73" strokeWidth={3} />
          <text x={190} y={232} fontSize={24} fontWeight={700} fill="#e6edf7">
            {room.real} · restored from backup
          </text>
          <text x={W - 190} y={836} textAnchor="end" fontSize={18} fill="#7f8ea8">
            core switch
          </text>
        </g>
      ) : (
        <g>
          <rect width={W} height={H} fill="#5b3a28" />
          <rect x={150} y={180} width={W - 300} height={680} rx={30} fill="#7a5038" stroke="#c9913c" strokeWidth={8} />
          {[0, 1, 2, 3, 4].map((i) => (
            <line key={i} x1={170} y1={220 + i * 140} x2={W - 170} y2={220 + i * 140} stroke="#6b4630" strokeWidth={4} />
          ))}
          {main && (
            <g transform={`translate(800,${600 - exhibitBox(main.kind, 2).bottom}) scale(2)`} opacity={g.result === 'fixed' ? 1 : 0.35} style={{ transition: 'opacity 600ms ease' }}>
              <ExhibitArt kind={main.kind} span={main.span} />
            </g>
          )}
          {g.result === null && (
            <text x={800} y={250} textAnchor="middle" className="game-text" fontSize={30} fontWeight={700} fill="#f3e3c3" opacity={0.7}>
              zzz… the exhibit is switched off
            </text>
          )}
        </g>
      )}

      {/* joined cables */}
      {g.connected.map((colour) => {
        const from = g.left.indexOf(colour);
        const to = g.right.indexOf(colour);
        return <path key={colour} d={cable(LEFT_X, rowY(from), RIGHT_X, rowY(to))} fill="none" stroke={WIRE_COLOURS[colour]} strokeWidth={18} strokeLinecap="round" />;
      })}
      {/* the cable being dragged */}
      {drag && (
        <path d={cable(LEFT_X, rowY(drag.from), drag.moved ? drag.x : LEFT_X + 60, drag.moved ? drag.y : rowY(drag.from))} fill="none" stroke={WIRE_COLOURS[g.left[drag.from]]} strokeWidth={18} strokeLinecap="round" opacity={0.85} pointerEvents="none" />
      )}

      {/* plugs on the left, sockets on the right */}
      {g.left.map((colour, i) => {
        const done = g.connected.includes(colour);
        const picked = drag?.from === i;
        return (
          <g key={`l${i}`} transform={`translate(${LEFT_X},${rowY(i)})`} style={{ cursor: canAct && !done ? 'grab' : 'default' }}>
            <path d={`M-150 0 H-30`} stroke={WIRE_COLOURS[colour]} strokeWidth={18} strokeLinecap="round" />
            <circle r={picked ? 40 : 34} fill={reality ? '#13233d' : '#3a2a1a'} stroke={WIRE_COLOURS[colour]} strokeWidth={10} style={{ transition: 'r 150ms ease' }} />
            <circle r={12} fill={done ? WIRE_COLOURS[colour] : reality ? '#0d1729' : '#2a1d12'} />
            {reality && (
              <text x={-60} y={-38} textAnchor="middle" className="soc-mono" fontSize={18} fill="#cfe0f5">
                eth{i}
              </text>
            )}
          </g>
        );
      })}
      {g.right.map((colour, i) => {
        const done = g.connected.includes(colour);
        return (
          <g key={`r${i}`} transform={`translate(${RIGHT_X},${rowY(i)})`}>
            <rect x={-40} y={-40} width={80} height={80} rx={reality ? 10 : 20} fill={reality ? '#13233d' : '#3a2a1a'} stroke={WIRE_COLOURS[colour]} strokeWidth={10} />
            <rect x={-14} y={-14} width={28} height={28} rx={6} fill={done ? WIRE_COLOURS[colour] : '#05040f'} />
            {reality && (
              <text y={-54} textAnchor="middle" className="soc-text" fontSize={17} fill="#cfe0f5">
                Gi1/0/{i + 1} · {VLANS[colour]}
              </text>
            )}
          </g>
        );
      })}
      {spark && (
        <g pointerEvents="none" className="fade-up">
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <path key={a} d="M0 -40 L6 -18 L0 -12 L-6 -18 Z" fill="#ffd27a" transform={`translate(${(LEFT_X + RIGHT_X) / 2},520) rotate(${a})`} />
          ))}
          <text x={800} y={600} textAnchor="middle" className="game-text" fontSize={30} fontWeight={800} fill="#f2994a">
            Bzzt! Wrong socket
          </text>
        </g>
      )}

      <MiniHeader
        title={reality ? 'Restore the network links' : 'Reconnect the exhibit'}
        sub={reality ? `Analyst ${guard?.name ?? ''} · match each port to its VLAN` : `${theRoom(room.name)} · drag each cable to its colour`}
        snapshot={snapshot}
        startedMs={g.startedMs}
        endsMs={g.result === null ? g.endsMs : snapshot.timeMs}
        limitMs={w.ms.wires}
        done={g.connected.length}
        total={g.left.length}
        flash={spark}
        reality={reality}
        canAct={role !== 'watcher'}
      />
      {g.result && (
        <MiniResult
          good={g.result === 'fixed'}
          reality={reality}
          title={g.result === 'fixed' ? (reality ? 'Back online' : 'Shining again!') : reality ? 'Restore failed' : 'Sparks everywhere!'}
          sub={g.result === 'fixed' ? (reality ? `${room.real} restored from backup.` : `${room.name} is running again.`) : reality ? 'Links not up. Run the restore again.' : 'Still switched off. Try Repair again.'}
        />
      )}
    </svg>
  );
}

