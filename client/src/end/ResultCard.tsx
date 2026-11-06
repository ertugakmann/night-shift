// The result card at the end of the night: the night's care score with its "Why?" and the player's record, MTTD and MTTR, the
// trust analysis for Rex, and the patient impact. Drawn in SVG (1200×760 units, origin top-left) so it
// sits on screen 5 and over the /wall office alike. Museum and SOC styles share the layout.
import { IMPACT_LABELS, IMPACT_TYPES, pointsText, type Outcome, type Snapshot, TIME_LABELS, whyLines } from '@night-shift/shared';
import { motion } from 'motion/react';
import { ImpactIcon } from '../building/VaultExtras';
import { sendIntent, useGame } from '../net/game';
import { durations, headline, trustLines } from './text';
import { BannerSvg } from '../brand/Banner';

export const CARD_W = 1200;
/** The scores take the top BODY_H; the MoSAIcSOC banner sits in a row of its own under them. */
const BODY_H = 760;
const BANNER_ROW = 88;
export const CARD_H = BODY_H + BANNER_ROW;

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
  return v >= 75 ? '#3ee0d8' : v >= 50 ? '#f2994a' : '#ff6b6b';
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

/** The night's care score as a big ring, the player's own record, and the "Why?" behind it. */
function CareBlock({ snapshot, outcome, t, reality }: { snapshot: Snapshot; outcome: Outcome; t: Theme; reality: boolean }) {
  const value = outcome.summary.careContinuity;
  const cx = 250;
  const cy = 262;
  const r = 104;
  const circ = 2 * Math.PI * r;
  const color = careColor(value);
  const { best, previous } = snapshot.record;
  const fresh = best !== null && best === value && (previous === null || value > previous);
  const why = whyLines(outcome.summary.factors, snapshot.scenarioId, 4);
  const top = 492;
  const row = 44;
  const fit = (text: string) => (text.length > 36 ? `${text.slice(0, 35)}…` : text);
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={t.tile} strokeWidth={24} />
      <motion.circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={24}
        strokeLinecap="round"
        strokeDasharray={circ}
        transform={`rotate(-90 ${cx} ${cy})`}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ * (1 - value / 100) }}
        transition={{ duration: 1.6, ease: 'easeOut', delay: 0.3 }}
      />
      <text x={cx} y={cy + 24} textAnchor="middle" fontSize={72} fontWeight={800} fill={t.text}>
        {value}
        <tspan fontSize={36}>%</tspan>
      </text>
      <text x={cx} y={404} textAnchor="middle" fontSize={30} fontWeight={700} fill={t.text}>
        Care score
      </text>
      <text x={cx} y={430} textAnchor="middle" fontSize={18} fill={t.sub}>
        {reality ? 'clinical service availability, night average' : 'exhibits kept running, all night'}
      </text>
      {/* the player's own record */}
      {fresh ? (
        <motion.text
          x={cx}
          y={466}
          textAnchor="middle"
          fontSize={24}
          fontWeight={800}
          fill={t.accent}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 12, delay: 0.8 }}
          style={{ transformOrigin: `${cx}px 458px` }}
        >
          ★ New record!{previous !== null ? ` (was ${previous}%)` : ''}
        </motion.text>
      ) : (
        <text x={cx} y={466} textAnchor="middle" fontSize={22} fill={t.text}>
          Your best: {best ?? value}%
        </text>
      )}

      {/* Why? What moved the score most */}
      <Tile x={40} y={top - 10} w={420} h={258} t={t} title="Why?" tag={reality ? 'score drivers' : 'what moved it most'} />
      {why.length === 0 && (
        <text x={64} y={top + 76} fontSize={19} fill={t.sub}>
          {reality ? 'No significant service loss.' : 'Nothing dented it. Lovely.'}
        </text>
      )}
      {why.map((line, i) => (
        <g key={i}>
          <text x={64} y={top + 70 + i * row} fontSize={18} fill={t.text}>
            {fit((reality ? line.soc : line.game).replace(/^The /, ''))}
          </text>
          <text x={440} y={top + 70 + i * row} textAnchor="end" fontSize={22} fontWeight={800} fill={line.points < 0 ? '#f2994a' : '#3ee0d8'}>
            {pointsText(line.points)}
          </text>
        </g>
      ))}
    </g>
  );
}

