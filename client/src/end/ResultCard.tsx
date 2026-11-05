// The result card at the end of the night: care continuity against the benchmarks, MTTD and MTTR, the
// trust analysis for Rex, and the patient impact. Drawn in SVG (1200×760 units, origin top-left) so it
// sits on screen 5 and over the /wall office alike. Museum and SOC styles share the layout.
import { BENCHMARKS, IMPACT_LABELS, IMPACT_TYPES, type Outcome, type Snapshot } from '@night-shift/shared';
import { motion } from 'motion/react';
import { ImpactIcon } from '../building/VaultExtras';
import { sendIntent, useGame } from '../net/game';
import { durations, headline, trustLines } from './text';

export const CARD_W = 1200;
export const CARD_H = 760;

interface Theme {
  card: string;
  edge: string;
  tile: string;
  tileEdge: string;
  text: string;
  sub: string;
  accent: string;
  font: string;
}

const MUSEUM: Theme = { card: '#17123a', edge: '#f2c65e', tile: '#241c55', tileEdge: '#5b4ba8', text: '#fff1cf', sub: '#b9adf0', accent: '#ffd27a', font: 'game-text' };
const SOC: Theme = { card: '#0b1424', edge: '#2f4a73', tile: '#101d33', tileEdge: '#24395c', text: '#e6edf7', sub: '#8494ad', accent: '#3ee0d8', font: 'soc-text' };

function careColor(v: number): string {
  return v >= BENCHMARKS.averageCare ? '#3ee0d8' : v >= 50 ? '#f2994a' : '#ff6b6b';
}

function Tile({ x, y, w, h, t, title, tag }: { x: number; y: number; w: number; h: number; t: Theme; title: string; tag?: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={20} fill={t.tile} stroke={t.tileEdge} strokeWidth={3} />
      <text x={x + 24} y={y + 38} fontSize={24} fontWeight={700} fill={t.accent} letterSpacing={0.5}>
        {title}
        {tag && (
          <tspan dx={12} fontSize={18} fontWeight={400} fill={t.sub} letterSpacing={0}>
            {tag}
          </tspan>
        )}
      </text>
    </g>
  );
}

/** Care continuity as a ring, with the benchmark track underneath. */
function CareBlock({ value, t, reality }: { value: number; t: Theme; reality: boolean }) {
  const cx = 250;
  const cy = 318;
  const r = 128;
  const circ = 2 * Math.PI * r;
  const color = careColor(value);
  const tx = 70;
  const tw = 360;
  const at = (v: number) => tx + (v / 100) * tw;
  const best = value > BENCHMARKS.bestCare;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={t.tile} strokeWidth={28} />
      <motion.circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={28}
        strokeLinecap="round"
        strokeDasharray={circ}
        transform={`rotate(-90 ${cx} ${cy})`}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ * (1 - value / 100) }}
        transition={{ duration: 1.6, ease: 'easeOut', delay: 0.3 }}
      />
      <text x={cx} y={cy + 26} textAnchor="middle" fontSize={80} fontWeight={800} fill={t.text}>
        {value}
        <tspan fontSize={40}>%</tspan>
      </text>
      <text x={cx} y={496} textAnchor="middle" fontSize={32} fontWeight={700} fill={t.text}>
        Care continuity
      </text>
      <text x={cx} y={526} textAnchor="middle" fontSize={19} fill={t.sub}>
        {reality ? 'clinical service availability' : 'exhibits kept running, all night'}
      </text>

      {/* benchmark track */}
      <rect x={tx} y={588} width={tw} height={12} rx={6} fill={t.tile} />
      <rect x={tx} y={588} width={Math.max(12, at(value) - tx)} height={12} rx={6} fill={color} opacity={0.85} />
      {[
        { v: BENCHMARKS.averageCare, label: 'avg' },
        { v: BENCHMARKS.bestCare, label: 'best' },
      ].map((m) => (
        <g key={m.label}>
          <rect x={at(m.v) - 2} y={578} width={4} height={32} rx={2} fill={t.sub} />
          <text x={at(m.v)} y={570} textAnchor="middle" fontSize={17} fill={t.sub}>
            {m.label}
          </text>
        </g>
      ))}
      <circle cx={at(value)} cy={594} r={13} fill={color} stroke={t.card} strokeWidth={4} />
      <text x={cx} y={646} textAnchor="middle" fontSize={22} fill={t.text}>
        Average {BENCHMARKS.averageCare}%, best {BENCHMARKS.bestCare}%
      </text>
      {best && (
        <text x={cx} y={678} textAnchor="middle" fontSize={22} fontWeight={700} fill={t.accent}>
          {reality ? 'Best result on record' : 'A new museum record!'}
        </text>
      )}
    </g>
  );
}

