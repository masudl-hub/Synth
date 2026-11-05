import type { DrumEvent, Instrument, NoteEvent, SynthPatch, WaveShape } from '../types.ts';

/** A patch arrives as untrusted JSON (saved copies, the editor, an LLM): every field is read through these. */
type Dict = Readonly<Record<string, unknown>>;
const dict = (v: unknown): Dict => (typeof v === 'object' && v !== null ? (v as Dict) : {});
const isMissing = (v: unknown) => v === null || v === undefined;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const num = (v: unknown, fallback: number) =>
  Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : fallback;
const velocityOf = (v: unknown) => (isMissing(v) || v === '' ? 1 : clamp(Number(v) || 1, 0.1, 1));
const textOf = (v: unknown, fallback: string) => (v ? String(v) : fallback);
const oneOf = <T extends string>(options: readonly T[], v: unknown, fallback: T): T =>
  options.find((o) => o === v) ?? fallback;

/** An optional field: left out when missing, so a patch that never set it keeps the engine's default. */
const optional = <K extends string, T>(key: K, v: unknown, read: (v: unknown) => T) =>
  isMissing(v) ? {} : ({ [key]: read(v) } as Record<K, T>);

const WAVES: readonly WaveShape[] = ['sine', 'square', 'sawtooth', 'triangle', 'pulse', 'organ', 'bell'];
const LFO_TARGETS = ['filter', 'pitch', 'amp'] as const;
const FILTER_TYPES = ['lowpass', 'highpass', 'bandpass'] as const;
const DRUMS = ['kick', 'snare', 'hat', 'clap'] as const;

/** The part the strip's wave and filter controls act on: the lead, unless the patch has no melody. */
export type Part = 'lead' | 'bass';
export const focusPart = (patch: SynthPatch): Part => (patch.melody.length ? 'lead' : 'bass');

const layerOf = (v: unknown) => {
  const layer = dict(v);
  return {
    type: oneOf(WAVES, layer.type, 'sine'),
    octave: Math.round(clamp(num(layer.octave, 0), -2, 2)),
    detune: clamp(num(layer.detune, 0), -100, 100),
    mix: clamp(num(layer.mix, 0), 0, 1),
  };
};

const oscillatorOf = (v: unknown): Instrument['oscillator'] => {
  const osc = dict(v);
  const fmWave = WAVES.find((w) => w === osc.fmWave);
  return {
    type: oneOf(WAVES, osc.type, 'sine'),
    detune: clamp(num(osc.detune, 0), -100, 100),
    fmAmount: clamp(num(osc.fmAmount, 0), 0, 100),
    fmRatio: clamp(Number(osc.fmRatio) || 2, 0.25, 8),
    ...(fmWave ? { fmWave } : {}),
    ...optional('fmDecay', osc.fmDecay, (d) => clamp(num(d, 0), 0, 8)),
    ...(osc.layer ? { layer: layerOf(osc.layer) } : {}),
  };
};

const lfoOf = (v: unknown): Instrument['lfo'] => {
  const lfo = dict(v);
  return {
    target: oneOf(LFO_TARGETS, lfo.target, 'filter'),
    rate: clamp(Number(lfo.rate) || 1, 0.05, 20),
    depth: clamp(num(lfo.depth, 0), 0, 1),
  };
};

const filterOf = (v: unknown): Instrument['filter'] => {
  const filter = dict(v);
  return {
    type: oneOf(FILTER_TYPES, filter.type, 'lowpass'),
    frequency: clamp(Number(filter.frequency) || 2000, 20, 20_000),
    q: clamp(num(filter.q, 1), 0, 20),
    envAmount: clamp(num(filter.envAmount, 0), -4, 4),
    // Snapped, so anything above the halfway mark is the steeper filter.
    ...optional('slope', filter.slope, (s): 12 | 24 => (Number(s) > 18 ? 24 : 12)),
    ...optional('accent', filter.accent, (a) => clamp(num(a, 0), 0, 1)),
  };
};

const envelopeOf = (v: unknown): Instrument['envelope'] => {
  const env = dict(v);
  return {
    attack: clamp(num(env.attack, 0.01), 0, 10),
    decay: clamp(Number(env.decay) || 0.1, 0.001, 10),
    sustain: clamp(num(env.sustain, 0.5), 0, 1),
    release: clamp(num(env.release, 0.1), 0, 10),
  };
};

