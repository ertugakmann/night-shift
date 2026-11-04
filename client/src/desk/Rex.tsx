import { AnimatePresence, motion } from 'motion/react';
import type { Snapshot } from '@night-shift/shared';
import { theRoom } from '@night-shift/shared';
import { worldOf } from '../game/view';
import { Paw } from './MiniMap';

const X = 1270;
const Y = 860;

/** Rex: a chubby guard dog with huge ears, curled up in the corner of the desk. */
function RexArt({ alert }: { alert: boolean }) {
  return (
    <g>
      <ellipse cx={0} cy={10} rx={150} ry={22} fill="#000" opacity={0.25} />
      {/* tail */}
      <g className="sway" style={{ transformOrigin: '110px -30px', transformBox: 'view-box' }}>
        <path d="M110 -30 Q160 -60 150 -100" fill="none" stroke="#d49a6a" strokeWidth={18} strokeLinecap="round" />
      </g>
      {/* body */}
      <g className="breathe">
        <ellipse cx={30} cy={-40} rx={120} ry={62} fill="#d49a6a" />
        <ellipse cx={40} cy={-24} rx={80} ry={34} fill="#f3d2ad" />
        <ellipse cx={-30} cy={2} rx={34} ry={16} fill="#c4875a" />
        <ellipse cx={80} cy={4} rx={34} ry={16} fill="#c4875a" />
      </g>
      {/* head */}
      <g transform="translate(-80,-70)">
        {/* huge ears: flop down when calm, up when Rex is sure about something */}
        <g transform={alert ? 'rotate(-30 -40 -20)' : 'rotate(25 -40 -20)'} style={{ transition: 'transform 300ms ease' }}>
          <ellipse cx={-52} cy={-6} rx={26} ry={58} fill="#8a5a3a" />
        </g>
        <g transform={alert ? 'rotate(30 40 -20)' : 'rotate(-25 40 -20)'} style={{ transition: 'transform 300ms ease' }}>
          <ellipse cx={52} cy={-6} rx={26} ry={58} fill="#8a5a3a" />
        </g>
        <circle r={58} fill="#d49a6a" />
        <ellipse cx={0} cy={22} rx={34} ry={26} fill="#f3d2ad" />
        <ellipse cx={0} cy={8} rx={12} ry={9} fill="#2a1d3a" />
        {alert ? (
          <>
            <circle cx={-22} cy={-12} r={8} fill="#2a1d3a" />
            <circle cx={22} cy={-12} r={8} fill="#2a1d3a" />
            <circle cx={-19} cy={-15} r={3} fill="#fff" />
            <circle cx={25} cy={-15} r={3} fill="#fff" />
          </>
        ) : (
          <>
            <path d="M-30 -10 Q-22 -4 -14 -10" fill="none" stroke="#2a1d3a" strokeWidth={4} strokeLinecap="round" />
            <path d="M14 -10 Q22 -4 30 -10" fill="none" stroke="#2a1d3a" strokeWidth={4} strokeLinecap="round" />
          </>
        )}
        <path d="M-10 32 Q0 40 10 32" fill="none" stroke="#2a1d3a" strokeWidth={3} strokeLinecap="round" />
        <circle cx={-34} cy={14} r={8} fill="#ff8fa3" opacity={0.5} />
        <circle cx={34} cy={14} r={8} fill="#ff8fa3" opacity={0.5} />
        {/* collar with a tag */}
        <rect x={-40} y={46} width={80} height={12} rx={6} fill="#9c86f5" />
        <circle cx={0} cy={64} r={9} fill="#f2c65e" />
      </g>
    </g>
  );
}

/** Rex in the reality view: an AI copilot module with a status ring. */
function CopilotArt({ alert }: { alert: boolean }) {
  return (
    <g>
      <circle r={92} fill="none" stroke={alert ? '#c9a6ff' : '#2f4a73'} strokeWidth={4} strokeDasharray="10 8" className={alert ? 'march' : ''} />
      <rect x={-64} y={-64} width={128} height={128} rx={26} fill="#16243d" stroke={alert ? '#c9a6ff' : '#2f4a73'} strokeWidth={5} />
      {[-36, -12, 12, 36].map((p) => (
        <g key={p}>
          <rect x={p - 4} y={-82} width={8} height={18} rx={3} fill="#2f4a73" />
          <rect x={p - 4} y={64} width={8} height={18} rx={3} fill="#2f4a73" />
          <rect x={-82} y={p - 4} width={18} height={8} rx={3} fill="#2f4a73" />
          <rect x={64} y={p - 4} width={18} height={8} rx={3} fill="#2f4a73" />
        </g>
      ))}
      <text y={20} textAnchor="middle" className="soc-text" fontSize={52} fontWeight={800} fill={alert ? '#c9a6ff' : '#3ee0d8'}>
        AI
      </text>
    </g>
  );
}