/** MTTD or MTTR: the average over the groups it applies to, and how many of the gang's groups that was. */
function TimeTile({ x, label, tag, ms, missing, count, instant, snapshot, t }: { x: number; label: string; tag: string; ms: number | null; missing: string; count: string; instant: string; snapshot: Snapshot; t: Theme }) {
  const d = durations(snapshot, ms);
  if (ms === 0) {
    // stopped before anyone needed to respond: no time to show
    return (
      <g>
        <Tile x={x} y={150} w={320} h={168} t={t} title={label} tag={tag} />
        <text x={x + 24} y={150 + 98} fontSize={42} fontWeight={800} fill={t.text}>
          {instant}
        </text>
        <text x={x + 24} y={150 + 136} fontSize={19} fill={t.sub}>
          {count}
        </text>
      </g>
    );
  }
  return (
    <g>
      <Tile x={x} y={150} w={320} h={168} t={t} title={label} tag={tag} />
      <text x={x + 24} y={150 + 98} fontSize={d ? 42 : 34} fontWeight={800} fill={d ? t.text : '#f2994a'}>
        {d ? d.night : missing}
      </text>
      <text x={x + 24} y={150 + 136} fontSize={19} fill={t.sub}>
        {d ? `${count} · ${d.real}` : count}
      </text>
    </g>
  );
}

function RexIcon({ reality }: { reality: boolean }) {
  if (reality) {
    return (
      <g>
        <rect x={-30} y={-30} width={60} height={60} rx={14} fill="#16243d" stroke="#3ee0d8" strokeWidth={3} />
        <text y={10} textAnchor="middle" fontSize={26} fontWeight={800} fill="#3ee0d8">
          AI
        </text>
      </g>
    );
  }
  return (
    <g>
      <ellipse cx={-26} cy={-6} rx={13} ry={26} fill="#8a5a3a" transform="rotate(18 -26 -6)" />
      <ellipse cx={26} cy={-6} rx={13} ry={26} fill="#8a5a3a" transform="rotate(-18 26 -6)" />
      <circle r={26} fill="#d9a066" />
      <ellipse cy={10} rx={14} ry={10} fill="#f3d3a8" />
      <circle cx={-9} cy={-5} r={3.5} fill="#2a1d3a" />
      <circle cx={9} cy={-5} r={3.5} fill="#2a1d3a" />
      <ellipse cy={4} rx={5} ry={3.5} fill="#2a1d3a" />
    </g>
  );
}

function AnotherNight({ t }: { t: Theme }) {
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label="Another night: reset the game"
      style={{ cursor: 'pointer' }}
      onClick={(e) => {
        e.stopPropagation();
        sendIntent({ type: 'reset' });
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') sendIntent({ type: 'reset' });
      }}
    >
      <rect x={CARD_W - 330} y={CARD_H - 92} width={290} height={64} rx={32} fill={t.accent} />
      <text x={CARD_W - 185} y={CARD_H - 50} textAnchor="middle" fontSize={28} fontWeight={800} fill={t.card}>
        Another night ↻
      </text>
    </g>
  );
}

