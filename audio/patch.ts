import { DrumEvent, Instrument, NoteEvent, SynthPatch, WaveShape } from '../types';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const num = (v: unknown, fallback: number) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : fallback);
const velocityOf = (v: unknown) => (v == null || v === '' ? 1 : clamp(Number(v) || 1, 0.1, 1));

const WAVES: WaveShape[] = ['sine', 'square', 'sawtooth', 'triangle', 'pulse', 'organ', 'bell'];
const waveOf = (v: unknown, fallback: WaveShape): WaveShape => (WAVES.includes(v as WaveShape) ? (v as WaveShape) : fallback);

/** The part the strip's wave and filter controls act on: the lead, unless the patch has no melody. */
export type Part = 'lead' | 'bass';
export const focusPart = (patch: SynthPatch): Part => (patch.melody.length ? 'lead' : 'bass');

const instrument = (raw: any, defaults: { sub: number }): Instrument => {
  const osc = raw?.oscillator ?? {};
  const filter = raw?.filter ?? {};
  const env = raw?.envelope ?? {};
  const type = waveOf(osc.type, 'sine');
  return {
    oscillator: {
      type,
      detune: clamp(num(osc.detune, 0), -100, 100),
      fmAmount: clamp(num(osc.fmAmount, 0), 0, 100),
      fmRatio: clamp(Number(osc.fmRatio) || 2, 0.25, 8),
      ...(WAVES.includes(osc.fmWave) ? { fmWave: osc.fmWave } : {}),
      ...(osc.fmDecay != null ? { fmDecay: clamp(num(osc.fmDecay, 0), 0, 8) } : {}),
      ...(osc.layer ? { layer: {
        type: waveOf(osc.layer.type, 'sine'),
        octave: Math.round(clamp(num(osc.layer.octave, 0), -2, 2)),
        detune: clamp(num(osc.layer.detune, 0), -100, 100),
        mix: clamp(num(osc.layer.mix, 0), 0, 1),
      } } : {}),
    },
    sub: clamp(num(raw?.sub, defaults.sub), 0, 1),
    ...(raw?.level != null ? { level: clamp(num(raw.level, 1), 0, 1) } : {}),
    ...(raw?.glide != null ? { glide: clamp(num(raw.glide, 0.06), 0, 2) } : {}),
    ...(raw?.lfo ? { lfo: {
      target: ['filter', 'pitch', 'amp'].includes(raw.lfo.target) ? raw.lfo.target : 'filter',
      rate: clamp(Number(raw.lfo.rate) || 1, 0.05, 20),
      depth: clamp(num(raw.lfo.depth, 0), 0, 1),
    } } : {}),
    filter: {
      type: ['lowpass', 'highpass', 'bandpass'].includes(filter.type) ? filter.type : 'lowpass',
      frequency: clamp(Number(filter.frequency) || 2000, 20, 20000),
      q: clamp(num(filter.q, 1), 0, 20),
      envAmount: clamp(num(filter.envAmount, 0), -4, 4),
      // Snapped, so anything above the halfway mark is the steeper filter.
      ...(filter.slope != null ? { slope: Number(filter.slope) > 18 ? 24 : 12 } : {}),
      ...(filter.accent != null ? { accent: clamp(num(filter.accent, 0), 0, 1) } : {}),
    },
    envelope: {
      attack: clamp(num(env.attack, 0.01), 0, 10),
      decay: clamp(Number(env.decay) || 0.1, 0.001, 10),
      sustain: clamp(num(env.sustain, 0.5), 0, 1),
      release: clamp(num(env.release, 0.1), 0, 10),
    },
  };
};

const notes = (raw: unknown, fallbackFreq: number): NoteEvent[] =>
  Array.isArray(raw) ? raw.map((n: any) => ({
    freq: Number(n.freq) || fallbackFreq,
    startStep: Math.floor(num(n.startStep, 0)),
    durationSteps: clamp(Number(n.durationSteps) || 1, 1, 64),
    velocity: velocityOf(n.velocity),
    ...(n.slide === true ? { slide: true } : {}),
  })) : [];

/**
 * One sound for both parts, as every patch had before the lead and bass were split: the bass keeps the sine sub an
 * octave down that it always had, and drops the detune, which there only nudged that sub.
 */
export const oneSound = (sound: any): { lead: Instrument; bass: Instrument } => ({
  lead: { ...sound, sub: 0 },
  bass: { ...sound, sub: 1, oscillator: { ...sound.oscillator, detune: 0 } },
});

/**
 * Any patch, in this shape or the older one, as the engine plays it: every field present where the engine needs it
 * and clamped to what it accepts. A patch from before the lead and bass were split becomes `oneSound` of its sound,
 * with `glide` moved from the oscillator to the part.
 * Normalizing a normalized patch changes nothing, so saved and loaded copies compare equal.
 */
export function normalizePatch(raw: any): SynthPatch {
  const old = !raw?.lead && !raw?.bass && (raw?.oscillator || raw?.filter || raw?.envelope);
  const parts = old ? oneSound({
    oscillator: raw.oscillator, filter: raw.filter, envelope: raw.envelope, lfo: raw.lfo,
    ...(raw.oscillator?.glide != null ? { glide: raw.oscillator.glide } : {}),
  }) : null;
  const leadRaw = parts?.lead ?? raw?.lead ?? raw?.bass;
  const bassRaw = parts?.bass ?? raw?.bass ?? raw?.lead;

  return {
    name: raw?.name || 'Untitled',
    description: raw?.description || 'Generated Patch',
    bpm: clamp(Number(raw?.bpm) || 120, 20, 300),
    totalSteps: Math.floor(Number(raw?.totalSteps) || 32),
    ...(raw?.swing != null ? { swing: clamp(num(raw.swing, 0), 0, 0.5) } : {}),
    ...(raw?.drive != null ? { drive: clamp(num(raw.drive, 0), 0, 1) } : {}),
    lead: instrument(leadRaw, { sub: 0 }),
    bass: instrument(bassRaw, { sub: 0 }),
    ...(Array.isArray(raw?.drums) ? { drums: raw.drums.map((d: any): DrumEvent => ({
      type: ['kick', 'snare', 'hat', 'clap'].includes(d.type) ? d.type : 'hat',
      startStep: Math.floor(num(d.startStep, 0)),
      velocity: velocityOf(d.velocity),
    })) } : {}),
    delay: {
      time: clamp(Number(raw?.delay?.time) || 0.3, 0.01, 2),
      feedback: clamp(num(raw?.delay?.feedback, 0.3), 0, 0.9),
      mix: clamp(num(raw?.delay?.mix, 0), 0, 1),
    },
    reverb: {
      decay: clamp(Number(raw?.reverb?.decay) || 2, 0.1, 6),
      mix: clamp(num(raw?.reverb?.mix, 0), 0, 1),
      ...(raw?.reverb?.tone != null ? { tone: clamp(num(raw.reverb.tone, 0.4), 0, 1) } : {}),
    },
    melody: notes(raw?.melody, 440),
    bassline: notes(raw?.bassline, 110),
  };
}
