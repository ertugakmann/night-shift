// "Catch the intruders": Evict as a mini game. The guard's lantern lights the room up close; the gang
// (berets) hides among innocent night visitors. Click every intruder before time runs out; a wrong click
// costs seconds. In the reality view the same scene is a live-response process list: end the malicious
// processes, leave the clinical ones alone. The server owns the game, so every screen watches it live.
import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { theRoom, type Catch, type CatchFigure, type Snapshot } from '@night-shift/shared';
import { ROOMS } from '../building/layout';
import { Column, ExhibitArt, Frame, exhibitBox } from '../building/Exhibit';
import { IntruderArt } from '../building/Characters';
import { worldOf } from '../game/view';
import { sendIntent, useGame } from '../net/game';

const W = 1600;
const H = 900;
const INK = '#2a1d5c';

const ROPE_Y = 600;

/** The grid spots nobody stands on: the room's exhibits go there. */
function freeSpots(c: Catch): { x: number; y: number }[] {
  const used = new Set(c.figures.map((f) => `${Math.round((f.x - 0.17) / 0.33)},${Math.round((f.y - 0.24) / 0.27)}`));
  const spots: { x: number; y: number }[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) if (!used.has(`${col},${row}`)) spots.push({ x: 0.17 + col * 0.33, y: 0.24 + row * 0.27 });
  }
  return spots;
}

/** Scene position of a figure's feet. */
function at(f: CatchFigure): { x: number; y: number } {
  return { x: 140 + ((f.x - 0.11) / 0.78) * 1320, y: 330 + ((f.y - 0.2) / 0.62) * 500 };
}

/** The flashlight: radius of the lit circle, in scene units. */
const LIGHT_R = 185;
type Pt = { x: number; y: number };

function figureScale(f: CatchFigure): number {
  return 1.55 + (f.y - 0.2) * 0.5; // a little bigger at the front
}

/** Where a figure's body is (for hits and the light), not its feet. */
function figureCenter(f: CatchFigure): Pt {
  const p = at(f);
  return { x: p.x, y: p.y - 0.6 * 70 * figureScale(f) };
}

/** Reality view: the process rows, top to bottom. */
function listRows(c: Catch): { f: CatchFigure; y: number; h: number }[] {
  const rows = [...c.figures].sort((a, b) => processOf(a, c).pid - processOf(b, c).pid);
  const h = Math.min(66, 560 / rows.length);
  return rows.map((f, i) => ({ f, y: 250 + i * h, h }));
}

function secondsLeft(c: Catch, snapshot: Snapshot): number {
  return Math.max(0, (c.endsMs - snapshot.timeMs) / 1000);
}

// ---------- the innocent night visitors ----------

function Cleaner() {
  return (
    <g>
      <ellipse cy={2} rx={30} ry={8} fill="#000" opacity={0.25} />
      {/* mop */}
      <line x1={34} y1={-96} x2={30} y2={0} stroke="#a8714a" strokeWidth={6} strokeLinecap="round" />
      <path d="M18 0 Q30 -14 44 0 Z" fill="#e8e0ff" />
      <rect x={-18} y={-40} width={36} height={40} rx={12} fill="#4f8fb8" />
      <rect x={-10} y={-34} width={20} height={16} rx={4} fill="#3a7aa3" />
      <circle cy={-62} r={26} fill="#f3cfa6" />
      <path d="M-27 -66 Q-26 -92 0 -92 Q26 -92 27 -66 Q14 -76 0 -76 Q-14 -76 -27 -66 Z" fill="#7ad0c0" />
      <circle cx={-9} cy={-60} r={3.5} fill="#2a1d3a" />
      <circle cx={9} cy={-60} r={3.5} fill="#2a1d3a" />
      <path d="M-6 -48 Q0 -44 6 -48" fill="none" stroke="#2a1d3a" strokeWidth={2.5} strokeLinecap="round" />
      {/* bucket */}
      <path d="M-46 -22 H-24 L-27 0 H-43 Z" fill="#ffd27a" />
    </g>
  );
}

