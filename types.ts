
export interface Point {
  x: number;
  y: number;
}

export interface AudioFeatures {
  volume: number;   // RMS level, -60..0 dBFS mapped to 0..1
  bass: number;     // 20-250 Hz band level, 0..1 (dB-mapped bytes)
  mid: number;      // 250-4000 Hz band level, 0..1
  treble: number;   // 4-20 kHz band level, 0..1
  fft: Uint8Array;  // 128-bin display spectrum, 0..Nyquist, dB-mapped bytes
  waveform: Uint8Array; // 128 most recent samples, 128 = zero
  centroid: number; // Spectral centroid on a log axis, 100 Hz..8 kHz mapped to 0..1
  centroidHz: number; // Spectral centroid in Hz
  flux: number;     // Spectral flux (onset strength), 0..1
  peakHz: number;   // Loudest spectral peak in Hz, 0 when silent
  chroma: Float32Array; // 12 pitch classes from C, peak = 1, all zero when silent
  scope: Float32Array;  // 2048 most recent samples, -1..1
  sampleRate: number;
}

export interface SimulationContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  time: number;
  mouse: Point;
  isHovered: boolean;
  audio: AudioFeatures;
}

export type DrawFunction = (context: SimulationContext) => void;

export interface SimulationDef {
  id: number;
  title: string;
  description: string;
  /** How closely the drawing follows its source: computed as published, an idealised form, borrowed idea, or invented. */
  fidelity: 'computes' | 'idealised' | 'inspired' | 'artistic';
  /** Source of the idea: author, work, year. */
  reference: string;
  /** The relation the drawing computes, as shown in the on-canvas overlay. */
  formula: string;
  draw: DrawFunction;
}

// --- Generative Audio Types ---

export interface NoteEvent {
  freq: number;
  startStep: number; // 0-127 (16th notes, up to 8 bars)
  durationSteps: number;
  velocity?: number; // 0.1 to 1: how hard the note is played; 1 (the default) is full level
  slide?: boolean; // bend into this note from the part's previous one; legato (no new attack) while that note still sounds
}

export type WaveShape = 'sine' | 'square' | 'sawtooth' | 'triangle' | 'pulse' | 'organ' | 'bell';

export interface DrumEvent {
  type: 'kick' | 'snare' | 'hat' | 'clap';
  startStep: number;
  velocity?: number;
}

/** One part's sound. The lead plays the melody and the bass plays the bassline, each with its own. */
export interface Instrument {
  oscillator: {
    type: WaveShape;
    detune: number; // -100 to 100 cents: a nonzero value adds a second carrier this far off, so the pair beats
    fmAmount: number; // 0 to 100
    fmRatio?: number; // 0.25 to 8: modulator frequency / note frequency; 2 (the default) is an octave above
    fmWave?: WaveShape; // the modulator's shape; sine is clean and bell-like. Omitted, it follows the carrier
    fmDecay?: number; // seconds for the FM depth to fall to a tenth within each note. Omitted, it holds
    layer?: { type: WaveShape; octave: number; detune: number; mix: number }; // a second oscillator under every note
  };
  sub?: number; // 0 to 1: a sine an octave below each note (only where that stays above 40 Hz). Omitted, none
  level?: number; // 0 to 1: the part's level in the mix. Omitted, 1
  glide?: number; // seconds a slide note takes to bend to its pitch. Omitted, 0.06
  lfo?: { target: 'filter' | 'pitch' | 'amp'; rate: number; depth: number }; // a slow wobble on every note
  filter: {
    frequency: number; // 20 to 20000
    q: number; // 0 to 20 (lowpass and highpass: peak in dB)
    type: 'lowpass' | 'highpass' | 'bandpass';
    envAmount?: number; // -4 to 4 octaves: each note's cutoff starts this far from `frequency` and glides back to it
    slope?: 12 | 24; // dB per octave. 24 stacks a second, flat stage before the resonant one. Omitted, 12
    accent?: number; // 0 to 1: how much velocity scales the sweep. Omitted, 0: every note sweeps the full envAmount
  };
  envelope: {
    attack: number; // seconds
    decay: number; // seconds
    sustain: number; // 0-1 gain
    release: number; // seconds
  };
}

export interface SynthPatch {
  name: string;
  description: string;
  bpm: number;
  totalSteps?: number; // Length of the loop (e.g., 32, 64, 128)
  swing?: number; // 0 to 0.5: share of a step each off-beat sixteenth (odd step) lands late; 1/3 is triplet swing
  drive?: number; // 0 to 1: tanh soft clipping on the synth voices (not the drums)
  lead: Instrument;
  bass: Instrument;
  drums?: DrumEvent[];
  delay?: {
    time: number; // seconds (0.1 - 1.0)
    feedback: number; // 0.0 - 0.9
    mix: number; // 0.0 - 1.0
  };
  reverb?: {
    decay: number; // reverb time (RT60) in seconds, 0.1 - 6
    mix: number; // 0.0 - 1.0
    tone?: number; // 0 (dark and soft) to 1 (bright): how much of the highs the room keeps
  };
  melody: NoteEvent[]; // may be empty for bass-led pieces
  bassline: NoteEvent[];
}