export function ResultCard({ snapshot, outcome, reality }: { snapshot: Snapshot; outcome: Outcome; reality: boolean }) {
  const { role } = useGame();
  const t = reality ? SOC : MUSEUM;
  const won = outcome.result === 'won';
  const { title, sub } = headline(snapshot, outcome, reality);
  const s = outcome.summary;
  const [trust1, trust2] = trustLines(snapshot, reality);
  const right = 500;
  const rw = CARD_W - right - 40;

  return (
    <g className={t.font}>
      <rect x={10} y={14} width={CARD_W} height={CARD_H} rx={36} fill="#000" opacity={0.35} />
      <rect width={CARD_W} height={CARD_H} rx={36} fill={t.card} stroke={won ? t.edge : '#ff6b6b'} strokeWidth={6} />

      {/* header */}
      <text x={56} y={80} fontSize={50} fontWeight={800} fill={won ? t.text : '#ff6b6b'}>
        {title}
      </text>
      <text x={56} y={120} fontSize={24} fill={t.sub}>
        {sub}
      </text>
      <g transform={`translate(${CARD_W - 90},78)`}>
        {won && reality ? (
          <g>
            <path d="M0 -46 L38 -32 V2 Q38 32 0 50 Q-38 32 -38 2 V-32 Z" fill="#3ee0d8" opacity={0.2} stroke="#3ee0d8" strokeWidth={5} />
            <path d="M-16 2 L-4 14 L18 -12" fill="none" stroke="#3ee0d8" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        ) : won ? (
          <g>
            {Array.from({ length: 8 }, (_, i) => (
              <rect key={i} x={-4} y={-58} width={8} height={18} rx={4} fill="#ffd27a" transform={`rotate(${i * 45})`} />
            ))}
            <circle r={30} fill="#ffd27a" />
          </g>
        ) : (
          <g>
            <circle r={40} fill="#ff6b6b" opacity={0.25} className="danger-pulse" />
            <path d="M-22 18 V-4 A22 22 0 0 1 22 -4 V18 Z" fill="#ff6b6b" />
            <rect x={-30} y={18} width={60} height={10} rx={4} fill="#ff9a8a" />
          </g>
        )}
      </g>

      <CareBlock value={s.careContinuity} t={t} reality={reality} />

      {/* detect and respond */}
      <TimeTile x={right} label="MTTD" tag={reality ? 'mean time to detect' : 'time to spot them'} ms={s.mttdMs} missing="Never spotted" instant={reality ? 'Immediate' : 'At once'} count={`${s.spotted} of ${s.groups} ${reality ? 'detected' : 'spotted'}`} snapshot={snapshot} t={t} />
      <TimeTile x={right + 340} label="MTTR" tag={reality ? 'mean time to respond' : 'time to stop them'} ms={s.mttrMs} missing="Never stopped" instant={reality ? 'Immediate' : 'At once'} count={`${s.stopped} of ${s.groups} ${reality ? 'contained' : 'stopped'}`} snapshot={snapshot} t={t} />

      {/* trust in Rex */}
      <Tile x={right} y={336} w={rw} h={150} t={t} title={reality ? 'AI copilot trust' : 'Trust in Rex'} />
      <g transform={`translate(${right + 52},${336 + 96})`}>
        <RexIcon reality={reality} />
      </g>
      <text x={right + 100} y={336 + 84} fontSize={23} fill={t.text}>
        {trust1}
      </text>
      <text x={right + 100} y={336 + 120} fontSize={23} fill={t.text}>
        {trust2}
      </text>

      {/* patient impact: always real */}
      <Tile x={right} y={504} w={rw} h={150} t={t} title="Patient impact" tag="always real" />
      {IMPACT_TYPES.map((type, i) => {
        const value = Math.floor(snapshot.impact[type]);
        const cw = rw / 4;
        const x = right + i * cw;
        return (
          <g key={type}>
            <g transform={`translate(${x + 40},${504 + 78})`}>
              <ImpactIcon type={type} />
            </g>
            <text x={x + 70} y={504 + 92} fontSize={38} fontWeight={800} fill={value > 0 ? '#f2994a' : t.text}>
              {value}
            </text>
            {IMPACT_LABELS[type].split(' ').map((word, j) => (
              <text key={j} x={x + 24} y={504 + 118 + j * 21} fontSize={18} fill={t.sub}>
                {word}
              </text>
            ))}
          </g>
        );
      })}

      {/* footer */}
      {role === 'presenter' ? (
        <AnotherNight t={t} />
      ) : (
        <text x={CARD_W - 56} y={CARD_H - 50} textAnchor="end" fontSize={20} fill={t.sub}>
          Next night: the presenter starts it
        </text>
      )}
    </g>
  );
}