function LostNurse() {
  return (
    <g>
      <ellipse cy={2} rx={28} ry={8} fill="#000" opacity={0.25} />
      <rect x={-18} y={-40} width={36} height={40} rx={12} fill="#9fd7ef" />
      <circle cy={-62} r={26} fill="#c98d62" />
      <path d="M-24 -70 Q-20 -90 0 -90 Q20 -90 24 -70 Z" fill="#2a1a2e" />
      <rect x={-16} y={-96} width={32} height={14} rx={4} fill="#ffffff" />
      <rect x={-3} y={-95} width={6} height={12} fill="#3ee0d8" />
      <rect x={-8} y={-92} width={16} height={6} fill="#3ee0d8" />
      <circle cx={-9} cy={-60} r={3.5} fill="#2a1d3a" />
      <circle cx={9} cy={-60} r={3.5} fill="#2a1d3a" />
      {/* lost: a little question mark */}
      <path d="M-4 -48 Q0 -51 4 -48" fill="none" stroke="#2a1d3a" strokeWidth={2.5} strokeLinecap="round" />
      <text x={30} y={-92} fontSize={30} fontWeight={800} fill="#9c86f5" className="game-text">
        ?
      </text>
      {/* clipboard */}
      <rect x={14} y={-34} width={18} height={24} rx={3} fill="#c9913c" />
      <rect x={17} y={-30} width={12} height={16} rx={2} fill="#fff4e0" />
    </g>
  );
}

function Porter() {
  return (
    <g>
      <ellipse cy={2} rx={30} ry={8} fill="#000" opacity={0.25} />
      <rect x={-18} y={-40} width={36} height={40} rx={12} fill="#6fbf73" />
      <rect x={-18} y={-22} width={36} height={6} fill="#4e9a52" />
      <circle cy={-62} r={26} fill="#eab78e" />
      <path d="M-27 -70 Q-26 -94 0 -94 Q26 -94 27 -70 Z" fill="#4e9a52" />
      <rect x={-29} y={-74} width={58} height={8} rx={4} fill="#2f6e33" />
      <ellipse cx={-9} cy={-60} rx={3.5} ry={2} fill="#2a1d3a" />
      <ellipse cx={9} cy={-60} rx={3.5} ry={2} fill="#2a1d3a" />
      <path d="M-7 -47 Q0 -42 7 -47" fill="none" stroke="#2a1d3a" strokeWidth={2.5} strokeLinecap="round" />
      {/* a sleepy "z" */}
      <text x={26} y={-84} fontSize={22} fontWeight={800} fill="#a99ce6" className="game-text">
        z
      </text>
    </g>
  );
}

function Visitor() {
  return (
    <g>
      <ellipse cy={2} rx={28} ry={8} fill="#000" opacity={0.25} />
      <rect x={-18} y={-40} width={36} height={40} rx={12} fill="#f2994a" />
      <circle cy={-62} r={26} fill="#f3cfa6" />
      {/* sun hat, not a beret */}
      <ellipse cy={-80} rx={38} ry={9} fill="#ffe3a0" />
      <path d="M-20 -80 Q-18 -100 0 -100 Q18 -100 20 -80 Z" fill="#ffe3a0" />
      <rect x={-20} y={-84} width={40} height={5} fill="#ff9fb0" />
      <circle cx={-9} cy={-60} r={3.5} fill="#2a1d3a" />
      <circle cx={9} cy={-60} r={3.5} fill="#2a1d3a" />
      <ellipse cy={-47} rx={5} ry={4} fill="#2a1d3a" />
      {/* camera */}
      <rect x={-14} y={-30} width={28} height={18} rx={4} fill="#2a1d5c" />
      <circle cy={-21} r={6} fill="#9fd7ef" />
    </g>
  );
}

const INNOCENTS = [Cleaner, LostNurse, Porter, Visitor];

// ---------- museum scene ----------

