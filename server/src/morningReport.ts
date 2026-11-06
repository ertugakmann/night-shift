// The morning report, written once when the night ends: both voices in one request to Claude, from
// the night's facts. If there is no key, the call fails, or nothing comes back within 8 seconds, the
// template report (same facts) is used instead. The demo never depends on the API, and the key never
// leaves the server: clients only ever receive the finished report.
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { SOC_SECTIONS, nightFacts, reportKey, templateReport, type GameState, type MorningReport } from '@night-shift/shared';

export const REPORT_MODEL = 'claude-haiku-5-5';
export const REPORT_TIMEOUT_MS = 8000;

const Lines = z.array(z.string());
const ReportSchema = z.object({
  museum: z.object({ title: z.string(), paragraphs: z.array(z.string()) }),
  soc: z.object({
    incidentSummary: Lines,
    affectedSystems: Lines,
    actionsTaken: Lines,
    patientImpact: Lines,
    aiCopilotPerformance: Lines,
    nextSteps: Lines,
  }),
  lessons: z.object({ museum: Lines, soc: Lines }),
});

const SYSTEM = `You write the end-of-shift report for NIGHT SHIFT, a game about a hospital security operations centre (SOC), told as a museum at night.
The metaphor: galleries are hospital departments, exhibits are clinical systems, the intruders are ransomware (in the museum voice always call them "the intruders", never "the gang"), guards Sam, Mia and Tom are SOC analysts, Rex the guard dog is the AI copilot, locking a gallery is isolating a system, and the Vault is the electronic patient records. Patients are always real, in both voices.

Write two versions of the same night, from the facts given. Use only the facts: never invent events, numbers, systems or names.
The report must fit on one screen without scrolling, and nothing you write is ever cut off. So keep it short: short, complete sentences, never trailing off with "..." or "…". Pick the most important facts rather than squeezing in all of them.

1. museum: the head guard's morning note to the team. Warm, short and lightly funny, never scary. Cover how the night went, which galleries were hit, what Sam, Mia and Tom did, and how Rex behaved (use the trust numbers, e.g. "we followed Rex 3 times, he was wrong once"), and the letters staff asked about in the post (phishing: how many were called right, and any extra intruders a bad call let in). Mention the real patient impact plainly. Explain why the care score (careContinuity, the night's average) is where it is, from facts.why (what moved it most, with points: negative cost care, positive saved it). Never write MTTD or MTTR in this voice: say "time to spot" and "time to stop" (timeToDetect and timeToRespond in the facts). A short title (under 6 words) and exactly 3 short paragraphs, each of 2 or 3 short sentences and under 40 words in all (the advice goes in lessons, not here). Gallery names, not hospital names. If a guard took no actions (an empty actions list), say they had a quiet night; never say they were busy.

2. soc: a professional SOC shift handover for the next shift, using hospital department and system names. Short, factual lines, 1 to 3 per section, each one complete sentence under 16 words: incidentSummary (attack, "MTTD (mean time to detect)" and "MTTR (mean time to respond)" written out like that, which are averages over the groups the attack split into, with how many were detected and contained, and the outcome), affectedSystems, actionsTaken (who did what, when, plus the phishing triage result: correct calls and any payloads executed), patientImpact (the care score for the night and the factors that drove it most), aiCopilotPerformance (alerts, false positives, followed and ignored), nextSteps (concrete, most urgent first; if a phishing email was opened, block its sender domain).

3. lessons: 2 or 3 pieces of advice for this player about their own decisions tonight, most important first, in both voices. museum: second person, friendly, naming Rex, the guards or the galleries, e.g. "You locked the Lab Gallery 40 seconds after Rex's first warning. Next time, act on Rex sooner." soc: the same advice as a SOC lesson learned, with department names. Base them on what moved the care score (facts.why) and on facts.lessons (observations about the player's decisions, most important first) and keep their exact numbers and times. Each one or two short sentences, under 22 words.`;

