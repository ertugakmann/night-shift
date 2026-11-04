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
});

const SYSTEM = `You write the end-of-shift report for NIGHT SHIFT, a game about a hospital security operations centre (SOC), told as a museum at night.
The metaphor: galleries are hospital departments, exhibits are clinical systems, the intruder gang is ransomware, guards Sam, Priya and Tom are SOC analysts, Rex the guard dog is the AI copilot, locking a gallery is isolating a system, and the Vault is the electronic patient records. Patients are always real, in both voices.

Write two versions of the same night, from the facts given. Use only the facts: never invent events, numbers, systems or names.

1. museum: the head guard's morning note to the team. Warm, short and lightly funny, never scary. Cover how the night went, which galleries were hit, what Sam, Priya and Tom did, and how Rex behaved (use the trust numbers, e.g. "we followed Rex 3 times, he was wrong once"). Mention the real patient impact plainly. A short title (under 6 words) and 3 or 4 short paragraphs, each under 45 words. Gallery names, not hospital names.

2. soc: a professional SOC shift handover for the next shift, using hospital department and system names. Short, factual lines, 1 to 3 per section, each under 18 words: incidentSummary (attack, detection and containment times, outcome), affectedSystems, actionsTaken (who did what, when), patientImpact (with care continuity against the benchmarks), aiCopilotPerformance (alerts, false positives, followed and ignored), nextSteps (concrete, most urgent first).`;

/** Short enough to fit the screen, whatever comes back. */
function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max * 0.6))}…`;
}

function tidy(raw: z.infer<typeof ReportSchema>, key: string): MorningReport | null {
  const paragraphs = raw.museum.paragraphs.map((p) => clip(p, 300)).filter(Boolean).slice(0, 4);
  // Each section gets about five lines on screen: up to 3 lines of 110 characters, 260 in all.
  const fit = (lines: string[]) => {
    let used = 0;
    return lines
      .map((l) => clip(l, 110))
      .filter(Boolean)
      .slice(0, 3)
      .filter((l, i) => (used += l.length) <= 260 || i === 0);
  };
  const soc = Object.fromEntries(SOC_SECTIONS.map(([k]) => [k, fit(raw.soc[k])])) as MorningReport['soc'];
  if (paragraphs.length < 2 || SOC_SECTIONS.some(([k]) => soc[k].length === 0)) return null;
  return { key, source: 'ai', model: REPORT_MODEL, museum: { title: clip(raw.museum.title, 48), paragraphs }, soc };
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
    const report = tidy(response.parsed_output, key);
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
