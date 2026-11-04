/**
 * How NIGHT SHIFT plugs into a modular SOC: what goes in, what comes out. Drawn along the bottom of the
 * screen in the reality view, in plan units (x0 is the left edge of the screen's 1600-unit slice).
 */
export function RealityStrip({ x0, y = 826 }: { x0: number; y?: number }) {
  const inputs = ['SOC alerts', 'Staff reports', 'Network data'];
  const outputs = ['Containment actions', 'AI trust insight', 'Shift handover report'];
  const chip = (x: number, label: string, w: number) => (
    <g key={label}>
      <rect x={x} y={y + 16} width={w} height={36} rx={18} fill="#13233d" stroke="#2f4a73" strokeWidth={2} />
      <text x={x + w / 2} y={y + 40} textAnchor="middle" fontSize={17} fontWeight={600} fill="#cfe0f5">
        {label}
      </text>
    </g>
  );
  const arrow = (x: number) => (
    <g key={`a${x}`}>
      <line x1={x} y1={y + 34} x2={x + 34} y2={y + 34} stroke="#3ee0d8" strokeWidth={4} strokeDasharray="6 6" className="march" />
      <path d={`M${x + 32} ${y + 26} L${x + 44} ${y + 34} L${x + 32} ${y + 42}`} fill="none" stroke="#3ee0d8" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
  const x = x0 + 16;
  return (
    <g className="soc-text" pointerEvents="none">
      <rect x={x} y={y} width={1568} height={68} rx={14} fill="#0a1424" fillOpacity={0.94} stroke="#2a3a58" strokeWidth={2} />
      <text x={x + 18} y={y + 42} fontSize={16} fontWeight={700} fill="#7f8ea8" letterSpacing={2}>
        INPUT
      </text>
      {chip(x + 82, inputs[0], 128)}
      {chip(x + 218, inputs[1], 142)}
      {chip(x + 368, inputs[2], 144)}
      {arrow(x + 522)}
      <rect x={x + 578} y={y + 10} width={238} height={48} rx={12} fill="#3ee0d8" />
      <text x={x + 697} y={y + 42} textAnchor="middle" fontSize={22} fontWeight={800} fill="#04212a" letterSpacing={1.5}>
        NIGHT SHIFT
      </text>
      {arrow(x + 828)}
      <text x={x + 884} y={y + 42} fontSize={16} fontWeight={700} fill="#7f8ea8" letterSpacing={2}>
        OUTPUT
      </text>
      {chip(x + 966, outputs[0], 196)}
      {chip(x + 1170, outputs[1], 160)}
      {chip(x + 1338, outputs[2], 214)}
    </g>
  );
}