function MuseumScene({ c, snapshot, light }: { c: Catch; snapshot: Snapshot; light: Pt }) {
  const layout = ROOMS[c.room];
  const exhibits = Object.values(layout.exhibits).filter((e) => e.kind !== 'lamps');
  const live = c.result === null;
  return (
    <g>
      <defs>
        <pattern id="catch-floor" width={160} height={160} patternUnits="userSpaceOnUse">
          <rect width={160} height={160} fill="#e9d3ad" />
          <rect width={80} height={80} fill="#fbf0dc" />
          <rect x={80} y={80} width={80} height={80} fill="#fbf0dc" />
        </pattern>
        <radialGradient id="catch-lantern" cx="0.5" cy="0.55" r="0.75">
          <stop offset="0.45" stopColor="#ffd27a" stopOpacity={0} />
          <stop offset="1" stopColor="#17123a" stopOpacity={0.6} />
        </radialGradient>
      </defs>
      {/* back wall and floor */}
      <rect width={W} height={H} fill="url(#catch-floor)" />
      <rect width={W} height={250} fill="#3a2f6e" />
      <rect y={244} width={W} height={12} fill="#c9913c" />
      {[0, 1, 2].map((i) => (
        <Frame key={i} x={360 + i * 440} top={110} variant={i + c.id} />
      ))}
      {[90, W - 90].map((x) => (
        <Column key={x} x={x} baseY={250} height={150} />
      ))}
      {/* the room's own exhibits, big, along the back */}
      {exhibits.map((ex, i) => {
        const slot = (i + 1) / (exhibits.length + 1);
        const box = exhibitBox(ex.kind, 1.25);
        return (
          <g key={i} transform={`translate(${140 + slot * 1320},${300 - box.bottom}) scale(1.25)`} opacity={0.95}>
            <ExhibitArt kind={ex.kind} span={ex.span} />
          </g>
        );
      })}
      {/* a velvet rope across the middle of the room */}
      <g pointerEvents="none">
        <path d={`M120 ${ROPE_Y - 40} Q 480 ${ROPE_Y + 10} 800 ${ROPE_Y - 40} T 1480 ${ROPE_Y - 40}`} fill="none" stroke="#b0457a" strokeWidth={9} strokeLinecap="round" />
        {[120, 800, 1480].map((x) => (
          <g key={x} transform={`translate(${x},${ROPE_Y})`}>
            <rect x={-7} y={-48} width={14} height={48} rx={5} fill="#c9913c" />
            <circle cy={-50} r={11} fill="#f2c65e" />
            <ellipse rx={22} ry={7} fill="#c9913c" />
          </g>
        ))}
      </g>
      {/* everyone and the exhibits in the free spots, back to front, so people half-hide behind things */}
      {[
        ...c.figures.map((f) => ({ y: f.y, key: `f${f.id}`, node: <SceneFigure key={`f${f.id}`} f={f} snapshot={snapshot} /> })),
        ...freeSpots(c).map((p, i) => {
          const ex = exhibits[(i + c.id) % Math.max(1, exhibits.length)];
          const pos = at({ ...c.figures[0], x: p.x, y: p.y });
          const box = ex ? exhibitBox(ex.kind, 1.05) : null;
          return {
            y: p.y,
            key: `p${i}`,
            node: ex && box && (
              <g key={`p${i}`} transform={`translate(${pos.x},${pos.y - box.bottom}) scale(1.05)`} pointerEvents="none">
                <ExhibitArt kind={ex.kind} span={ex.span} />
              </g>
            ),
          };
        }),
      ]
        .sort((a, b) => a.y - b.y)
        .map((item) => item.node)}
      <rect width={W} height={H} fill="url(#catch-lantern)" pointerEvents="none" />
      {/* the lights are out: only the flashlight shows who is who */}
      <defs>
        <radialGradient id="catch-hole">
          <stop offset="0.62" stopColor="#000" />
          <stop offset="1" stopColor="#fff" />
        </radialGradient>
        <mask id="catch-dark" maskUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
          <rect width={W} height={H} fill="#fff" />
          <circle cx={light.x} cy={light.y} r={LIGHT_R} fill="url(#catch-hole)" />
        </mask>
      </defs>
      <rect width={W} height={H} fill="#07051a" opacity={live ? 0.985 : 0.6} mask="url(#catch-dark)" pointerEvents="none" style={{ transition: 'opacity 500ms ease' }} />
      <circle cx={light.x} cy={light.y} r={LIGHT_R} fill="none" stroke="#ffd27a" strokeWidth={3} opacity={0.35} pointerEvents="none" />
    </g>
  );
}

