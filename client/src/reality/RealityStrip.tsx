import type { ScreenId } from '@night-shift/shared';
import { useScreenPosition } from '../components/position';

/**
 * How NIGHT SHIFT plugs into a modular SOC: what goes in, what comes out.
 * - 'full': the whole strip on one screen (/preview, /wall).
 * - 'split': the strip runs across the five real-room screens as one line, in the order they stand
 *   (ROOM_ORDER): INPUT on the leftmost, NIGHT SHIFT in the middle, OUTPUT on the rightmost, flow arrows between.
 * Drawn in plan units; x0 is the left edge of the screen's 1600-unit area.
 */
export type StripMode = 'full' | 'split' | 'none';

const INPUTS = ['SOC alerts', 'Staff reports', 'Network data'];
const OUTPUTS = ['Containment actions', 'AI trust insight', 'Shift handover report'];
const H = 68;

function Chip({ x, y, label, w, size = 17 }: { x: number; y: number; label: string; w: number; size?: number }) {
  return (
    <g>
      <rect x={x} y={y + 16} width={w} height={36} rx={18} fill="#13233d" stroke="#2f4a73" strokeWidth={2} />
      <text x={x + w / 2} y={y + 40} textAnchor="middle" fontSize={size} fontWeight={600} fill="#cfe0f5">
        {label}
      </text>
    </g>
  );
}

/** Dashed flow with chevrons, from x1 to x2. */
function Flow({ x1, x2, y }: { x1: number; x2: number; y: number }) {
  const chevrons = [];
  for (let x = x1 + 60; x < x2 - 20; x += 180) chevrons.push(x);
  return (
    <g>
      <line x1={x1} y1={y + 34} x2={x2} y2={y + 34} stroke="#3ee0d8" strokeOpacity={0.8} strokeWidth={4} strokeDasharray="10 10" className="march" />
      {chevrons.map((x) => (
        <path key={x} d={`M${x} ${y + 24} L${x + 12} ${y + 34} L${x} ${y + 44}`} fill="none" stroke="#3ee0d8" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </g>
  );
}

function Label({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <text x={x} y={y + 42} fontSize={16} fontWeight={700} fill="#7f8ea8" letterSpacing={2}>
      {text}
    </text>
  );
}

function Core({ x, y, w = 238, size = 22 }: { x: number; y: number; w?: number; size?: number }) {
  return (
    <g>
      <rect x={x} y={y + 10} width={w} height={48} rx={12} fill="#3ee0d8" />
      <text x={x + w / 2} y={y + 42} textAnchor="middle" fontSize={size} fontWeight={800} fill="#04212a" letterSpacing={1.5}>
        NIGHT SHIFT
      </text>
    </g>
  );
}

function Full({ x0, y }: { x0: number; y: number }) {
  const x = x0 + 16;
  return (
    <g>
      <rect x={x} y={y} width={1568} height={H} rx={14} fill="#0a1424" fillOpacity={0.94} stroke="#2a3a58" strokeWidth={2} />
      <Label x={x + 18} y={y} text="INPUT" />
      <Chip x={x + 82} y={y} label={INPUTS[0]} w={128} />
      <Chip x={x + 218} y={y} label={INPUTS[1]} w={142} />
      <Chip x={x + 368} y={y} label={INPUTS[2]} w={144} />
      <Flow x1={x + 520} x2={x + 570} y={y} />
      <Core x={x + 578} y={y} />
      <Flow x1={x + 822} x2={x + 872} y={y} />
      <Label x={x + 884} y={y} text="OUTPUT" />
      <Chip x={x + 966} y={y} label={OUTPUTS[0]} w={196} />
      <Chip x={x + 1170} y={y} label={OUTPUTS[1]} w={160} />
      <Chip x={x + 1338} y={y} label={OUTPUTS[2]} w={214} />
    </g>
  );
}

/** This screen's piece of the wall-wide strip, by its position (0 = leftmost). Only the outer ends are rounded. */
function Split({ x0, y, position }: { x0: number; y: number; position: number }) {
  const first = position === 0;
  const last = position === 4;
  const left = first ? x0 + 16 : x0;
  const right = last ? x0 + 1584 : x0 + 1600;
  const bar = (
    <rect x={left} y={y} width={right - left} height={H} rx={first || last ? 14 : 0} fill="#0a1424" fillOpacity={0.94} stroke="#2a3a58" strokeWidth={2} />
  );
  switch (position) {
    case 0:
      return (
        <g>
          {bar}
          <Label x={x0 + 40} y={y} text="INPUT" />
          <Chip x={x0 + 130} y={y} label={INPUTS[0]} w={200} size={19} />
          <Chip x={x0 + 346} y={y} label={INPUTS[1]} w={220} size={19} />
          <Chip x={x0 + 582} y={y} label={INPUTS[2]} w={220} size={19} />
          <Flow x1={x0 + 820} x2={x0 + 1600} y={y} />
        </g>
      );
    case 2:
      return (
        <g>
          {bar}
          <Flow x1={x0} x2={x0 + 620} y={y} />
          <Core x={x0 + 630} y={y} w={340} size={28} />
          <Flow x1={x0 + 980} x2={x0 + 1600} y={y} />
        </g>
      );
    case 4:
      return (
        <g>
          {bar}
          <Flow x1={x0} x2={x0 + 300} y={y} />
          <Label x={x0 + 316} y={y} text="OUTPUT" />
          <Chip x={x0 + 410} y={y} label={OUTPUTS[0]} w={250} size={19} />
          <Chip x={x0 + 676} y={y} label={OUTPUTS[1]} w={210} size={19} />
          <Chip x={x0 + 902} y={y} label={OUTPUTS[2]} w={270} size={19} />
        </g>
      );
    default:
      // second and fourth screen: the flow carries on, with a hint of what is moving
      return (
        <g>
          {bar}
          <Flow x1={x0} x2={x0 + 1600} y={y} />
          <rect x={x0 + 560} y={y + 18} width={480} height={32} rx={16} fill="#0a1424" />
          <text x={x0 + 800} y={y + 41} textAnchor="middle" fontSize={17} fontWeight={600} fill="#7f8ea8">
            {position === 1 ? 'alerts · staff reports · network data' : 'containment · trust insight · handover'}
          </text>
        </g>
      );
  }
}

export function RealityStrip({ x0, y = 826, mode, screen }: { x0: number; y?: number; mode: StripMode; screen: ScreenId }) {
  const position = useScreenPosition(screen);
  if (mode === 'none') return null;
  return (
    <g className="soc-text" pointerEvents="none">
      {mode === 'full' ? <Full x0={x0} y={y} /> : <Split x0={x0} y={y} position={position} />}
    </g>
  );
}