/** Tidy whitespace. Text is never cut: the prompt keeps it short, and the screen shrinks the type if it must. */
function tidyText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function tidy(raw: z.infer<typeof ReportSchema>, key: string, fallback: MorningReport['lessons']): MorningReport | null {
  // Whole sentences only: at most 3 paragraphs and 3 lines per section, each kept as written.
  const paragraphs = raw.museum.paragraphs.map(tidyText).filter(Boolean).slice(0, 3);
  const lines = (list: string[]) => list.map(tidyText).filter(Boolean).slice(0, 3);
  const soc = Object.fromEntries(SOC_SECTIONS.map(([k]) => [k, lines(raw.soc[k])])) as MorningReport['soc'];
  if (paragraphs.length < 2 || SOC_SECTIONS.some(([k]) => soc[k].length === 0)) return null;
  // Advice: 2 or 3 short lines. If Claude gave fewer than two, the ones read from the event log fill in.
  const advice = (list: string[], spare: string[]) => {
    const own = lines(list);
    return own.length >= 2 ? own : [...own, ...spare.filter((l) => !own.includes(l))].slice(0, 2);
  };
  const lessons = { museum: advice(raw.lessons.museum, fallback.museum), soc: advice(raw.lessons.soc, fallback.soc) };
  return { key, source: 'ai', model: REPORT_MODEL, museum: { title: tidyText(raw.museum.title), paragraphs }, soc, lessons };
}

let client: Anthropic | null | undefined;
function getClient(): Anthropic | null {
  if (client === undefined) {
    client = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0, timeout: REPORT_TIMEOUT_MS }) : null;
  }
  return client;
}

export function reportMode(): string {
  return getClient() ? `Claude (${REPORT_MODEL}), template if it takes over ${REPORT_TIMEOUT_MS / 1000} s or fails` : 'template only (no ANTHROPIC_API_KEY)';
}

async function askClaude(state: GameState, key: string): Promise<MorningReport> {
  const api = getClient();
  if (!api) throw new Error('no ANTHROPIC_API_KEY');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REPORT_TIMEOUT_MS);
  try {
    const response = await api.messages.parse(
      {
        model: REPORT_MODEL,
        max_tokens: 2000,
        thinking: { type: 'disabled' },
        output_config: { effort: 'low', format: zodOutputFormat(ReportSchema) },
        system: SYSTEM,
        messages: [{ role: 'user', content: `The facts of tonight, as JSON:\n${JSON.stringify(nightFacts(state))}` }],
      },
      { signal: controller.signal, timeout: REPORT_TIMEOUT_MS, maxRetries: 0 },
    );
    if (response.stop_reason === 'refusal') throw new Error('refused');
    if (!response.parsed_output) throw new Error(`no report in the answer (${response.stop_reason})`);
    const report = tidy(response.parsed_output, key, templateReport(state).lessons);
    if (!report) throw new Error('report incomplete');
    return report;
  } finally {
    clearTimeout(timer);
  }
}

function why(error: unknown): string {
  if (error instanceof Anthropic.APIUserAbortError) return `no answer within ${REPORT_TIMEOUT_MS / 1000} s`;
  if (error instanceof Anthropic.APIConnectionTimeoutError) return `no answer within ${REPORT_TIMEOUT_MS / 1000} s`;
  if (error instanceof Anthropic.APIConnectionError) return 'API unreachable';
  if (error instanceof Anthropic.APIError) return `API error ${error.status ?? ''}`.trim();
  return error instanceof Error ? error.message : String(error);
}

/** Never throws, never takes much longer than 8 seconds. */
export async function writeMorningReport(state: GameState): Promise<MorningReport> {
  const key = state.outcome ? reportKey(state.outcome) : 'none';
  const started = Date.now();
  try {
    const report = await Promise.race([
      askClaude(state, key),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`no answer within ${REPORT_TIMEOUT_MS / 1000} s`)), REPORT_TIMEOUT_MS + 250)),
    ]);
    console.log(`Morning report: written by Claude (${REPORT_MODEL}) in ${((Date.now() - started) / 1000).toFixed(1)} s`);
    return report;
  } catch (error) {
    console.log(`Morning report: template (${why(error)})`);
    return templateReport(state);
  }
}