function SceneFigure({ f, snapshot }: { f: CatchFigure; snapshot: Snapshot }) {
  const p = at(f);
  const Innocent = INNOCENTS[f.look % INNOCENTS.length];
  const oops = f.oopsAtMs !== null && snapshot.timeMs - f.oopsAtMs < 1200;
  const scale = figureScale(f);
  return (
    <g transform={`translate(${p.x},${p.y})`}>
      <AnimatePresence>
        {!f.caught && (
          <motion.g key="who" initial={false} exit={{ scale: 0, opacity: 0, y: -80 }} transition={{ duration: 0.45, ease: 'easeIn' }}>
            <g transform={`scale(${scale})`} className={f.kind === 'intruder' ? 'sneak' : 'breathe'} style={{ animationDelay: `${-f.id * 0.37}s` }}>
              {f.kind === 'intruder' ? <IntruderArt spotted={false} /> : <Innocent />}
            </g>
          </motion.g>
        )}
      </AnimatePresence>
      {/* caught: a star burst */}
      <AnimatePresence>
        {f.caught && (
          <motion.g key="star" initial={{ scale: 0.3, opacity: 1 }} animate={{ scale: 1.6, opacity: 0 }} transition={{ duration: 0.7 }} pointerEvents="none">
            {Array.from({ length: 8 }, (_, i) => (
              <path key={i} d="M0 -60 L5 -44 L0 -40 L-5 -44 Z" fill="#ffd27a" transform={`rotate(${i * 45}) translate(0,-20)`} />
            ))}
          </motion.g>
        )}
      </AnimatePresence>
      {/* a wrong click: "Hey!" */}
      {oops && (
        <g pointerEvents="none" className="fade-up">
          <rect x={-46} y={-212} width={92} height={46} rx={18} fill="#ffffff" stroke="#f2994a" strokeWidth={4} />
          <text y={-180} textAnchor="middle" className="game-text" fontSize={28} fontWeight={800} fill="#f2994a">
            Hey!
          </text>
        </g>
      )}
    </g>
  );
}

// ---------- reality view: a live-response process list ----------

const BAD = ['svc_upd.exe', 'wincrypt64.exe', 'lsassvc.exe', 'invoice_2024.scr', 'tmp_4421.exe'];
const GOOD: [string, string][] = [
  ['chrome.exe', 'Google LLC'],
  ['outlook.exe', 'Microsoft Corporation'],
  ['pacs_viewer.exe', 'Siemens Healthineers'],
  ['pump_monitor.exe', 'Hospital Clinical IT'],
];

function processOf(f: CatchFigure, c: Catch): { name: string; publisher: string; pid: number; cpu: number } {
  const pid = 1000 + ((f.id * 7919 + c.id * 104729) % 8999);
  if (f.kind === 'intruder') return { name: BAD[f.look % BAD.length], publisher: 'Unknown (unsigned)', pid, cpu: 71 + ((f.id * 13) % 27) };
  const [name, publisher] = GOOD[f.look % GOOD.length];
  return { name, publisher, pid, cpu: 1 + ((f.id * 7) % 9) };
}

