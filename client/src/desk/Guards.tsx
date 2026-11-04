import type { Snapshot } from '@night-shift/shared';
import { theRoom } from '@night-shift/shared';
import { GuardArt } from '../building/Characters';
import { ACTION_LABEL, worldOf } from '../game/view';
import { truncate } from './util';

const X = 590;
const Y = 352;
const W = 420;
const H = 166;
const GAP = 12;

const RING: Record<string, string> = { sam: '#3ee0d8', priya: '#ff9ec7', tom: '#a8e07a' };

/** ID badges for the three guards: portrait, name, what they are doing, and a progress ring. */
export function GuardCards({ snapshot }: { snapshot: Snapshot }) {
  const w = worldOf(snapshot);
  return (
    <g className="game-text">
      {snapshot.guards.map((g, i) => {
        const y = Y + i * (H + GAP);
        const task = g.task;
        const total = task ? task.walkMs + task.workMs : 1;
        const progress = task ? Math.min(1, task.elapsedMs / total) : 0;
        const left = task ? Math.ceil((total - task.elapsedMs) / 1000) : 0;
        const cx = X + 86;
        const cy = y + H / 2;
        const r = 58;
        const circumference = 2 * Math.PI * r;
        const where = theRoom(w.room.get(task ? task.room : g.room)!.name);
        const status = task
          ? `${ACTION_LABEL[task.action]} · ${where}`
          : `Free · ${where}`;
        const clipId = `portrait-${g.id}`;
        return (
          <g key={g.id}>
            {/* badge card with a clip */}
            <rect x={X} y={y} width={W} height={H} rx={20} fill="#fff4e0" />
            <rect x={X} y={y} width={W} height={H} rx={20} fill="none" stroke={task ? '#f2994a' : RING[g.id]} strokeWidth={5} />
            <rect x={X + W / 2 - 30} y={y - 10} width={60} height={18} rx={6} fill="#c9913c" />
            {/* portrait */}
            <clipPath id={clipId}>
              <circle cx={cx} cy={cy} r={r - 6} />
            </clipPath>
            <circle cx={cx} cy={cy} r={r - 6} fill="#2c2468" />
            <g clipPath={`url(#${clipId})`}>
              <g transform={`translate(${cx},${cy + 92}) scale(1.35)`}>
                <GuardArt id={g.id} raised={false} walking={false} facing={1} />
              </g>
            </g>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e8dcc8" strokeWidth={8} />
            {task && (
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke="#f2994a"
                strokeWidth={8}
                strokeLinecap="round"
                strokeDasharray={`${circumference * progress} ${circumference}`}
                transform={`rotate(-90 ${cx} ${cy})`}
              />
            )}
            {/* name and status */}
            <text x={X + 168} y={y + 58} fontSize={32} fontWeight={700} fill="#2a1d5c">
              {g.name}
            </text>
            <text x={X + 168} y={y + 94} fontSize={19} fill="#5a4a7a">
              {truncate(status, 24)}
            </text>
            <text x={X + 168} y={y + 128} fontSize={19} fontWeight={600} fill={task ? '#c96a1a' : '#1f9c94'}>
              {task ? `${task.arrived ? 'Working' : 'Walking'} · ${left}s` : 'Ready'}
            </text>
          </g>
        );
      })}
    </g>
  );
}
