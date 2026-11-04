import type { LogEntry, Snapshot } from '@night-shift/shared';
import { logClock } from '../game/view';
import { wrap } from './util';

const X = 30;
const Y = 360;
const W = 530;
const H = 520;

/** Characters per line on the LCD (a 19-unit display font). */
const COLS = 40;
const LINE_H = 25;
const MAX_LINES = 13;

const COLOR: Record<Exclude<LogEntry['kind'], 'cctv'>, string> = {
  radio: '#b8ffe2',
  staff: '#ffd27a',
  rex: '#d6c4ff',
  event: '#ff9a8a',
};

interface Line {
  key: string;
  time: string | null;
  speaker: string | null;
  text: string;
  color: string;
}

/** Radio log as wrapped LCD lines, newest at the bottom. */
function lcdLines(snapshot: Snapshot): Line[] {
  const entries = snapshot.log.filter((e) => e.kind !== 'cctv');
  const lines: Line[] = [];
  for (const e of entries) {
    const speaker = e.speaker ? `${e.speaker}: ` : '';
    const wrapped = wrap(`${speaker}${e.text}`, COLS - 6, 3);
    wrapped.forEach((text, i) => {
      const isFirst = i === 0;
      lines.push({
        key: `${e.id}-${i}`,
        time: isFirst ? logClock(snapshot, e.atMs) : null,
        speaker: isFirst && e.speaker ? speaker : null,
        text: isFirst && e.speaker ? text.slice(speaker.length) : text,
        color: COLOR[e.kind as Exclude<LogEntry['kind'], 'cctv'>],
      });
    });
  }
  return lines.slice(-MAX_LINES);
}

/** A chunky desk radio. Guard calls, staff reports, Rex and events scroll on its LCD. */
export function Radio({ snapshot }: { snapshot: Snapshot }) {
  const lines = lcdLines(snapshot);
  const last = snapshot.log.filter((e) => e.kind !== 'cctv').at(-1);
  const fresh = last ? snapshot.timeMs - last.atMs < 1500 : false;
  return (
    <g className="game-text">
      {/* antenna */}
      <line x1={X + W - 80} y1={Y + 6} x2={X + W - 40} y2={Y - 4} stroke="#8a7cf0" strokeWidth={8} strokeLinecap="round" />
      <circle cx={X + W - 38} cy={Y - 6} r={9} fill={fresh ? '#ff6b6b' : '#c9a6ff'} />
      {/* body */}
      <rect x={X} y={Y} width={W} height={H} rx={34} fill="#4b3f99" />
      <rect x={X + 10} y={Y + 10} width={W - 20} height={H - 20} rx={26} fill="#5b4bb8" />
      <rect x={X + 10} y={Y + 10} width={26} height={H - 20} rx={12} fill="#a8714a" />
      <rect x={X + W - 36} y={Y + 10} width={26} height={H - 20} rx={12} fill="#a8714a" />
      {/* LCD */}
      <rect x={X + 50} y={Y + 30} width={W - 100} height={MAX_LINES * LINE_H + 40} rx={14} fill="#0f2e2c" stroke="#2a6b63" strokeWidth={4} />
      <text x={X + 66} y={Y + 58} fontSize={17} fontWeight={600} fill="#5fd6b2" opacity={0.75}>
        CH 1 · NIGHT SHIFT
      </text>
      <circle cx={X + W - 70} cy={Y + 52} r={7} fill={fresh ? '#9cffd9' : '#2a6b63'} className={fresh ? 'shimmer' : ''} />
      {lines.map((l, i) => (
        <text key={l.key} x={X + 66} y={Y + 92 + i * LINE_H} fontSize={19} fill={l.color}>
          {l.time && <tspan fill="#5fd6b2">{l.time} </tspan>}
          {!l.time && <tspan>{'      '}</tspan>}
          {l.speaker && <tspan fontWeight={700}>{l.speaker}</tspan>}
          <tspan>{l.text}</tspan>
        </text>
      ))}
      {/* speaker grille and knobs */}
      {Array.from({ length: 5 }, (_, r) =>
        Array.from({ length: 9 }, (_, c) => <circle key={`${r}-${c}`} cx={X + 80 + c * 22} cy={Y + H - 84 + r * 14} r={4} fill="#3a2f7a" />),
      )}
      {[X + W - 160, X + W - 90].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy={Y + H - 56} r={26} fill="#f2c65e" stroke="#c9913c" strokeWidth={5} />
          <line x1={cx} y1={Y + H - 56} x2={cx} y2={Y + H - 76} stroke="#5a3a22" strokeWidth={5} strokeLinecap="round" />
        </g>
      ))}
    </g>
  );
}