function ProcessList({ c, snapshot, light }: { c: Catch; snapshot: Snapshot; light: Pt }) {
  const w = worldOf(snapshot);
  const room = w.room.get(c.room)!;
  const live = c.result === null;
  const rows = listRows(c);
  const x0 = 120;
  const top = 250;
  const rowH = rows[0]?.h ?? 60;
  const band = rowH * 1.7;
  return (
    <g className="soc-text">
      <rect width={W} height={H} fill="#0a1120" />
      <rect x={80} y={150} width={W - 160} height={710} rx={14} fill="#0d1729" stroke="#2f4a73" strokeWidth={3} />
      <text x={x0} y={200} fontSize={26} fontWeight={700} fill="#e6edf7">
        EDR live response · {room.real}
      </text>
      <text x={W - 120} y={200} textAnchor="end" fontSize={18} fill="#7f8ea8">
        End the malicious processes. Leave clinical ones running.
      </text>
      <defs>
        <filter id="catch-blur" x="-5%" y="-20%" width="110%" height="140%">
          <feGaussianBlur stdDeviation={live ? 7 : 0} />
        </filter>
        <clipPath id="catch-band">
          <rect x={0} y={light.y - band / 2} width={W} height={band} />
        </clipPath>
      </defs>
      {['PROCESS', 'PID', 'PUBLISHER', 'CPU', ''].map((h, i) => (
        <text key={h || i} x={[x0 + 20, x0 + 520, x0 + 680, x0 + 1040, x0 + 1200][i]} y={top - 12} fontSize={15} fontWeight={700} fill="#7f8ea8" letterSpacing={1.5}>
          {h}
        </text>
      ))}
      {/* the whole list blurred, and a sharp copy only where the cursor is */}
      <g filter="url(#catch-blur)" opacity={live ? 0.75 : 1}>
        <Rows c={c} snapshot={snapshot} rows={rows} x0={x0} rowH={rowH} />
      </g>
      {live && (
        <g clipPath="url(#catch-band)">
          <rect x={x0 - 10} y={light.y - band / 2} width={W - 2 * x0 + 20} height={band} rx={10} fill="#0d1729" />
          <Rows c={c} snapshot={snapshot} rows={rows} x0={x0} rowH={rowH} />
          <rect x={x0 - 10} y={light.y - band / 2} width={W - 2 * x0 + 20} height={band} rx={10} fill="none" stroke="#3ee0d8" strokeWidth={2} opacity={0.5} />
        </g>
      )}
    </g>
  );
}