/** Rex in the corner, with a speech bubble: always a confidence percentage. */
export function Rex({ snapshot, selected, reality = false }: { snapshot: Snapshot; selected: string | null; reality?: boolean }) {
  const w = worldOf(snapshot);
  const threshold = w.sc.rex.barkThreshold;
  const estimates = snapshot.rex.estimates;
  const top = w.sc.rooms.reduce((best, r) => ((estimates[r.id] ?? 0) > (estimates[best.id] ?? 0) ? r : best), w.sc.rooms[0]);
  const focus = selected ? w.room.get(selected)! : top;
  const value = estimates[focus.id] ?? 0;
  const barking = value > threshold;
  const anyBark = (estimates[top.id] ?? 0) > threshold;
  const name = theRoom(focus.name);
  const lastBark = snapshot.log.filter((e) => e.kind === 'rex').at(-1);
  const woof = !!lastBark && snapshot.timeMs - lastBark.atMs < 1800;
  const yawning = snapshot.phase === 'intro' && snapshot.introMs >= 5500 && snapshot.introMs < 7200;
  const line = reality
    ? barking
      ? `AI copilot: likely compromise`
      : 'AI copilot: monitoring'
    : barking
      ? `Woof! ${name}`
      : selected
        ? `Hmm… ${name}`
        : 'Zzz… all calm';
  const detail = reality ? `${focus.real} · ${value}% confidence` : `Rex is ${value}% sure`;
  return (
    <g className="game-text">
      {/* bubble */}
      <g transform={`translate(${X - 240},${Y - 186})`}>
        <rect width={420} height={78} rx={reality ? 12 : 22} fill={reality ? '#0d1729' : '#fff4e0'} stroke={barking ? '#c9a6ff' : reality ? '#2f4a73' : '#e8dcc8'} strokeWidth={4} />
        <path d="M300 76 L330 104 L340 76 Z" fill={reality ? '#0d1729' : '#fff4e0'} />
        <Paw x={34} y={42} scale={1.4} />
        <text x={64} y={36} fontSize={22} fontWeight={700} fill={reality ? '#e6edf7' : '#2a1d5c'}>
          {line.length > 30 ? `${line.slice(0, 29)}…` : line}
        </text>
        <text x={64} y={64} fontSize={19} fill={reality ? '#c9a6ff' : '#6a5a8a'}>
          {detail.length > 36 ? `${detail.slice(0, 35)}…` : detail}
        </text>
      </g>
      <g transform={`translate(${X + 130},${Y - 6}) scale(0.8)`}>
        <motion.g animate={woof ? { y: [0, -14, 0, -8, 0] } : { y: 0 }} transition={{ duration: 0.6 }} key={lastBark?.id ?? 'calm'}>
          {reality ? (
            <g transform="translate(40,-70)">
              <CopilotArt alert={anyBark || barking || woof} />
            </g>
          ) : (
            <RexArt alert={anyBark || barking || woof} />
          )}
        </motion.g>
      </g>
      <AnimatePresence>
        {(woof || yawning) && (
          <motion.g
            key={woof ? `woof-${lastBark?.id}` : 'yawn'}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ type: 'spring', stiffness: 380, damping: 14 }}
            style={{ originX: `${X - 60}px`, originY: `${Y - 60}px` }}
          >
            <text x={X - 60} y={Y - 50} textAnchor="middle" fontSize={34} fontWeight={800} fill={woof ? '#c9a6ff' : '#fff1cf'} stroke="#2a1d5c" strokeWidth={6} paintOrder="stroke">
              {woof ? (reality ? 'ALERT' : 'WOOF!') : '*yawn*'}
            </text>
          </motion.g>
        )}
      </AnimatePresence>
    </g>
  );
}
