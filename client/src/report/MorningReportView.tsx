// The morning report on screen: the head guard's note on paper (museum view), or the SOC shift handover
// (reality view). Typed out like a typewriter when it arrives; whole after a refresh. Sized in container
// units, so it fits full screen on screen 2 and inside the /wall office alike.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
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

interface Shown {
  /** The typed part. */
  text: string;
  /** The part still to come: laid out but invisible, so nothing moves while it types (and the fit is right from the start). */
  rest: string;
  caret: boolean;
}

/** Splits a list of strings so that only `budget` characters show; the last visible one gets the caret. */
function reveal(parts: string[], budget: number): Shown[] {
  const total = parts.reduce((n, p) => n + p.length, 0);
  let left = budget;
  let caretGiven = false;
  return parts.map((p) => {
    const n = Math.max(0, Math.min(p.length, left));
    left -= p.length;
    const partial = n < p.length;
    const caret = !caretGiven && (partial || left <= 0) && budget > 0 && budget < total;
    if (caret) caretGiven = true;
    return { text: p.slice(0, n), rest: p.slice(n), caret };
  });
}

/** A typed string: what has been typed, the caret, and the rest held invisible in its place. */
function Typed({ s }: { s: Shown }) {
  return (
    <>
      {s.text}
      {s.caret && <Caret />}
      {s.rest && <span className="invisible">{s.rest}</span>}
    </>
  );
}

/** Smallest font scale. Only a safety net: the prompt and the template keep the text well above it, and nothing is ever clipped. */
const MIN_FIT = 0.4;
const FIT_STEP = 0.93;

/**
 * Shrinks the type until the report fits its box: the box and every element in it marked data-fit must not
 * overflow. Starts again at full size whenever the report, the voice or the box size changes. Never cuts text.
 */
function useFit(ref: RefObject<HTMLDivElement | null>, key: string): CSSProperties {
  const [fit, setFit] = useState(1);
  const [size, setSize] = useState('');
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize(`${Math.round(e.contentRect.width)}x${Math.round(e.contentRect.height)}`));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  useLayoutEffect(() => setFit(1), [key, size]);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const boxes = [el, ...el.querySelectorAll<HTMLElement>('[data-fit]')];
    const over = boxes.some((b) => b.scrollHeight > b.clientHeight + 1);
    if (over && fit > MIN_FIT) setFit((f) => Math.max(MIN_FIT, f * FIT_STEP));
  });
  return { '--fit': fit } as CSSProperties;
}

/** A font size that shrinks with the fit. */
const fsz = (size: string) => `calc(${size} * var(--fit, 1))`;

function Caret() {
  return <span className="caret ml-[0.05em] inline-block h-[0.95em] w-[0.08em] translate-y-[0.12em] bg-current" />;
}

/** "Written by AI · Claude Haiku 5.5", only when Claude really wrote it. A template report carries no tag. */
function SourceTag({ report, reality }: { report: MorningReport; reality: boolean }) {
  if (report.source !== 'ai') return null;
  const label = `Written by AI · ${report.model === 'claude-haiku-5-5' ? 'Claude Haiku 5.5' : report.model}`;
  return (
    <span
      className={`inline-flex items-center gap-[0.5em] rounded-full px-[0.8em] py-[0.25em] font-semibold ${
        reality ? 'bg-[#3ee0d8]/15 text-[#3ee0d8] ring-1 ring-[#3ee0d8]/50' : 'bg-[#9c86f5]/20 text-[#5b4ba8]'
      }`}
      style={{ fontSize: 'max(12px, 1.7cqh)' }}
    >
      ✦ {label}
    </span>
  );
}

const TIPS_HEADING = 'Tips for tomorrow night';
const LESSONS_HEADING = 'Lessons learned';