function Rows({ c, snapshot, rows, x0, rowH }: { c: Catch; snapshot: Snapshot; rows: { f: CatchFigure; y: number }[]; x0: number; rowH: number }) {
  return (
    <g>
      {rows.map(({ f, y }, i) => {
        const p = processOf(f, c);
        const oops = f.oopsAtMs !== null && snapshot.timeMs - f.oopsAtMs < 1200;
        return (
          <g key={f.id} opacity={f.caught ? 0.45 : 1}>
            <rect x={x0} y={y} width={W - 2 * x0} height={rowH - 8} rx={8} fill={oops ? '#3a1f2a' : i % 2 ? '#101d33' : '#0f1a2e'} stroke={oops ? '#ff6b6b' : 'none'} strokeWidth={2} style={{ transition: 'fill 300ms ease' }} />
            <text x={x0 + 20} y={y + rowH / 2 + 3} fontSize={22} fontWeight={600} fill="#e6edf7" className="soc-mono" textDecoration={f.caught ? 'line-through' : undefined}>
              {p.name}
            </text>
            <text x={x0 + 520} y={y + rowH / 2 + 3} fontSize={20} fill="#8494ad" className="soc-mono">
              {p.pid}
            </text>
            <text x={x0 + 680} y={y + rowH / 2 + 3} fontSize={20} fill={f.kind === 'intruder' ? '#f2994a' : '#8494ad'}>
              {p.publisher}
            </text>
            <text x={x0 + 1040} y={y + rowH / 2 + 3} fontSize={20} fill={p.cpu > 50 ? '#f2994a' : '#8494ad'} className="soc-mono">
              {p.cpu}%
            </text>
            {f.caught ? (
              <text x={x0 + 1200} y={y + rowH / 2 + 3} fontSize={18} fontWeight={700} fill="#3ee0d8">
                TERMINATED
              </text>
            ) : oops ? (
              <text x={x0 + 1200} y={y + rowH / 2 + 3} fontSize={16} fontWeight={700} fill="#ff9a8a">
                DENIED · clinical
              </text>
            ) : (
              <g>
                <rect x={x0 + 1190} y={y + 6} width={150} height={rowH - 20} rx={8} fill="#13233d" stroke="#3a5680" strokeWidth={2} />
                <text x={x0 + 1265} y={y + rowH / 2 + 2} textAnchor="middle" fontSize={17} fontWeight={700} fill="#cfe0f5">
                  End task
                </text>
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}

// ---------- header: title, timer, score ----------

function Header({ c, snapshot, reality, canAct }: { c: Catch; snapshot: Snapshot; reality: boolean; canAct: boolean }) {
  const total = c.figures.filter((f) => f.kind === 'intruder').length;
  const caught = c.figures.filter((f) => f.kind === 'intruder' && f.caught).length;
  const left = c.result === null ? secondsLeft(c, snapshot) : 0;
  const frac = Math.max(0, Math.min(1, left / (worldOf(snapshot).ms.catch / 1000)));
  const color = frac > 0.5 ? '#3ee0d8' : frac > 0.25 ? '#f2994a' : '#ff6b6b';
  const guard = snapshot.guards.find((g) => g.id === c.guard);
  const roomName = worldOf(snapshot).room.get(c.room)!.name;
  // the bar flashes red for a moment after a wrong click
  const lastOops = Math.max(-Infinity, ...c.figures.map((f) => f.oopsAtMs ?? -Infinity));
  const flash = snapshot.timeMs - lastOops < 700;
  return (
    <g className={reality ? 'soc-text' : 'game-text'} pointerEvents="none">
      <rect width={W} height={110} fill={reality ? '#0d1729' : '#17123a'} opacity={0.96} />
      <text x={40} y={66} fontSize={46} fontWeight={800} fill={reality ? '#e6edf7' : '#ffd27a'}>
        {reality ? 'Terminate the ransomware' : 'Catch the intruders!'}
      </text>
      <text x={40} y={96} fontSize={20} fill={reality ? '#8494ad' : '#b9adf0'}>
        {reality ? `Analyst ${guard?.name ?? ''} · live response · hover to inspect a process` : `${theRoom(roomName)} · lights out! Shine ${guard?.name ?? 'the guard'}'s flashlight and tap everyone in a beret`}
        {!canAct && ' · watching'}
      </text>
      {/* caught so far */}
      <g transform="translate(900,72)">
        {Array.from({ length: total }, (_, i) => (
          <g key={i} transform={`translate(${i * 52},0) scale(0.7)`} opacity={i < caught ? 1 : 0.55}>
            {reality ? <rect x={-34} y={-34} width={68} height={68} rx={12} fill={i < caught ? '#3ee0d8' : '#2f4a73'} /> : <IntruderArt spotted={i < caught} />}
          </g>
        ))}
      </g>
      {/* time */}
      <g transform="translate(1260,30)">
        <rect width={300} height={30} rx={15} fill={reality ? '#16243d' : '#2a2263'} stroke={flash ? '#ff6b6b' : 'none'} strokeWidth={4} />
        <rect width={300 * frac} height={30} rx={15} fill={color} style={{ transition: 'width 110ms linear, fill 300ms ease' }} />
        <text x={150} y={62} textAnchor="middle" fontSize={22} fontWeight={700} fill={reality ? '#e6edf7' : '#fff1cf'}>
          {left.toFixed(1)} s
        </text>
        {flash && (
          <text x={-14} y={24} textAnchor="end" fontSize={24} fontWeight={800} fill="#ff6b6b">
            −1.5 s
          </text>
        )}
      </g>
    </g>
  );
}

function Result({ c, snapshot, reality }: { c: Catch; snapshot: Snapshot; reality: boolean }) {
  if (!c.result) return null;
  const w = worldOf(snapshot);
  const where = c.to ? w.room.get(c.to)! : null;
  const text =
    c.result === 'caught'
      ? reality
        ? ['Ransomware terminated', 'Every malicious process ended.']
        : ['Caught them all!', 'Out they go. Nice work.']
      : c.result === 'held'
        ? reality
          ? ['Processes still running', 'Still isolated. Run it again.']
          : ['They are still hiding!', 'The doors are locked. Try Evict again.']
        : reality
          ? ['Ransomware moved', `It spread to ${where?.real ?? 'a neighbour'}.`]
          : ['They slipped away!', `Off into ${where ? where.name : 'the next room'}.`];
  const good = c.result === 'caught';
  return (
    <motion.g initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 16 }} style={{ transformOrigin: '800px 470px' }} className={reality ? 'soc-text' : 'game-text'} pointerEvents="none">
      <rect x={400} y={360} width={800} height={200} rx={36} fill={reality ? '#0b1424' : '#17123a'} opacity={0.95} stroke={good ? (reality ? '#3ee0d8' : '#ffd27a') : '#f2994a'} strokeWidth={6} />
      <text x={800} y={448} textAnchor="middle" fontSize={56} fontWeight={800} fill={good ? (reality ? '#3ee0d8' : '#ffd27a') : '#f2994a'}>
        {text[0]}
      </text>
      <text x={800} y={508} textAnchor="middle" fontSize={28} fill={reality ? '#e6edf7' : '#fff1cf'}>
        {text[1]}
      </text>
    </motion.g>
  );
}

/** How often the flashlight's position goes to the server (for everyone watching). */
const AIM_EVERY_MS = 90;

/**
 * The whole mini game, filling its box (1600×900 units). The room is dark: the flashlight follows the
 * mouse or finger, and a tap only catches someone the light was already on (so tapping blindly in the
 * dark finds nobody). Everyone watching sees the player's light.
 */
export function CatchGame({ reality }: { reality: boolean }) {
  const { snapshot, role } = useGame();
  const svg = useRef<SVGSVGElement>(null);
  const [local, setLocal] = useState<Pt | null>(null);
  const lastSent = useRef(0);
  const c = snapshot?.catch;
  if (!snapshot || !c) return null;
  const canAct = role !== 'watcher';
  const live = c.result === null;
  const light: Pt = (canAct && local) || c.aim || { x: 800, y: reality ? 420 : 560 };

  const toScene = (e: React.PointerEvent): Pt => {
    const m = svg.current?.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };
  const aim = (p: Pt, force = false) => {
    setLocal(p);
    const now = performance.now();
    if (force || now - lastSent.current > AIM_EVERY_MS) {
      lastSent.current = now;
      sendIntent({ type: 'aim', x: Math.round(p.x), y: Math.round(p.y) });
    }
  };
  const lit = (p: Pt) => (reality ? Math.abs(p.y - light.y) <= (listRows(c)[0]?.h ?? 60) * 0.85 : Math.hypot(p.x - light.x, p.y - light.y) < LIGHT_R * 0.85);

  function down(e: React.PointerEvent) {
    if (!canAct || !live) return;
    e.preventDefault();
    const p = toScene(e);
    let target: CatchFigure | undefined;
    if (reality) {
      const row = listRows(c!).find((r) => p.y >= r.y && p.y < r.y + r.h && p.x > 110 && p.x < W - 110);
      if (row && !row.f.caught && lit({ x: p.x, y: row.y + row.h / 2 })) target = row.f;
    } else {
      target = c!.figures
        .filter((f) => !f.caught)
        .map((f) => ({ f, d: Math.hypot(figureCenter(f).x - p.x, figureCenter(f).y - p.y) }))
        .filter(({ f, d }) => d < 85 && lit(figureCenter(f)))
        .sort((a, b) => b.f.y - a.f.y || a.d - b.d)[0]?.f;
    }
    if (target) sendIntent({ type: 'catch', figure: target.id });
    aim(p, true); // a finger moves the light to where it taps
  }

  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      className="block h-full w-full select-none"
      style={{ touchAction: 'none', cursor: canAct && live ? 'crosshair' : 'default' }}
      onPointerDown={down}
      onPointerMove={(e) => canAct && live && aim(toScene(e))}
      role="application"
      aria-label="Catch the intruders"
    >
      {reality ? <ProcessList c={c} snapshot={snapshot} light={light} /> : <MuseumScene c={c} snapshot={snapshot} light={light} />}
      <Header c={c} snapshot={snapshot} reality={reality} canAct={canAct} />
      <Result c={c} snapshot={snapshot} reality={reality} />
    </svg>
  );
}
