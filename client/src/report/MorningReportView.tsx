// The morning report on screen: the head guard's note on paper (museum view), or the SOC shift handover
// (reality view). Typed out like a typewriter when it arrives; whole after a refresh. Sized in container
// units, so it fits full screen on screen 2 and inside the /wall office alike.
import { useEffect, useState } from 'react';
import { SOC_SECTIONS, type MorningReport } from '@night-shift/shared';
import { useGame } from '../net/game';
import { prefersReducedMotion } from '../end/useEndMoment';
import { logClock } from '../game/view';

/** Characters per second for the typewriter. A full report takes about 8–10 s. */
const TYPE_CPS = 95;

/** When typing started for each report, shared by every view on this page so they agree. */
const typingStarted = new Map<string, number>();
/** Reports to show whole at once (the view flipped mid-way, or reduced motion). */
const typedOut = new Set<string>();
/** Which voice each report was first shown in on this page. */
const firstVoice = new Map<string, boolean>();

/** How many characters of this report are visible now. */
function useTyped(report: MorningReport, live: boolean, total: number): number {
  const [now, setNow] = useState(() => performance.now());
  const key = report.key;
  if (!live || prefersReducedMotion()) typedOut.add(key);
  if (!typingStarted.has(key)) typingStarted.set(key, performance.now());


  const done = typedOut.has(key) || ((now - typingStarted.get(key)!) / 1000) * TYPE_CPS >= total;
  useEffect(() => {
    if (done) return;
    let raf = 0;
    const tick = () => {
      setNow(performance.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [done]);
  if (done) return total;
  return Math.floor(((now - typingStarted.get(key)!) / 1000) * TYPE_CPS);
}

/** Cuts a list of strings so that only `budget` characters show; the last visible one gets the caret. */
function reveal(parts: string[], budget: number): { text: string; caret: boolean }[] {
  const total = parts.reduce((n, p) => n + p.length, 0);
  let left = budget;
  let caretGiven = false;
  return parts.map((p) => {
    const n = Math.max(0, Math.min(p.length, left));
    left -= p.length;
    const partial = n < p.length;
    const caret = !caretGiven && (partial || left <= 0) && budget > 0 && budget < total;
    if (caret) caretGiven = true;
    return { text: p.slice(0, n), caret };
  });
}

function Caret() {
  return <span className="caret ml-[0.05em] inline-block h-[0.95em] w-[0.08em] translate-y-[0.12em] bg-current" />;
}

function SourceTag({ report, reality }: { report: MorningReport; reality: boolean }) {
  const ai = report.source === 'ai';
  const label = ai ? `Written by AI · ${report.model === 'claude-haiku-5-5' ? 'Claude Haiku 5.5' : report.model}` : 'Template report · no AI';
  return (
    <span
      className={`inline-flex items-center gap-[0.5em] rounded-full px-[0.8em] py-[0.25em] font-semibold ${
        reality ? (ai ? 'bg-[#3ee0d8]/15 text-[#3ee0d8] ring-1 ring-[#3ee0d8]/50' : 'bg-white/10 text-[#8494ad] ring-1 ring-white/20') : ai ? 'bg-[#9c86f5]/20 text-[#5b4ba8]' : 'bg-[#c9b8a0]/40 text-[#7a6a50]'
      }`}
      style={{ fontSize: 'max(12px, 1.7cqh)' }}
    >
      {ai ? '✦' : '✎'} {label}
    </span>
  );
}

/** The head guard's note: cream paper, a strip of tape, a signature. */
function MuseumNote({ report, live }: { report: MorningReport; live: boolean }) {
  const parts = [report.museum.title, ...report.museum.paragraphs, '— Chief'];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const shown = reveal(parts, useTyped(report, live, total));
  const [title, ...rest] = shown;
  const sign = rest.pop()!;
  return (
    <div className="game-text relative h-full w-full rotate-[-0.8deg] rounded-[1.2cqh] bg-[#fff6e3] px-[5%] py-[4%] text-[#3a2a5c] shadow-[0_1.2cqh_3cqh_rgba(0,0,0,0.45)]">
      {/* ruled lines and a strip of tape */}
      <div className="pointer-events-none absolute inset-y-0 left-[3.2%] w-[2px] bg-[#ff9fb0]/50" />
      <div className="absolute -top-[2.2cqh] left-1/2 h-[4.4cqh] w-[18%] -translate-x-1/2 rotate-[2deg] bg-[#f3e3c3]/90 shadow-sm" />
      <div className="relative flex h-full flex-col">
        <div className="flex items-baseline justify-between gap-[2cqw]">
          <h2 className="font-bold leading-tight" style={{ fontSize: 'max(22px, 5.6cqh)' }}>
            {title.text}
            {title.caret && <Caret />}
          </h2>
          <span className="shrink-0 font-semibold text-[#9c86f5]" style={{ fontSize: 'max(13px, 2cqh)' }}>
            Morning note
          </span>
        </div>
        <div className="mt-[2.5cqh] flex flex-col gap-[1.8cqh]" style={{ fontSize: 'max(16px, 3.4cqh)', lineHeight: 1.38 }}>
          {rest.map((p, i) => (
            <p key={i} className={p.text ? '' : 'invisible'}>
              {p.text || '.'}
              {p.caret && <Caret />}
            </p>
          ))}
        </div>
        <div className="mt-auto flex items-end justify-between">
          <SourceTag report={report} reality={false} />
          <span className="font-bold text-[#5b4ba8]" style={{ fontSize: 'max(18px, 3.6cqh)' }}>
            {sign.text}
            {sign.caret && <Caret />}
          </span>
        </div>
      </div>
    </div>
  );
}

/** The SOC shift handover: six sections in two columns. */
function SocHandover({ report, live, endedAt }: { report: MorningReport; live: boolean; endedAt: string }) {
  const sections = SOC_SECTIONS.map(([k, heading]) => ({ heading, lines: report.soc[k] }));
  const parts = sections.flatMap((s) => [s.heading, ...s.lines]);
  const total = parts.reduce((n, p) => n + p.length, 0);
  const shown = reveal(parts, useTyped(report, live, total));
  let i = 0;
  const blocks = sections.map((s) => ({ heading: shown[i++], lines: s.lines.map(() => shown[i++]) }));
  return (
    <div className="soc-text flex h-full w-full flex-col rounded-[1cqh] bg-[#0b1424] px-[3.5%] py-[3%] text-[#e6edf7] ring-2 ring-[#2f4a73]">
      <div className="flex items-baseline justify-between gap-[2cqw] border-b border-[#24395c] pb-[1.6cqh]">
        <h2 className="font-bold tracking-wide" style={{ fontSize: 'max(18px, 3.6cqh)' }}>
          SOC shift handover
        </h2>
        <span className="soc-mono text-[#8494ad]" style={{ fontSize: 'max(12px, 1.9cqh)' }}>
          NIGHT SHIFT SOC · incident window 00:00–{endedAt}
        </span>
      </div>
      <div className="mt-[2cqh] grid min-h-0 flex-1 overflow-hidden grid-cols-2 gap-x-[4%] gap-y-[2.2cqh]" style={{ gridAutoFlow: 'column', gridTemplateRows: 'repeat(3, auto)', alignContent: 'start' }}>
        {blocks.map((b, n) => (
          <section key={n}>
            <h3 className="font-bold uppercase text-[#3ee0d8]" style={{ fontSize: 'max(12px, 2cqh)', letterSpacing: '0.12em' }}>
              {b.heading.text || ' '}
              {b.heading.caret && <Caret />}
            </h3>
            <ul className="mt-[0.8cqh] flex flex-col gap-[0.6cqh]" style={{ fontSize: 'max(14px, 2.5cqh)', lineHeight: 1.32 }}>
              {b.lines.map((l, j) => (
                <li key={j} className={`flex gap-[0.5em] ${l.text ? '' : 'invisible'}`}>
                  <span className="text-[#3ee0d8]">›</span>
                  <span>
                    {l.text || '.'}
                    {l.caret && <Caret />}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <div className="mt-[1.4cqh]">
        <SourceTag report={report} reality />
      </div>
    </div>
  );
}

/** While the server is still writing: a pen at work. */
function Writing({ reality }: { reality: boolean }) {
  return (
    <div className={`flex h-full w-full items-center justify-center gap-[1em] rounded-[1.2cqh] ${reality ? 'soc-text bg-[#0b1424] text-[#8494ad] ring-2 ring-[#2f4a73]' : 'game-text bg-[#fff6e3] text-[#7a6a50]'}`} style={{ fontSize: 'max(16px, 3cqh)' }}>
      <span className="pen inline-block">{reality ? '⌁' : '✎'}</span>
      {reality ? 'Compiling the shift handover…' : 'The chief is writing the morning note…'}
    </div>
  );
}

/** The report for the night that just ended, in the voice of the current view. Fills its container. */
export function MorningReportView({ reality }: { reality: boolean }) {
  const { report, reportLive, snapshot } = useGame();
  const outcome = snapshot?.outcome;
  const current = report && outcome && report.key === `${outcome.result}-${outcome.atMs}` ? report : null;
  if (!current || !snapshot || !outcome) return <Writing reality={reality} />;
  // Lights on (or off) while it is being typed: the other voice appears at once, complete.
  if (!firstVoice.has(current.key)) firstVoice.set(current.key, reality);
  if (firstVoice.get(current.key) !== reality) typedOut.add(current.key);
  const endedAt = logClock(snapshot, outcome.atMs);
  return reality ? <SocHandover report={current} live={reportLive} endedAt={endedAt} /> : <MuseumNote report={current} live={reportLive} />;
}

