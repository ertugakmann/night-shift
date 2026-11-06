import { useEffect, useRef } from 'react';
import { padlocks, type Snapshot } from '@night-shift/shared';
import { DangerMeter, dangerLevel } from '../game/danger';
import { reportPointer, selectRoom, useGame } from '../net/game';
import { PresenterCursor } from './PresenterCursor';
import { RealityStrip, type StripMode } from '../reality/RealityStrip';
import { ScreenEndWash } from '../end/EndMoment';
import { ActionPopup } from './ActionPopup';
import { Cctv } from './Cctv';
import { GuardCards } from './Guards';
import { MiniMap } from './MiniMap';
import { Radio } from './Radio';
import { Rex } from './Rex';
import { NIST_STAGES, nistStage } from './util';

/** Brass strip with the NIST incident response cycle; the current stage is lit. */
function NistStrip({ snapshot, reality }: { snapshot: Snapshot; reality: boolean }) {
  const current = nistStage(snapshot);
  const x0 = 30;
  const y = 296;
  const labelW = 200;
  const pillW = 172;
  return (
    <g className="game-text">
      <rect x={x0} y={y} width={labelW + NIST_STAGES.length * pillW + 16} height={44} rx={22} fill={reality ? '#0d1729' : '#5a3a22'} stroke={reality ? '#2f4a73' : '#c9913c'} strokeWidth={3} />
      <text x={x0 + 22} y={y + 29} fontSize={17} fontWeight={700} fill={reality ? '#7f8ea8' : '#f2c65e'}>
        NIST RESPONSE
      </text>
      {NIST_STAGES.map((stage, i) => {
        const px = x0 + labelW + i * pillW;
        const state = i === current ? 'now' : i < current ? 'done' : 'next';
        return (
          <g key={stage}>
            <rect
              x={px}
              y={y + 6}
              width={pillW - 8}
              height={32}
              rx={16}
              fill={
                reality
                  ? state === 'now'
                    ? '#3ee0d8'
                    : state === 'done'
                      ? '#1d4a55'
                      : '#13233d'
                  : state === 'now'
                    ? '#ffd27a'
                    : state === 'done'
                      ? '#8a6a3a'
                      : '#3a2a1a'
              }
              style={{ transition: 'fill 500ms ease' }}
            />
            <text x={px + (pillW - 8) / 2} y={y + 29} textAnchor="middle" fontSize={18} fontWeight={state === 'now' ? 700 : 500} fill={state === 'now' ? (reality ? '#04212a' : '#2a1d5c') : state === 'done' ? (reality ? '#cfe0f5' : '#f3e3c3') : reality ? '#7f8ea8' : '#a08a6a'}>
              {stage}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/**
 * The padlocks: at most three rooms can be locked at once. Used ones go dim; unlocking or repairing a
 * room gives its padlock back. Reality view: the SOC's isolation capacity.
 */
function PadlockTray({ snapshot, reality }: { snapshot: Snapshot; reality: boolean }) {
  const { max, used } = padlocks(snapshot);
  const x = 1296;
  const y = 290;
  const w = 274;
  return (
    <g className={reality ? 'soc-text' : 'game-text'} aria-label={`${max - used} of ${max} padlocks free`}>
      <rect x={x} y={y} width={w} height={56} rx={reality ? 12 : 22} fill={reality ? '#0d1729' : '#5a3a22'} stroke={reality ? '#2f4a73' : '#c9913c'} strokeWidth={3} />
      {reality ? (
        <>
          <text x={x + 16} y={y + 24} fontSize={15} fontWeight={700} fill="#7f8ea8" letterSpacing={1}>
            ISOLATION CAPACITY: {max}
          </text>
          <text x={x + 16} y={y + 45} fontSize={15} fill={used === max ? '#ff9a8a' : '#cfe0f5'}>
            {max - used} free
          </text>
          {Array.from({ length: max }, (_, i) => {
            const free = i < max - used;
            return (
              <rect key={i} x={x + 120 + i * 50} y={y + 31} width={40} height={16} rx={4} fill={free ? '#9c86f5' : '#16243d'} stroke={free ? '#c9b8ff' : '#2f4a73'} strokeWidth={2} style={{ transition: 'fill 400ms ease' }} />
            );
          })}
        </>
      ) : (
        <>
          <text x={x + 18} y={y + 35} fontSize={17} fontWeight={700} fill="#f2c65e">
            PADLOCKS
          </text>
          {Array.from({ length: max }, (_, i) => {
            const free = i < max - used;
            return (
              <g key={i} transform={`translate(${x + 146 + i * 44},${y + 28})`} style={{ opacity: free ? 1 : 0.28, transition: 'opacity 400ms ease' }}>
                <path d="M-8 -3 V-10 A8 8 0 0 1 8 -10 V-3" fill="none" stroke={free ? '#e8e0ff' : '#a08a6a'} strokeWidth={4} />
                <rect x={-12} y={-4} width={24} height={19} rx={5} fill={free ? '#9c86f5' : '#8a7a6a'} />
                <circle cy={5} r={3} fill="#2a1d5c" />
              </g>
            );
          })}
        </>
      )}
    </g>
  );
}

/**
 * Right of the map: how many groups of the gang are stopped so far (the total grows as they split),
 * and how close the nearest group is to the Vault.
 */
function StatusColumn({ snapshot, reality }: { snapshot: Snapshot; reality: boolean }) {
  const total = snapshot.groupLog.length;
  const stopped = snapshot.groupLog.filter((r) => r.stoppedMs !== null).length;
  const x = 1456;
  const w = 110;
  return (
    <g className={reality ? 'soc-text' : 'game-text'} pointerEvents="none">
      <rect x={x} y={30} width={w} height={232} rx={12} fill={reality ? '#0d1729' : '#17123a'} stroke={reality ? '#2f4a73' : '#4a3d99'} strokeWidth={3} />
      <text x={x + w / 2} y={54} textAnchor="middle" fontSize={16} fontWeight={800} fill={reality ? '#7f8ea8' : '#f2c65e'} letterSpacing={0.5}>
        {reality ? 'CONTAINED' : 'STOPPED'}
      </text>
      <text x={x + w / 2} y={98} textAnchor="middle" fontSize={40} fontWeight={800} fill={total > 0 && stopped === total ? '#3ee0d8' : reality ? '#e6edf7' : '#fff1cf'}>
        {total === 0 ? '–' : `${stopped}/${total}`}
      </text>
      <text x={x + w / 2} y={120} textAnchor="middle" fontSize={16} fill={reality ? '#7f8ea8' : '#b9adf0'}>
        {reality ? 'threats' : 'intruders'}
      </text>
      <DangerMeter x={x} y={132} w={w} h={124} level={dangerLevel(snapshot)} label={reality ? 'EPR RISK' : 'DANGER'} reality={reality} vertical />
    </g>
  );
}

/** The first 20 seconds of a night: how to play, until the first order. */
function Tip({ snapshot, reality }: { snapshot: Snapshot; reality: boolean }) {
  if (snapshot.phase !== 'running' || snapshot.timeMs >= 20_000 || snapshot.stats.dispatches > 0) return null;
  const text = reality ? 'Tip: select a department to dispatch an analyst.' : 'Tip: click a room to send a guard.';
  const w = text.length * 13 + 60;
  return (
    <g className={`${reality ? 'soc-text' : 'game-text'} note-bob`} pointerEvents="none">
      <rect x={640 - w / 2} y={294} width={w} height={48} rx={24} fill={reality ? '#3ee0d8' : '#ffd27a'} stroke={reality ? '#0d1729' : '#2a1d5c'} strokeWidth={3} />
      <text x={640} y={326} textAnchor="middle" fontSize={24} fontWeight={800} fill={reality ? '#04212a' : '#2a1d5c'}>
        {text}
      </text>
    </g>
  );
}

/** A sticky note for the moments between play: before the shift, paused, and the end of the night. */
function StickyNote({ snapshot }: { snapshot: Snapshot }) {
  let title: string | null = null;
  let sub = '';
  if (snapshot.phase === 'idle') {
    title = 'Shift starts soon';
    sub = 'Presenter: press S';
  } else if (snapshot.phase === 'paused') {
    title = 'Paused';
    sub = 'Space to continue';
  } else if (snapshot.outcome) {
    title = snapshot.outcome.result === 'won' ? 'Night won!' : 'Night lost';
    sub = `Care ${Math.round(snapshot.care)} · R to reset`;
  }
  if (!title) return null;
  // over the CCTV monitor, clear of the padlocks
  const x = 1300;
  const y = 556;
  return (
    <g className="game-text" transform={`rotate(3 ${x + 130} ${y + 40})`} pointerEvents="none">
      <rect x={x + 4} y={y + 6} width={258} height={80} rx={6} fill="#000" opacity={0.25} />
      <rect x={x} y={y} width={258} height={80} rx={6} fill="#ffe98a" />
      <rect x={x + 100} y={y - 8} width={60} height={18} rx={3} fill="#f3e3c3" opacity={0.8} />
      <text x={x + 18} y={y + 38} fontSize={26} fontWeight={700} fill="#2a1d5c">
        {title}
      </text>
      <text x={x + 18} y={y + 66} fontSize={18} fill="#5a4a7a">
        {sub}
      </text>
    </g>
  );
}

/**
 * Screen 2: the head guard's desk, seen from above. Works with mouse, touchpad and touch.
 * `reality`: the same desk as a SOC console (the content shrinks a little to make room for the strip).
 */
export function DeskScreen({ reality = false, strip = 'split' }: { reality?: boolean; strip?: StripMode }) {
  const { snapshot, selected, role, pointer } = useGame();
  const svgRef = useRef<SVGSVGElement>(null);
  const watching = role === 'watcher';

  // The presenter's hand on the desk, in desk units, mirrored to every watching desk.
  function track(e: React.PointerEvent) {
    if (role !== 'presenter') return;
    const m = svgRef.current?.getScreenCTM();
    if (!m) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    reportPointer({ cursor: { x: p.x, y: p.y, touch: e.pointerType === 'touch' } });
  }
  function untrack() {
    if (role === 'presenter') reportPointer({ cursor: null, hover: null });
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') selectRoom(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid meet"
      className="block h-full w-full select-none"
      role="img"
      aria-label="Security desk"
      onPointerMove={track}
      onPointerDown={track}
      onPointerLeave={untrack}
    >
      <defs>
        <pattern id="desk-wood" width={1600} height={90} patternUnits="userSpaceOnUse">
          <rect width={1600} height={90} fill="#5b3a28" />
          <rect width={1600} height={44} fill="#62402c" />
          <path d="M0 44 H1600 M0 89 H1600 M420 0 V44 M1180 0 V44 M760 44 V90 M1460 44 V90" stroke="#4a2f20" strokeWidth={3} />
        </pattern>
        <pattern id="desk-grid" width={40} height={40} patternUnits="userSpaceOnUse">
          <path d="M40 0 L0 0 0 40" fill="none" stroke="#16243d" strokeWidth={1.5} />
        </pattern>
        <radialGradient id="desk-lamp" cx="0.35" cy="0.75" r="0.8">
          <stop offset="0" stopColor="#ffd27a" stopOpacity={0.22} />
          <stop offset="1" stopColor="#0c0922" stopOpacity={0.45} />
        </radialGradient>
      </defs>
      {/* the desk; tapping bare wood closes the menu */}
      {reality ? (
        <>
          <rect width={1600} height={900} fill="#0a1120" onClick={() => selectRoom(null)} />
          <rect width={1600} height={900} fill="url(#desk-grid)" pointerEvents="none" />
        </>
      ) : (
        <>
          <rect width={1600} height={900} fill="url(#desk-wood)" onClick={() => selectRoom(null)} />
          <rect width={1600} height={900} fill="url(#desk-lamp)" pointerEvents="none" />
        </>
      )}
      {snapshot && (
        // watching: the presenter's menu and hover are shown, but nothing here can be clicked
        <g className={reality ? 'soc-text' : undefined} transform={reality && strip !== 'none' ? 'translate(64,0) scale(0.92)' : undefined} pointerEvents={watching ? 'none' : undefined}>
          <MiniMap snapshot={snapshot} selected={selected} reality={reality} role={role} mirroredHover={watching ? (pointer?.hover ?? null) : undefined} />
          <StatusColumn snapshot={snapshot} reality={reality} />
          <NistStrip snapshot={snapshot} reality={reality} />
          <PadlockTray snapshot={snapshot} reality={reality} />
          <Radio snapshot={snapshot} reality={reality} />
          <GuardCards snapshot={snapshot} reality={reality} />
          <Cctv snapshot={snapshot} reality={reality} />
          <Rex snapshot={snapshot} selected={selected} reality={reality} />
          <StickyNote snapshot={snapshot} />
          <Tip snapshot={snapshot} reality={reality} />
          {selected && <ActionPopup snapshot={snapshot} roomId={selected} canAct reality={reality} />}
        </g>
      )}
      {watching && <PresenterCursor pointer={pointer} reality={reality} />}
      <ScreenEndWash screen={2} rect={{ x: 0, y: 0, w: 1600, h: 900 }} reality={reality} />
      {reality && <RealityStrip x0={0} y={832} mode={strip} screen={2} />}
    </svg>
  );
}
