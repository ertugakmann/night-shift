import { useEffect } from 'react';
import type { Snapshot } from '@night-shift/shared';
import { selectRoom, useGame } from '../net/game';
import { ActionPopup } from './ActionPopup';
import { Cctv } from './Cctv';
import { GuardCards } from './Guards';
import { MiniMap } from './MiniMap';
import { Radio } from './Radio';
import { Rex } from './Rex';
import { NIST_STAGES, nistStage } from './util';

/** Brass strip with the NIST incident response cycle; the current stage is lit. */
function NistStrip({ snapshot }: { snapshot: Snapshot }) {
  const current = nistStage(snapshot);
  const x0 = 30;
  const y = 296;
  const labelW = 200;
  const pillW = 172;
  return (
    <g className="game-text">
      <rect x={x0} y={y} width={labelW + NIST_STAGES.length * pillW + 16} height={44} rx={22} fill="#5a3a22" stroke="#c9913c" strokeWidth={3} />
      <text x={x0 + 22} y={y + 29} fontSize={17} fontWeight={700} fill="#f2c65e">
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
              fill={state === 'now' ? '#ffd27a' : state === 'done' ? '#8a6a3a' : '#3a2a1a'}
              style={{ transition: 'fill 500ms ease' }}
            />
            <text x={px + (pillW - 8) / 2} y={y + 29} textAnchor="middle" fontSize={18} fontWeight={state === 'now' ? 700 : 500} fill={state === 'now' ? '#2a1d5c' : state === 'done' ? '#f3e3c3' : '#a08a6a'}>
              {stage}
            </text>
          </g>
        );
      })}
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
  const x = 1312;
  const y = 284;
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

/** Screen 2: the head guard's desk, seen from above. Works with mouse, touchpad and touch. */
export function DeskScreen() {
  const { snapshot, selected, role } = useGame();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') selectRoom(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid meet" className="block h-full w-full select-none" role="img" aria-label="Security desk">
      <defs>
        <pattern id="desk-wood" width={1600} height={90} patternUnits="userSpaceOnUse">
          <rect width={1600} height={90} fill="#5b3a28" />
          <rect width={1600} height={44} fill="#62402c" />
          <path d="M0 44 H1600 M0 89 H1600 M420 0 V44 M1180 0 V44 M760 44 V90 M1460 44 V90" stroke="#4a2f20" strokeWidth={3} />
        </pattern>
        <radialGradient id="desk-lamp" cx="0.35" cy="0.75" r="0.8">
          <stop offset="0" stopColor="#ffd27a" stopOpacity={0.22} />
          <stop offset="1" stopColor="#0c0922" stopOpacity={0.45} />
        </radialGradient>
      </defs>
      {/* the desk; tapping bare wood closes the menu */}
      <rect width={1600} height={900} fill="url(#desk-wood)" onClick={() => selectRoom(null)} />
      <rect width={1600} height={900} fill="url(#desk-lamp)" pointerEvents="none" />
      {snapshot && (
        <>
          <MiniMap snapshot={snapshot} selected={selected} />
          <NistStrip snapshot={snapshot} />
          <Radio snapshot={snapshot} />
          <GuardCards snapshot={snapshot} />
          <Cctv snapshot={snapshot} />
          <Rex snapshot={snapshot} selected={selected} />
          <StickyNote snapshot={snapshot} />
          {selected && <ActionPopup snapshot={snapshot} roomId={selected} canAct={role !== 'watcher'} />}
        </>
      )}
    </svg>
  );
}
