// The briefing: after the screens have powered on, every screen introduces what it shows, big enough to
// read from the back of the room. The intro waits here (the clock stands still) until the presenter
// presses Enter; then the briefings fade and the radio check starts the night. Enter twice skips it all.
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { onBriefing, ACTION_REAL, type ActionKind, type ScreenId } from '@night-shift/shared';
import { useGame, sendIntent } from '../net/game';
import { useRealityWave } from '../reality/useRealityWave';
import { GuardArt, IntruderArt } from '../building/Characters';
import { ExhibitArt, VaultDoor } from '../building/Exhibit';
import type { ExhibitKind } from '../building/layout';
import { RexArt, CopilotArt } from '../desk/Rex';
import { ActionIcon } from '../desk/ActionPopup';
import { Analyst, Ransomware } from '../reality/RealityBuilding';
import { ACTION_LABEL } from '../game/view';

const W = 1600;
const H = 900;

/** The two voices of the briefing: the museum and the SOC. */
interface Voice {
  real: boolean;
  font: string;
  text: string;
  sub: string;
  accent: string;
  shade: string;
}
const MUSEUM: Voice = { real: false, font: 'game-text', text: '#fff1cf', sub: '#a99ce6', accent: '#ffd27a', shade: '#0a0720' };
const REALITY: Voice = { real: true, font: 'soc-text', text: '#e6edf7', sub: '#7f8ea8', accent: '#3ee0d8', shade: '#050b16' };