const instrument = (v: unknown): Instrument => {
  const raw = dict(v);
  return {
    oscillator: oscillatorOf(raw.oscillator),
    sub: clamp(num(raw.sub, 0), 0, 1),
    ...optional('level', raw.level, (l) => clamp(num(l, 1), 0, 1)),
    ...optional('glide', raw.glide, (g) => clamp(num(g, 0.06), 0, 2)),
    ...(raw.lfo ? { lfo: lfoOf(raw.lfo) } : {}),
    filter: filterOf(raw.filter),
    envelope: envelopeOf(raw.envelope),
  };
};

const noteOf =
  (fallbackFreq: number) =>
  (v: unknown): NoteEvent => {
    const n = dict(v);
    return {
      freq: Number(n.freq) || fallbackFreq,
      startStep: Math.floor(num(n.startStep, 0)),
      durationSteps: clamp(Number(n.durationSteps) || 1, 1, 64),
      velocity: velocityOf(n.velocity),
      ...(n.slide === true ? { slide: true } : {}),
    };
  };

const notes = (raw: unknown, fallbackFreq: number): NoteEvent[] =>
  Array.isArray(raw) ? raw.map(noteOf(fallbackFreq)) : [];

const drumOf = (v: unknown): DrumEvent => {
  const d = dict(v);
  return {
    type: oneOf(DRUMS, d.type, 'hat'),
    startStep: Math.floor(num(d.startStep, 0)),
    velocity: velocityOf(d.velocity),
  };
};

const delayOf = (v: unknown): NonNullable<SynthPatch['delay']> => {
  const delay = dict(v);
  return {
    time: clamp(Number(delay.time) || 0.3, 0.01, 2),
    feedback: clamp(num(delay.feedback, 0.3), 0, 0.9),
    mix: clamp(num(delay.mix, 0), 0, 1),
  };
};

const reverbOf = (v: unknown): NonNullable<SynthPatch['reverb']> => {
  const reverb = dict(v);
  return {
    decay: clamp(Number(reverb.decay) || 2, 0.1, 6),
    mix: clamp(num(reverb.mix, 0), 0, 1),
    ...optional('tone', reverb.tone, (t) => clamp(num(t, 0.4), 0, 1)),
  };
};

/**
 * One sound for both parts, as every patch had before the lead and bass were split: the bass keeps the sine sub an
 * octave down that it always had, and drops the detune, which there only nudged that sub.
 */
export const oneSound = (sound: Instrument): { lead: Instrument; bass: Instrument } => ({
  lead: { ...sound, sub: 0 },
  bass: { ...sound, sub: 1, oscillator: { ...sound.oscillator, detune: 0 } },
});

/** The raw lead and bass of a patch: as given, or, from a patch before the split, `oneSound` of its one sound. */
const partsOf = (raw: Dict): { lead: unknown; bass: unknown } => {
  const old = !(raw.lead || raw.bass) && (raw.oscillator || raw.filter || raw.envelope);
  if (!old) {
    return { lead: raw.lead ?? raw.bass, bass: raw.bass ?? raw.lead };
  }
  const osc = dict(raw.oscillator);
  const sound = {
    oscillator: raw.oscillator,
    filter: raw.filter,
    envelope: raw.envelope,
    lfo: raw.lfo,
    ...(isMissing(osc.glide) ? {} : { glide: osc.glide }),
  };
  return { lead: { ...sound, sub: 0 }, bass: { ...sound, sub: 1, oscillator: { ...osc, detune: 0 } } };
};

/**
 * Any patch, in this shape or the older one, as the engine plays it: every field present where the engine needs it
 * and clamped to what it accepts. A patch from before the lead and bass were split becomes `oneSound` of its sound,
 * with `glide` moved from the oscillator to the part.
 * Normalizing a normalized patch changes nothing, so saved and loaded copies compare equal.
 */
export function normalizePatch(input: unknown): SynthPatch {
  const raw = dict(input);
  const parts = partsOf(raw);
  return {
    name: textOf(raw.name, 'Untitled'),
    description: textOf(raw.description, 'Generated Patch'),
    bpm: clamp(Number(raw.bpm) || 120, 20, 300),
    totalSteps: Math.floor(Number(raw.totalSteps) || 32),
    ...optional('swing', raw.swing, (s) => clamp(num(s, 0), 0, 0.5)),
    ...optional('drive', raw.drive, (d) => clamp(num(d, 0), 0, 1)),
    lead: instrument(parts.lead),
    bass: instrument(parts.bass),
    ...(Array.isArray(raw.drums) ? { drums: raw.drums.map(drumOf) } : {}),
    delay: delayOf(raw.delay),
    reverb: reverbOf(raw.reverb),
    melody: notes(raw.melody, 440),
    bassline: notes(raw.bassline, 110),
  };
}
