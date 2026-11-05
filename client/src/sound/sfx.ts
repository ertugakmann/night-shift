// Every sound in the game, made in code with the Web Audio API: no sound files. Quiet and soft on
// purpose: a museum at night, not an arcade. Nothing plays until the page has had a key press or a
// tap (browsers keep audio locked until then).

/** Master volume, 0–1. Kept low: the presenter talks over it. */
const VOLUME = 0.22;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function audio(): AudioContext | null {
  if (!ctx) {
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = VOLUME;
      // A gentle compressor keeps overlapping cues from ever getting harsh.
      const soften = ctx.createDynamicsCompressor();
      soften.threshold.value = -20;
      soften.ratio.value = 4;
      master.connect(soften).connect(ctx.destination);
    } catch {
      return null;
    }
  }
  return ctx.state === 'running' ? ctx : null;
}

/** Call from a key press or tap: browsers only let audio start after one. */
export function unlockAudio(): void {
  audio();
  if (ctx && ctx.state !== 'running') void ctx.resume().catch(() => {});
}

interface Tone {
  type?: OscillatorType;
  freq: number;
  /** Glide to this frequency over the note. */
  to?: number;
  at?: number;
  dur: number;
  gain?: number;
  attack?: number;
  /** Optional low-pass cutoff, for a rounder sound. */
  lowpass?: number;
}

function tone(c: AudioContext, { type = 'sine', freq, to, at = 0, dur, gain = 0.5, attack = 0.01, lowpass }: Tone): void {
  const t = c.currentTime + at;
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node: AudioNode = osc.connect(env);
  if (lowpass) {
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = lowpass;
    node = node.connect(f);
  }
  node.connect(master!);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

let noiseBuffer: AudioBuffer | null = null;
function noise(c: AudioContext, { at = 0, dur, gain = 0.3, band, q = 1, sweepTo }: { at?: number; dur: number; gain?: number; band: number; q?: number; sweepTo?: number }): void {
  if (!noiseBuffer) {
    noiseBuffer = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    // A fixed pseudo-random hiss, made once.
    let x = 1;
    for (let i = 0; i < data.length; i++) {
      x = (x * 16807) % 2147483647;
      data[i] = (x / 2147483647) * 2 - 1;
    }
  }
  const t = c.currentTime + at;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(band, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  f.Q.value = q;
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.02, dur / 3));
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(env).connect(master!);
  src.start(t);
  src.stop(t + dur + 0.05);
}

function play(make: (c: AudioContext) => void): void {
  const c = audio();
  if (!c || !master) return;
  try {
    make(c);
  } catch {
    /* a sound must never break the page */
  }
}

export const sfx = {
  /** The flashlight switching on: a small dry click and a faint glow of a note. */
  flashlight: () =>
    play((c) => {
      noise(c, { dur: 0.04, gain: 0.5, band: 3200, q: 2 });
      tone(c, { type: 'triangle', freq: 1320, at: 0.02, dur: 0.18, gain: 0.08 });
    }),

  /** A padlock snapping shut: a soft thunk and a bright click. */
  lock: () =>
    play((c) => {
      tone(c, { type: 'sine', freq: 160, to: 70, dur: 0.18, gain: 0.5 });
      noise(c, { at: 0.05, dur: 0.05, gain: 0.45, band: 2400, q: 4 });
      tone(c, { type: 'square', freq: 1900, at: 0.06, dur: 0.05, gain: 0.05, lowpass: 3000 });
    }),

  /** Rex: two short, friendly woofs. */
  bark: () =>
    play((c) => {
      for (const at of [0, 0.2]) {
        tone(c, { type: 'sawtooth', freq: 360, to: 170, at, dur: 0.14, gain: 0.32, attack: 0.008, lowpass: 900 });
        noise(c, { at, dur: 0.1, gain: 0.12, band: 700, q: 1.5 });
      }
    }),

  /** The gang thrown out: a little rising fanfare. */
  victory: () =>
    play((c) => {
      [523, 659, 784, 1047].forEach((f, i) => tone(c, { type: 'triangle', freq: f, at: i * 0.11, dur: 0.32, gain: 0.22 }));
      tone(c, { type: 'sine', freq: 1568, at: 0.44, dur: 0.6, gain: 0.08 });
    }),

  /** A letter dropping in: paper swish and a soft bell. */
  envelope: () =>
    play((c) => {
      noise(c, { dur: 0.32, gain: 0.25, band: 1800, sweepTo: 5000, q: 0.8 });
      tone(c, { type: 'sine', freq: 1175, at: 0.28, dur: 0.6, gain: 0.12 });
      tone(c, { type: 'sine', freq: 1760, at: 0.36, dur: 0.5, gain: 0.06 });
    }),

  /** Lights on: a calm tone rising with the wave across the screens. */
  lightsOn: () =>
    play((c) => {
      tone(c, { type: 'sine', freq: 196, to: 784, dur: 1.8, gain: 0.18, attack: 0.3 });
      tone(c, { type: 'triangle', freq: 294, to: 1175, at: 0.1, dur: 1.7, gain: 0.07, attack: 0.3 });
    }),

  /** Lights off: the same tone, falling. */
  lightsOff: () =>
    play((c) => {
      tone(c, { type: 'sine', freq: 784, to: 220, dur: 1.2, gain: 0.12, attack: 0.1 });
    }),

  /** One heartbeat: lub-dub. */
  heartbeat: (strength = 1) =>
    play((c) => {
      tone(c, { type: 'sine', freq: 62, to: 44, dur: 0.16, gain: 0.55 * strength, attack: 0.008 });
      tone(c, { type: 'sine', freq: 56, to: 40, at: 0.2, dur: 0.14, gain: 0.38 * strength, attack: 0.008 });
    }),

  /** "Phew!": a long slow breath out, then a soft chime. */
  phew: () =>
    play((c) => {
      noise(c, { dur: 1.2, gain: 0.18, band: 1200, sweepTo: 350, q: 0.7 });
      tone(c, { type: 'sine', freq: 880, to: 660, at: 0.6, dur: 1.0, gain: 0.1 });
      tone(c, { type: 'sine', freq: 1320, to: 990, at: 0.7, dur: 0.9, gain: 0.05 });
    }),
};
