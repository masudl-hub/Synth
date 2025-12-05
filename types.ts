
export interface Point {
  x: number;
  y: number;
}

export interface AudioFeatures {
  volume: number;   // 0 to 1 smoothed volume
  bass: number;     // 0 to 1
  mid: number;      // 0 to 1
  treble: number;   // 0 to 1
  fft: Uint8Array;  // Raw frequency data
  waveform: Uint8Array; // Time domain data (actual wave shape)
  centroid: number; // Spectral Centroid (Timbre/Brightness/Pitch approximation)
  flux: number;     // Spectral Flux (Rhythmic Onset/Change)
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
  draw: DrawFunction;
}

// --- Generative Audio Types ---

export interface NoteEvent {
  freq: number;
  startStep: number; // 0-127 (16th notes, up to 8 bars)
  durationSteps: number;
}

export interface SynthPatch {
  name: string;
  description: string;
  bpm: number;
  totalSteps?: number; // Length of the loop (e.g., 32, 64, 128)
  oscillator: {
    type: 'sine' | 'square' | 'sawtooth' | 'triangle';
    detune: number; // -100 to 100 cents
    fmAmount: number; // 0 to 100
  };
  filter: {
    frequency: number; // 20 to 20000
    q: number; // 0 to 20
    type: 'lowpass' | 'highpass' | 'bandpass';
  };
  envelope: {
    attack: number; // seconds
    decay: number; // seconds
    sustain: number; // 0-1 gain
    release: number; // seconds
  };
  delay?: {
    time: number; // seconds (0.1 - 1.0)
    feedback: number; // 0.0 - 0.9
    mix: number; // 0.0 - 1.0
  };
  reverb?: {
    decay: number; // seconds (0.1 - 5.0)
    mix: number; // 0.0 - 1.0
  };
  melody: NoteEvent[];
  bassline: NoteEvent[];
}
