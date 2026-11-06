// "Safe or phishing?": a letter dropped into the Mail Room and a nurse asks if it is safe to open.
// Look at the sender, the subject and the link, then say Safe or Phishing before time runs out.
// Reality view: the same letter as an email under review (headers, SPF, link preview).
import { AnimatePresence, motion } from 'motion/react';
import type { PhishingLetter, Snapshot } from '@night-shift/shared';
import { useRef } from 'react';
import { sendIntent, useGame } from '../net/game';
import { PresenterCursor, useMirrorPointer } from '../desk/PresenterCursor';
import { worldOf } from '../game/view';
import { MiniHeader } from './MiniHeader';

const W = 1600;

/** Break a text into lines of at most `max` characters, at spaces. */
function wrap(text: string, max: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line && (line + ' ' + word).length > max) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

type Answer = 'safe' | 'phishing';

// the two answer buttons along the bottom
const BUTTON_Y = 735;
const BUTTON_W = 420;
const BUTTON_H = 120;
const BUTTONS: { a: Answer; x: number }[] = [
  { a: 'safe', x: 330 },
  { a: 'phishing', x: 850 },
];

export function LetterGame({ reality }: { reality: boolean }) {
  const { snapshot, role, pointer } = useGame();
  const svg = useRef<SVGSVGElement>(null);
  const mirror = useMirrorPointer(svg);
  const l = snapshot?.letter;
  if (!snapshot || !l) return null;
  const watching = role === 'watcher';
  // watching: the button under the presenter's cursor lights up as it arrives
  const cur = watching ? pointer?.cursor : null;
  const pointed: Answer | null = cur && cur.y >= BUTTON_Y && cur.y <= BUTTON_Y + BUTTON_H ? (BUTTONS.find((b) => cur.x >= b.x && cur.x <= b.x + BUTTON_W)?.a ?? null) : null;
  const w = worldOf(snapshot);
  const letter = w.sc.phishing.letters[l.index];
  const canAct = role !== 'watcher' && l.result === null;
  const answer = (a: Answer) => {
    if (canAct) sendIntent({ type: 'letter', answer: a });
  };

  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${W} 900`}
      preserveAspectRatio="xMidYMid meet"
      className="block h-full w-full select-none"
      style={{ touchAction: 'none' }}
      onPointerDown={mirror.press}
      onPointerMove={mirror.track}
      onPointerLeave={mirror.leave}
      role="application"
      aria-label="Safe or phishing?"
    >
      <rect width={W} height={900} fill={reality ? '#0a1120' : '#2a1d5c'} />
      {reality ? <EmailView letter={letter} /> : <PaperView letter={letter} />}
      <Stamp snapshot={snapshot} reality={reality} />
      {l.result === null ? (
        <Buttons reality={reality} canAct={canAct} onAnswer={answer} watching={watching} pointed={pointed} />
      ) : (
        <Verdict snapshot={snapshot} reality={reality} />
      )}
      <MiniHeader
        title={reality ? 'Phishing triage' : 'Safe or phishing?'}
        sub={reality ? `Reported by ${w.sc.phishing.asker}: release or quarantine?` : `${w.sc.phishing.asker} asks: "Is this letter safe to open?"`}
        snapshot={snapshot}
        startedMs={l.startedMs}
        endsMs={l.result === null ? l.endsMs : snapshot.timeMs}
        limitMs={w.ms.letter}
        done={l.answer ? 1 : 0}
        total={1}
        flash={false}
        reality={reality}
        canAct={role !== 'watcher'}
      />
      {watching && <PresenterCursor pointer={pointer} />}
    </svg>
  );
}

// ---------- museum view: a letter on paper ----------
function PaperView({ letter }: { letter: PhishingLetter }) {
  const body = wrap(letter.body, 56);
  return (
    <g className="game-text" pointerEvents="none">
      {/* the envelope behind */}
      <g transform="translate(800,420) rotate(-4)">
        <rect x={-520} y={-270} width={1040} height={560} rx={18} fill="#c9913c" />
        <path d="M-520 -270 L0 30 L520 -270" fill="none" stroke="#a87530" strokeWidth={6} />
      </g>
      {/* the letter */}
      <g transform="translate(800,430) rotate(1.5)">
        <rect x={-480} y={-280} width={960} height={560} rx={14} fill="#fff6e4" stroke="#e8d3a8" strokeWidth={4} />
        <text x={-430} y={-220} fontSize={22} fill="#7a6a8a">From</text>
        <text x={-360} y={-220} fontSize={28} fontWeight={800} fill="#2a1d5c">{letter.from}</text>
        <text x={-360} y={-186} fontSize={22} fill="#5b4ba8">{letter.address}</text>
        <text x={-430} y={-130} fontSize={34} fontWeight={800} fill="#2a1d5c">{letter.subject}</text>
        <line x1={-430} x2={430} y1={-108} y2={-108} stroke="#e8d3a8" strokeWidth={3} />
        {body.map((line, i) => (
          <text key={i} x={-430} y={-60 + i * 40} fontSize={28} fill="#3a2a4a">{line}</text>
        ))}
        {letter.link && letter.linkText && (
          <g transform={`translate(-430,${-60 + body.length * 40 + 30})`}>
            <rect width={420} height={58} rx={29} fill="#3a7bd5" />
            <text x={210} y={38} textAnchor="middle" fontSize={26} fontWeight={800} fill="#ffffff">{letter.linkText}</text>
            <text x={0} y={92} fontSize={20} fill="#7a6a8a">{letter.link}</text>
          </g>
        )}
      </g>
    </g>
  );
}

// ---------- reality view: an email under review ----------
function EmailView({ letter }: { letter: PhishingLetter }) {
  const body = wrap(letter.body, 70);
  const host = letter.link ? letter.link.replace(/^https?:\/\//, '').split(/[/?]/)[0] : null;
  const rows: [string, string, boolean][] = [
    ['From', `${letter.from} <${letter.address}>`, false],
    ['Reply-To', letter.replyTo, letter.replyTo !== letter.address],
    ['To', 'ward4.nurses@stmarys.nhs.uk', false],
    ['Subject', letter.subject, false],
    ['Authentication', `spf=${letter.spf} · dkim=${letter.spf === 'pass' ? 'pass' : 'none'}`, letter.spf === 'fail'],
  ];
  return (
    <g className="soc-text" pointerEvents="none">
      <rect x={160} y={140} width={1280} height={560} rx={12} fill="#0d1729" stroke="#2f4a73" strokeWidth={3} />
      {rows.map(([k, v, odd], i) => (
        <g key={k} transform={`translate(200,${190 + i * 42})`}>
          <text fontSize={22} fill="#7f8ea8">{k}</text>
          <text x={190} fontSize={24} className="soc-mono" fill={odd ? '#f2994a' : '#e6edf7'}>{v}</text>
        </g>
      ))}
      <line x1={200} x2={1400} y1={402} y2={402} stroke="#2f4a73" strokeWidth={2} />
      {body.map((line, i) => (
        <text key={i} x={200} y={446 + i * 36} fontSize={26} fill="#cfe0f5">{line}</text>
      ))}
      {letter.link && host ? (
        <g transform={`translate(200,${446 + body.length * 36 + 20})`}>
          <rect width={1200} height={84} rx={8} fill="#13233d" stroke="#3a5680" strokeWidth={2} />
          <text x={24} y={34} fontSize={20} fill="#7f8ea8">Link preview · "{letter.linkText}" points to</text>
          <text x={24} y={66} fontSize={24} className="soc-mono" fill="#e6edf7">{letter.link}</text>
        </g>
      ) : (
        <text x={200} y={446 + body.length * 36 + 40} fontSize={22} fill="#7f8ea8">No links · no attachments</text>
      )}
    </g>
  );
}

// ---------- the two buttons ----------
function Buttons({ reality, canAct, watching, onAnswer, pointed }: { reality: boolean; canAct: boolean; watching: boolean; onAnswer: (a: Answer) => void; pointed: Answer | null }) {
  const button = (a: Answer, x: number) => {
    const safe = a === 'safe';
    const color = safe ? '#3ee0d8' : '#f2994a';
    const label = reality ? (safe ? 'Release' : 'Report phishing') : safe ? 'Safe' : 'Phishing!';
    const lit = pointed === a;
    return (
      <g
        transform={`translate(${x},${BUTTON_Y})`}
        style={{ cursor: canAct ? 'pointer' : 'default', transition: 'opacity 150ms ease' }}
        opacity={canAct || lit ? 1 : 0.55}
        onPointerDown={(e) => {
          e.preventDefault();
          onAnswer(a);
        }}
      >
        <rect x={-10} y={-10} width={BUTTON_W + 20} height={BUTTON_H + 20} rx={reality ? 18 : 70} fill="none" stroke={color} strokeWidth={6} opacity={lit ? 0.45 : 0} style={{ transition: 'opacity 150ms ease' }} />
        <rect width={BUTTON_W} height={BUTTON_H} rx={reality ? 12 : 60} fill={reality ? '#0d1729' : '#17123a'} stroke={color} strokeWidth={6} />
        {/* icon: a tick, or a fish hook */}
        <g transform="translate(78,60)" fill="none" stroke={color} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round">
          {safe ? <path d="M-24 0 L-6 18 L26 -18" /> : <path d="M8 -30 L8 10 A16 16 0 0 1 -24 10 L-24 2 M-24 2 L-14 10" />}
        </g>
        <text x={reality ? 262 : 250} y={reality ? 72 : 76} textAnchor="middle" className={reality ? 'soc-text' : 'game-text'} fontSize={reality ? 31 : 46} fontWeight={800} fill={color}>
          {label}
        </text>
      </g>
    );
  };
  return (
    <g>
      {BUTTONS.map((b) => (
        <g key={b.a}>{button(b.a, b.x)}</g>
      ))}
      {watching && (
        <text x={800} y={880} textAnchor="middle" className={reality ? 'soc-text' : 'game-text'} fontSize={20} fill="#b9adf0" pointerEvents="none">
          Watching
        </text>
      )}
    </g>
  );
}

// ---------- the answer: a stamp on the letter, a star burst when right ----------
function Stamp({ snapshot, reality }: { snapshot: Snapshot; reality: boolean }) {
  const l = snapshot.letter!;
  const shown = l.result !== null;
  const right = l.result === 'right';
  const text = !shown
    ? ''
    : l.result === 'missed'
      ? reality ? 'OPENED' : 'OPENED!'
      : l.answer === 'phishing'
        ? reality ? 'QUARANTINED' : 'PHISHING'
        : reality ? 'RELEASED' : 'SAFE';
  const color = right ? (reality ? '#3ee0d8' : '#2fae6a') : '#f2994a';
  // an empty corner: bottom right of the paper letter, top right of the email (beside the headers)
  const [sx, sy] = reality ? [1210, 290] : [1030, 610];
  return (
    <AnimatePresence>
      {shown && (
        <motion.g key="stamp" initial={{ scale: 2.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }} style={{ originX: `${sx}px`, originY: `${sy}px` }} pointerEvents="none">
          <g transform={`translate(${sx},${sy}) rotate(-12)`} className={reality ? 'soc-text' : 'game-text'}>
            <rect x={-200} y={-56} width={400} height={112} rx={reality ? 8 : 20} fill="none" stroke={color} strokeWidth={9} />
            <text y={22} textAnchor="middle" fontSize={reality ? 46 : 58} fontWeight={900} fill={color} letterSpacing={4}>
              {text}
            </text>
          </g>
          {right && (
            <motion.g initial={{ scale: 0.4, opacity: 1 }} animate={{ scale: 1.8, opacity: 0 }} transition={{ duration: 0.9, delay: 0.15 }} style={{ originX: `${sx}px`, originY: `${sy}px` }}>
              {Array.from({ length: 10 }, (_, i) => (
                <path key={i} d="M0 -60 L6 -42 L0 -38 L-6 -42 Z" fill={reality ? '#3ee0d8' : '#ffd27a'} transform={`translate(${sx},${sy}) rotate(${i * 36}) translate(0,-90)`} />
              ))}
            </motion.g>
          )}
        </motion.g>
      )}
    </AnimatePresence>
  );
}

/** Where the buttons were: what the answer meant. */
function Verdict({ snapshot, reality }: { snapshot: Snapshot; reality: boolean }) {
  const l = snapshot.letter!;
  const w = worldOf(snapshot);
  const letter = w.sc.phishing.letters[l.index];
  const right = l.result === 'right';
  const room = l.breach ? w.sc.rooms.find((r) => r.id === l.breach)! : null;
  let title: string;
  let sub: string;
  if (right) {
    title = letter.phishing ? (reality ? 'Phishing reported' : 'Good catch!') : reality ? 'Email released' : 'Safe to open!';
    sub = letter.phishing
      ? reality ? 'Email quarantined, sender domain blocked.' : 'The fake letter goes straight in the bin.'
      : reality ? 'Legitimate sender, verified.' : `A real letter from ${letter.from}.`;
  } else {
    title = l.result === 'missed' ? (reality ? 'No triage in time' : 'Too slow!') : reality ? 'Wrong call' : 'Oh no!';
    sub = room
      ? reality ? `Payload executed: new ransomware foothold on ${room.real}.` : `A new intruder slipped in through the ${room.name}.`
      : reality ? 'Payload blocked: entry points isolated.' : 'But the locked doors kept them out.';
  }
  const color = right ? (reality ? '#3ee0d8' : '#ffd27a') : '#f2994a';
  return (
    <g className={`${reality ? 'soc-text' : 'game-text'} fade-up`} pointerEvents="none">
      <rect x={300} y={730} width={1000} height={130} rx={reality ? 12 : 40} fill={reality ? '#0b1424' : '#17123a'} stroke={color} strokeWidth={5} />
      <text x={800} y={786} textAnchor="middle" fontSize={44} fontWeight={800} fill={color}>{title}</text>
      <text x={800} y={834} textAnchor="middle" fontSize={26} fill={reality ? '#e6edf7' : '#fff1cf'}>{sub}</text>
    </g>
  );
}