/** Lines of text, centred on x, with a dark outline so they stay readable over the screen behind. */
function Lines({ x, y, lines, size, v, color, weight = 600, gap = 1.28 }: { x: number; y: number; lines: string[]; size: number; v: Voice; color?: string; weight?: number; gap?: number }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fontSize={size}
      fontWeight={weight}
      fill={color ?? v.text}
      stroke={v.shade}
      strokeWidth={size * 0.16}
      strokeLinejoin="round"
      paintOrder="stroke"
    >
      {lines.map((line, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : size * gap}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

/** Comes in softly, one after the other. */
function Rise({ i = 0, children }: { i?: number; children: ReactNode }) {
  return (
    <g className="briefing-rise" style={{ animationDelay: `${150 + i * 180}ms` }}>
      {children}
    </g>
  );
}

/** A soft pool of light behind a character. */
function Glow({ x, y, r, color, uid }: { x: number; y: number; r: number; color: string; uid: string }) {
  return (
    <>
      <defs>
        <radialGradient id={`${uid}-${x}-${y}`}>
          <stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle cx={x} cy={y} r={r} fill={`url(#${uid}-${x}-${y})`} />
    </>
  );
}

function Title({ text, v }: { text: string; v: Voice }) {
  return <Lines x={W / 2} y={84} lines={[text]} size={58} weight={700} v={v} color={v.accent} />;
}

// ---------- Screen 2: the desk ----------

const GUARDS = [
  { id: 'sam', name: 'Sam', x: 230 },
  { id: 'mia', name: 'Mia', x: 480 },
  { id: 'tom', name: 'Tom', x: 730 },
];
const FLOW: ActionKind[] = ['patrol', 'lock', 'evict', 'repair'];

function DeskBriefing({ v, uid, presenter }: { v: Voice; uid: string; presenter: boolean }) {
  // Short labels, so the five fit in one row ("Restore from backup" → "Restore").
  const label = (a: ActionKind) => (v.real ? (a === 'repair' ? 'Restore' : ACTION_REAL[a]) : a === 'lock' ? 'Lock' : ACTION_LABEL[a]);
  const step = v.real ? 290 : 250;
  const x0 = v.real ? 210 : 260;
  return (
    <>
      <Title text={v.real ? "Tonight's SOC team" : "Tonight's team"} v={v} />
      <Glow x={480} y={300} r={330} color={v.accent} uid={uid} />
      <Glow x={1250} y={300} r={300} color={v.real ? '#c9a6ff' : '#ffd27a'} uid={uid} />
      {GUARDS.map((g, i) => (
        <Rise key={g.id} i={i}>
          {v.real ? (
            <g transform={`translate(${g.x},300) scale(2)`}>
              <Analyst x={0} y={46} name={g.name} initial={g.name[0]} act={null} />
            </g>
          ) : (
            <>
              <g transform={`translate(${g.x},385) scale(2.2)`}>
                <GuardArt id={g.id} raised={i === 1} walking={false} facing={i === 2 ? -1 : 1} />
              </g>
              <Lines x={g.x} y={446} lines={[g.name]} size={40} weight={700} v={v} color={v.accent} />
            </>
          )}
        </Rise>
      ))}
      <Rise i={3}>
        <Lines
          x={480}
          y={515}
          size={v.real ? 34 : 38}
          v={v}
          lines={v.real ? ['SOC analysts. Dispatch them to investigate,', 'isolate systems and eradicate threats.'] : ['Your guards. Send them to patrol,', 'lock doors and catch intruders.']}
        />
      </Rise>
      <Rise i={4}>
        {v.real ? (
          <g transform="translate(1250,300) scale(1.3)">
            <CopilotArt alert />
          </g>
        ) : (
          <g transform="translate(1270,372) scale(1.15)">
            <RexArt alert />
          </g>
        )}
        <Lines
          x={1250}
          y={v.real ? 515 : 446}
          size={v.real ? 34 : 36}
          v={v}
          lines={
            v.real
              ? ['AI copilot. Points you to likely threats…', "but it's not always right."]
              : ['Rex, our AI sniffer dog.', 'He points you to danger…', "but he's not always right."]
          }
        />
      </Rise>
      {/* the four steps, left to right, and candlelight beside them */}
      <Rise i={5}>
        <rect x={70} y={640} width={1460} height={180} rx={v.real ? 16 : 36} fill={v.real ? '#0d1729' : '#17123a'} stroke={v.real ? '#2f4a73' : '#f2c65e'} strokeOpacity={0.7} strokeWidth={4} />
        {FLOW.map((a, i) => {
          const x = x0 + i * step;
          return (
            <g key={a}>
              <g transform={`translate(${x},708) scale(2)`}>
                <ActionIcon action={a} />
              </g>
              <Lines x={x} y={792} lines={[label(a)]} size={v.real ? 28 : 34} weight={700} v={v} />
              {i < FLOW.length - 1 && (
                <path d={`M${x + step / 2 - 26} 708 h44 m-14 -14 l14 14 l-14 14`} fill="none" stroke={v.accent} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
              )}
            </g>
          );
        })}
        <line x1={x0 + 3 * step + step * 0.62} y1={668} x2={x0 + 3 * step + step * 0.62} y2={800} stroke={v.sub} strokeWidth={3} strokeDasharray="8 10" />
        <g transform={`translate(${v.real ? 1370 : 1360},708) scale(2)`}>
          <ActionIcon action="candlelight" />
        </g>
        <Lines x={v.real ? 1370 : 1360} y={792} lines={[label('candlelight')]} size={v.real ? 28 : 34} weight={700} v={v} />
      </Rise>
      <StartHint v={v} presenter={presenter} />
    </>
  );
}

/** "Enter: start the night". On the presenter's page it is also a button (touch). */
function StartHint({ v, presenter }: { v: Voice; presenter: boolean }) {
  const text = v.real ? 'Enter ▸ begin the shift' : 'Enter ▸ start the night';
  if (!presenter) return <Lines x={W / 2} y={872} lines={[text]} size={28} v={v} color={v.sub} />;
  return (
    <g style={{ cursor: 'pointer', pointerEvents: 'auto' }} onClick={() => sendIntent({ type: 'nextIntro' })}>
      <rect x={W / 2 - 220} y={834} width={440} height={56} rx={28} fill={v.real ? '#0f2e2c' : '#f2c65e'} stroke={v.accent} strokeWidth={3} />
      <Lines x={W / 2} y={872} lines={[text]} size={28} weight={700} v={v} color={v.real ? '#b8ffe2' : '#2a1d5c'} />
    </g>
  );
}

// ---------- Screen 1: the lobby (the gang) ----------

function LobbyBriefing({ v, uid }: { v: Voice; uid: string }) {
  return (
    <>
      <Title text={v.real ? 'Ransomware' : 'The intruders'} v={v} />
      <defs>
        <linearGradient id={`${uid}-beam`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor={v.real ? '#3ee0d8' : '#ffd27a'} stopOpacity={0.55} />
          <stop offset="100%" stopColor={v.real ? '#3ee0d8' : '#ffd27a'} stopOpacity={0.05} />
        </linearGradient>
      </defs>
      <Rise i={0}>
        {v.real ? (
          <>
            <path d="M330 330 L1000 190 L1000 560 Z" fill={`url(#${uid}-beam)`} />
            <g transform="translate(270,340) scale(2.2)">
              <Analyst x={0} y={46} name="Sam" initial="S" act={null} />
            </g>
          </>
        ) : (
          <>
            <path d="M338 330 L1000 200 L1000 600 Z" fill={`url(#${uid}-beam)`} />
            <g transform="translate(260,560) scale(2.4)">
              <GuardArt id="sam" raised walking={false} facing={1} />
            </g>
          </>
        )}
      </Rise>
      <Rise i={1}>
        <g transform={v.real ? 'translate(820,400) scale(2.1)' : 'translate(820,560) scale(2.5)'}>
          {v.real ? <Ransomware x={0} y={34} detected /> : <IntruderArt spotted />}
        </g>
      </Rise>
      {/* the rest of them, out in the dark: hardly there at all */}
      <Rise i={2}>
        {[1120, 1420].map((x) => (
          <g key={x} transform={v.real ? `translate(${x},400) scale(1.9)` : `translate(${x},560) scale(2.3)`} opacity={0.22}>
            {v.real ? <Ransomware x={0} y={34} detected={false} /> : <IntruderArt spotted={false} />}
          </g>
        ))}
      </Rise>
      <Rise i={3}>
        <Lines
          x={W / 2}
          y={690}
          size={42}
          v={v}
          lines={
            v.real
              ? ['Ransomware. It gets in through phishing email', 'and hides on the network. You only see it', 'when an analyst runs an EDR scan.']
              : ['Intruders. They sneak in through the mail', 'and hide in the dark. You only see them', 'when a guard shines a light.']
          }
        />
      </Rise>
    </>
  );
}

// ---------- Screens 3 and 4: the wings ----------

interface Gallery {
  name: string;
  real: string;
  systems: [string, string];
  exhibits: [ExhibitKind, ExhibitKind];
}

const WEST: Gallery[] = [
  { name: 'Lab Gallery', real: 'Laboratory', systems: ['Laboratory information system', 'Blood analyser'], exhibits: ['microscopes', 'clockwork'] },
  { name: 'Pharmacy Gallery', real: 'Pharmacy', systems: ['Pharmacy dispensing system', 'Drug fridge monitor'], exhibits: ['apothecary', 'scales'] },
];
const EAST: Gallery[] = [
  { name: 'Emergency Hall', real: 'Emergency department', systems: ['ED triage and tracking', 'Ambulance pre-alert'], exhibits: ['clock', 'beacons'] },
  { name: 'Ward 4 Hall', real: 'Ward 4', systems: ['Infusion pumps', 'Bedside monitoring'], exhibits: ['musicbox', 'lanterns'] },
  { name: 'Radiology Gallery', real: 'Radiology', systems: ['Imaging archive (PACS)', 'CT scanner'], exhibits: ['theatre', 'lens'] },
];

function WingBriefing({ v, uid, west }: { v: Voice; uid: string; west: boolean }) {
  const galleries = west ? WEST : EAST;
  const cardW = west ? 660 : 470;
  const gapX = west ? 80 : 30;
  const left = (W - (galleries.length * cardW + (galleries.length - 1) * gapX)) / 2;
  const scale = west ? 0.72 : 0.56;
  const offset = west ? 165 : 112;
  return (
    <>
      <Title text={west ? (v.real ? 'West wing: clinical support' : 'West Wing') : v.real ? 'East wing: acute care' : 'East Wing'} v={v} />
      {galleries.map((g, i) => {
        const x = left + i * (cardW + gapX);
        const cx = x + cardW / 2;
        return (
          <Rise key={g.name} i={i}>
            {v.real ? (
              <>
                <rect x={x} y={160} width={cardW} height={420} rx={16} fill="#0d1729" stroke="#2f4a73" strokeWidth={4} />
                <rect x={x} y={160} width={cardW} height={8} rx={4} fill={v.accent} />
                <Lines x={cx} y={240} lines={[g.real]} size={40} weight={700} v={v} />
                {g.systems.map((s, k) => (
                  <g key={s}>
                    <rect x={x + 30} y={300 + k * 120} width={cardW - 60} height={92} rx={12} fill="#101a2c" stroke="#2a3a58" strokeWidth={3} />
                    <circle cx={x + 64} cy={346 + k * 120} r={10} fill={v.accent} />
                    <text x={x + 90} y={356 + k * 120} className="soc-mono" fontSize={west ? 28 : 24} fill={v.text}>
                      {s}
                    </text>
                  </g>
                ))}
              </>
            ) : (
              <>
                <Glow x={cx} y={400} r={cardW * 0.62} color="#ffd27a" uid={uid} />
                <rect x={x} y={160} width={cardW} height={420} rx={36} fill="#241c55" fillOpacity={0.7} stroke="#f2c65e" strokeOpacity={0.6} strokeWidth={4} />
                <Lines x={cx} y={228} lines={[g.name]} size={40} weight={700} v={v} color={v.accent} />
                <Lines x={cx} y={266} lines={[g.real]} size={24} weight={500} v={v} color={v.sub} />
                {g.exhibits.map((kind, k) => (
                  <g key={kind} transform={`translate(${cx + (k === 0 ? -offset : offset)},440) scale(${scale})`}>
                    <ExhibitArt kind={kind} />
                  </g>
                ))}
              </>
            )}
          </Rise>
        );
      })}
      <Rise i={galleries.length}>
        <Lines
          x={W / 2}
          y={712}
          size={64}
          weight={700}
          v={v}
          lines={[west ? (v.real ? 'Laboratory and Pharmacy.' : 'Lab and Pharmacy.') : v.real ? 'Emergency, Ward 4 and Radiology.' : 'Emergency, Ward 4 and Radiology.']}
        />
        <Lines
          x={W / 2}
          y={790}
          size={34}
          v={v}
          color={v.sub}
          lines={[v.real ? 'Clinical systems the hospital needs tonight.' : 'Their exhibits keep the patients cared for.']}
        />
      </Rise>
    </>
  );
}

// ---------- Screen 5: the Vault and the goal ----------

function CareDial({ x, y, v }: { x: number; y: number; v: Voice }) {
  const r = 150;
  const point = (p: number) => {
    const a = Math.PI + (p / 100) * Math.PI;
    return `${x + Math.cos(a) * r} ${y + Math.sin(a) * r}`;
  };
  const band = (from: number, to: number, color: string) => <path d={`M${point(from)} A${r} ${r} 0 0 1 ${point(to)}`} fill="none" stroke={color} strokeWidth={30} />;
  if (v.real) {
    return (
      <g>
        <circle cx={x} cy={y} r={r} fill="#0d1729" stroke="#2f4a73" strokeWidth={6} />
        <circle cx={x} cy={y} r={r} fill="none" stroke={v.accent} strokeWidth={18} />
        <text x={x} y={y + 30} textAnchor="middle" fontSize={96} fontWeight={700} fill={v.accent}>
          100%
        </text>
      </g>
    );
  }
  return (
    <g>
      <path d={`M${x - r - 30} ${y + 18} A${r + 30} ${r + 30} 0 0 1 ${x + r + 30} ${y + 18} Z`} fill="#6b4a2c" />
      <path d={`M${x - r - 16} ${y + 8} A${r + 16} ${r + 16} 0 0 1 ${x + r + 16} ${y + 8} Z`} fill="#fff4e0" stroke="#f2c65e" strokeWidth={10} />
      {band(0, 50, '#ff6b6b')}
      {band(50, 75, '#f2994a')}
      {band(75, 100, '#3ee0d8')}
      <g transform={`rotate(84 ${x} ${y})`}>
        <rect x={x - 7} y={y - r + 10} width={14} height={r - 10} rx={7} fill="#2a1d5c" />
      </g>
      <circle cx={x} cy={y} r={18} fill="#f2c65e" stroke="#c9913c" strokeWidth={5} />
      <rect x={x - 150} y={y + 40} width={300} height={84} rx={18} fill="#2a1d5c" stroke="#f2c65e" strokeWidth={5} />
      <text x={x - 124} y={y + 96} fontSize={30} fontWeight={600} fill="#e8e0ff">
        CARE
      </text>
      <text x={x + 124} y={y + 104} textAnchor="end" fontSize={66} fontWeight={700} fill="#3ee0d8">
        100
      </text>
    </g>
  );
}

function Database({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <circle r={210} fill="#3ee0d8" opacity={0.08} />
      {[90, 10, -70].map((dy) => (
        <g key={dy}>
          <path d={`M-130 ${dy - 50} V${dy + 30} A130 40 0 0 0 130 ${dy + 30} V${dy - 50}`} fill="#16243d" stroke="#3ee0d8" strokeWidth={5} />
        </g>
      ))}
      <ellipse cx={0} cy={-120} rx={130} ry={40} fill="#1d3150" stroke="#3ee0d8" strokeWidth={5} />
      <circle cx={92} cy={4} r={8} fill="#3ee0d8" />
      <circle cx={92} cy={84} r={8} fill="#3ee0d8" />
      {/* the shield: what we protect */}
      <path d="M0 -60 L56 -40 V0 Q56 44 0 70 Q-56 44 -56 0 V-40 Z" fill="#0d1729" stroke="#f2c65e" strokeWidth={5} />
      <path d="M-22 4 L-6 20 L24 -14" fill="none" stroke="#f2c65e" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

function VaultBriefing({ v }: { v: Voice }) {
  return (
    <>
      <Title text={v.real ? 'Your goal' : 'Your goal'} v={v} />
      <Rise i={0}>
        {v.real ? (
          <Database x={430} y={360} />
        ) : (
          <g transform="translate(430,350) scale(0.92)">
            <VaultDoor />
          </g>
        )}
        <Lines x={430} y={612} lines={[v.real ? 'Patient records database' : 'The Vault']} size={40} weight={700} v={v} color={v.accent} />
      </Rise>
      <Rise i={1}>
        <CareDial x={1170} y={v.real ? 340 : 400} v={v} />
        <Lines x={1170} y={612} lines={[v.real ? 'Clinical service availability' : 'Care Score']} size={40} weight={700} v={v} color={v.accent} />
      </Rise>
      <Rise i={2}>
        <Lines
          x={W / 2}
          y={v.real ? 700 : 708}
          size={v.real ? 36 : 40}
          v={v}
          lines={
            v.real
              ? [
                  'Keep clinical services running until the incident window ends.',
                  'Protect the patient records database.',
                  'Clinical service availability shows how well the hospital is doing.',
                ]
              : ['Keep the exhibits running until dawn. Protect the Vault.', 'Your Care Score shows how well the hospital is doing.']
          }
        />
      </Rise>
    </>
  );
}

// ---------- The overlay ----------

/**
 * One screen's briefing, over the screen itself (still faintly visible behind). The same component sits on
 * /screen/x, in /preview, and over the monitors and the desk in /wall. Drawn in one 1600×900 SVG, so it
 * scales cleanly from a wall screen down to a small monitor. Follows Lights on (the reality voice).
 */
export function BriefingOverlay({ id }: { id: ScreenId }) {
  const { snapshot, role } = useGame();
  const { shown: real } = useRealityWave(id);
  const uid = `brief-${useId().replace(/:/g, '')}`;
  const on = !!snapshot && onBriefing(snapshot);
  // After Enter the briefing stays a moment longer, fading out, while the radio check begins.
  const [leaving, setLeaving] = useState(false);
  const wasOn = useRef(on);
  useEffect(() => {
    if (wasOn.current && !on) {
      setLeaving(true);
      const t = window.setTimeout(() => setLeaving(false), FADE_OUT_MS);
      wasOn.current = on;
      return () => window.clearTimeout(t);
    }
    wasOn.current = on;
    if (on) setLeaving(false);
  }, [on]);
  // A reset during the briefing clears it at once (a fresh night is black again).
  if (!on && (!leaving || snapshot?.phase === 'idle')) return null;
  const v = real ? REALITY : MUSEUM;
  return (
    <div
      data-intro="briefing"
      className={`pointer-events-none absolute inset-0 z-30 ${on ? 'briefing-in' : 'briefing-out'}`}
    >
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className={`h-full w-full ${v.font}`}>
        <rect x={-2000} y={-2000} width={W + 4000} height={H + 4000} fill={v.shade} opacity={0.8} />
        {/* keyed on the voice: Lights on brings the other one in softly */}
        <g key={v.real ? 'real' : 'museum'}>
          {id === 2 && <DeskBriefing v={v} uid={uid} presenter={role === 'presenter' && on} />}
          {id === 1 && <LobbyBriefing v={v} uid={uid} />}
          {id === 3 && <WingBriefing v={v} uid={uid} west />}
          {id === 4 && <WingBriefing v={v} uid={uid} west={false} />}
          {id === 5 && <VaultBriefing v={v} />}
        </g>
      </svg>
    </div>
  );
}

const FADE_OUT_MS = 800;