/** The head guard's note: cream paper, a strip of tape, tips for tomorrow, a signature. */
function MuseumNote({ report, live }: { report: MorningReport; live: boolean }) {
  const tips = report.lessons?.museum ?? [];
  const parts = [report.museum.title, ...report.museum.paragraphs, ...(tips.length ? [TIPS_HEADING, ...tips] : []), '— Chief'];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const shown = reveal(parts, useTyped(report, live, total));
  const [title, ...rest] = shown;
  const sign = rest.pop()!;
  const paragraphs = rest.slice(0, report.museum.paragraphs.length);
  const [tipsHeading, ...tipLines] = rest.slice(report.museum.paragraphs.length);
  const box = useRef<HTMLDivElement>(null);
  const fit = useFit(box, `museum-${report.key}`);
  return (
    <div className="game-text relative h-full w-full rotate-[-0.8deg] rounded-[1.2cqh] bg-[#fff6e3] px-[5%] py-[3.4%] text-[#3a2a5c] shadow-[0_1.2cqh_3cqh_rgba(0,0,0,0.45)]">
      {/* ruled lines and a strip of tape */}
      <div className="pointer-events-none absolute inset-y-0 left-[3.2%] w-[2px] bg-[#ff9fb0]/50" />
      <div className="absolute -top-[2.2cqh] left-1/2 h-[4.4cqh] w-[18%] -translate-x-1/2 rotate-[2deg] bg-[#f3e3c3]/90 shadow-sm" />
      <div ref={box} className="relative flex h-full flex-col" style={fit}>
        <div className="flex items-baseline justify-between gap-[2cqw]">
          <h2 className="font-bold leading-tight" style={{ fontSize: fsz('max(22px, 5.2cqh)') }}>
            <Typed s={title} />
          </h2>
          <span className="shrink-0 font-semibold text-[#9c86f5]" style={{ fontSize: fsz('max(13px, 2cqh)') }}>
            Morning note
          </span>
        </div>
        <div className="mt-[1.8cqh] flex flex-col gap-[1.3cqh]" style={{ fontSize: fsz('max(16px, 3cqh)'), lineHeight: 1.34 }}>
          {paragraphs.map((p, i) => (
            <p key={i}>
              <Typed s={p} />
            </p>
          ))}
        </div>
        {tipsHeading && (
          // A sticky note pinned under the letter: advice about tonight's own decisions.
          <div className={`mt-[1.8cqh] rounded-[1cqh] bg-[#fff0b3] px-[2.4%] py-[1.2cqh] shadow-[0_0.4cqh_1cqh_rgba(90,60,20,0.18)] ${tipsHeading.text ? '' : 'invisible'}`}>
            <h3 className="font-bold text-[#9a6a10]" style={{ fontSize: fsz('max(15px, 2.6cqh)') }}>
              ★ <Typed s={tipsHeading} />
            </h3>
            <ul className="mt-[0.6cqh] flex flex-col gap-[0.5cqh]" style={{ fontSize: fsz('max(15px, 2.7cqh)'), lineHeight: 1.3 }}>
              {tipLines.map((l, i) => (
                <li key={i} className="flex gap-[0.5em]">
                  <span className={`text-[#e0a02a] ${l.text ? '' : 'invisible'}`}>›</span>
                  <span>
                    <Typed s={l} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-auto flex items-end justify-between pt-[1cqh]">
          <SourceTag report={report} reality={false} />
          <span className="ml-auto font-bold text-[#5b4ba8]" style={{ fontSize: fsz('max(18px, 3.6cqh)') }}>
            <Typed s={sign} />
          </span>
        </div>
      </div>
    </div>
  );
}

/** The SOC shift handover: six sections in two columns, lessons learned across the bottom. */
function SocHandover({ report, live, endedAt }: { report: MorningReport; live: boolean; endedAt: string }) {
  const sections = SOC_SECTIONS.map(([k, heading]) => ({ heading, lines: report.soc[k] }));
  const lessons = report.lessons?.soc ?? [];
  const parts = [...sections.flatMap((s) => [s.heading, ...s.lines]), ...(lessons.length ? [LESSONS_HEADING, ...lessons] : [])];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const shown = reveal(parts, useTyped(report, live, total));
  let i = 0;
  const blocks = sections.map((s) => ({ heading: shown[i++], lines: s.lines.map(() => shown[i++]) }));
  const learned = lessons.length ? { heading: shown[i++], lines: lessons.map(() => shown[i++]) } : null;
  const box = useRef<HTMLDivElement>(null);
  const fit = useFit(box, `soc-${report.key}`);
  return (
    <div ref={box} style={fit} className="soc-text flex h-full w-full flex-col rounded-[1cqh] bg-[#0b1424] px-[3.5%] py-[2.6%] text-[#e6edf7] ring-2 ring-[#2f4a73]">
      <div className="flex items-baseline justify-between gap-[2cqw] border-b border-[#24395c] pb-[1.4cqh]">
        <h2 className="font-bold tracking-wide" style={{ fontSize: fsz('max(18px, 3.6cqh)') }}>
          SOC shift handover
        </h2>
        <span className="soc-mono text-[#8494ad]" style={{ fontSize: fsz('max(12px, 1.9cqh)') }}>
          NIGHT SHIFT SOC · incident window 00:00–{endedAt}
        </span>
      </div>
      <div data-fit className="mt-[1.6cqh] grid min-h-0 flex-1 grid-cols-2 gap-x-[4%] gap-y-[1.8cqh]" style={{ gridAutoFlow: 'column', gridTemplateRows: 'repeat(3, auto)', alignContent: 'start' }}>
        {blocks.map((b, n) => (
          <section key={n}>
            <h3 className="font-bold uppercase text-[#3ee0d8]" style={{ fontSize: fsz('max(12px, 2cqh)'), letterSpacing: '0.12em' }}>
              <Typed s={b.heading} />
            </h3>
            <ul className="mt-[0.6cqh] flex flex-col gap-[0.5cqh]" style={{ fontSize: fsz('max(14px, 2.4cqh)'), lineHeight: 1.3 }}>
              {b.lines.map((l, j) => (
                <li key={j} className="flex gap-[0.5em]">
                  <span className={`text-[#3ee0d8] ${l.text ? '' : 'invisible'}`}>›</span>
                  <span>
                    <Typed s={l} />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {learned && (
        <section className={`mt-[1.2cqh] rounded-[0.8cqh] bg-[#c9a6ff]/10 px-[2%] py-[1cqh] ring-1 ring-[#c9a6ff]/40 ${learned.heading.text ? '' : 'invisible'}`}>
          <h3 className="font-bold uppercase text-[#c9a6ff]" style={{ fontSize: fsz('max(12px, 2cqh)'), letterSpacing: '0.12em' }}>
            <Typed s={learned.heading} />
          </h3>
          <ul className="mt-[0.5cqh] flex flex-col gap-[0.4cqh]" style={{ fontSize: fsz('max(14px, 2.4cqh)'), lineHeight: 1.3 }}>
            {learned.lines.map((l, j) => (
              <li key={j} className="flex gap-[0.5em]">
                <span className={`text-[#c9a6ff] ${l.text ? '' : 'invisible'}`}>›</span>
                <span>
                  <Typed s={l} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {report.source === 'ai' && (
        <div className="mt-[1.2cqh]">
          <SourceTag report={report} reality />
        </div>
      )}
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