/** MTTD or MTTR: the average over the groups it applies to, and how many of the gang's groups that was. */
function TimeTile({ x, label, tag, ms, missing, count, instant, snapshot, t }: { x: number; label: string; tag?: string; ms: number | null; missing: string; count: string; instant: string; snapshot: Snapshot; t: Theme }) {
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

/** The letters of the night: how many were called right, and what the wrong ones cost. */
function PhishingLine({ snapshot, t, reality, x }: { snapshot: Snapshot; t: Theme; reality: boolean; x: number }) {
  const { right, wrong, missed } = snapshot.stats.letters;
  const total = right + wrong + missed;
  const main = total === 0 ? (reality ? 'No phishing reported' : 'No letters tonight') : reality ? `Phishing triage ${right}/${total}` : `Letters: ${right} of ${total} right`;
  const bad = wrong + missed;
  const detail =
    total === 0
      ? ''
      : bad === 0
        ? reality ? 'every email triaged correctly' : 'every letter called right'
        : [wrong > 0 && (reality ? `${wrong} wrong call${wrong > 1 ? 's' : ''}` : `${wrong} wrong`), missed > 0 && (reality ? `${missed} not triaged` : `${missed} not checked`)].filter(Boolean).join(' · ');
  return (
    <g>
      {/* an envelope */}
      <g transform={`translate(${x + 30},${BODY_H - 62})`}>
        <rect x={-26} y={-18} width={52} height={36} rx={reality ? 3 : 6} fill="none" stroke={bad > 0 ? '#f2994a' : t.accent} strokeWidth={4} />
        <path d="M-26 -18 L0 4 L26 -18" fill="none" stroke={bad > 0 ? '#f2994a' : t.accent} strokeWidth={4} strokeLinejoin="round" />
      </g>
      <text x={x + 74} y={BODY_H - 64} fontSize={24} fontWeight={800} fill={t.text}>
        {main}
      </text>
      <text x={x + 74} y={BODY_H - 38} fontSize={18} fill={bad > 0 ? '#f2994a' : t.sub}>
        {detail}
      </text>
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
      <rect x={CARD_W - 330} y={BODY_H - 92} width={290} height={64} rx={32} fill={t.accent} />
      <text x={CARD_W - 185} y={BODY_H - 50} textAnchor="middle" fontSize={28} fontWeight={800} fill={t.card}>
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

      <CareBlock snapshot={snapshot} outcome={outcome} t={t} reality={reality} />

      {/* detect and respond */}
      <TimeTile x={right} label={reality ? 'MTTD' : TIME_LABELS.detect.museum} tag={reality ? '(mean time to detect)' : undefined} ms={s.mttdMs} missing="Never spotted" instant={reality ? 'Immediate' : 'At once'} count={`${s.spotted} of ${s.groups} ${reality ? 'detected' : 'spotted'}`} snapshot={snapshot} t={t} />
      <TimeTile x={right + 340} label={reality ? 'MTTR' : TIME_LABELS.respond.museum} tag={reality ? '(mean time to respond)' : undefined} ms={s.mttrMs} missing="Never stopped" instant={reality ? 'Immediate' : 'At once'} count={`${s.stopped} of ${s.groups} ${reality ? 'contained' : 'stopped'}`} snapshot={snapshot} t={t} />

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

      {/* safe or phishing? the letter calls */}
      <PhishingLine snapshot={snapshot} t={t} reality={reality} x={right} />

      {/* footer */}
      {role === 'presenter' ? (
        <AnotherNight t={t} />
      ) : (
        <text x={CARD_W - 56} y={BODY_H - 50} textAnchor="end" fontSize={20} fill={t.sub}>
          Next night: the presenter starts it
        </text>
      )}

      {/* the project banner, under the scores */}
      <line x1={56} x2={CARD_W - 56} y1={BODY_H - 4} y2={BODY_H - 4} stroke={t.sub} strokeOpacity={0.25} strokeWidth={2} />
      {/* small on purpose (440×49 card units, about 530 px on a 1080p screen): well under its own 1300×145, so it stays sharp */}
      <BannerSvg x={(CARD_W - 440) / 2} y={BODY_H + 12} width={440} height={49} />
    </g>
  );
}
