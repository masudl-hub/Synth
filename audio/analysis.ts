import { AudioFeatures } from '../types';

/** Two analysers on one signal: `lo` feeds the 128-bin display spectrum, `hi` the pitch and level maths. */
export const LO_FFT = 256;
export const HI_FFT = 8192;
const SCOPE_LEN = 2048;

// Band edges in Hz.
const BASS_HZ: [number, number] = [20, 250];
const MID_HZ: [number, number] = [250, 4000];
const TREBLE_HZ: [number, number] = [4000, 20000];
// Centroid is reported on a log axis between these two frequencies.
const CENTROID_HZ: [number, number] = [100, 8000];
// Chroma folds the spectrum between A2 and B6, where one semitone spans at least one bin.
const CHROMA_HZ: [number, number] = [110, 2000];
const CHROMA_FLOOR_DB = -75;
const FLUX_SCALE = 8;

export const PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const silentFeatures = (sampleRate = 44100): AudioFeatures => ({
  volume: 0, bass: 0, mid: 0, treble: 0,
  fft: new Uint8Array(LO_FFT / 2),
  waveform: new Uint8Array(LO_FFT / 2),
  centroid: 0, centroidHz: 0, flux: 0,
  peakHz: 0,
  chroma: new Float32Array(12),
  scope: new Float32Array(SCOPE_LEN),
  sampleRate,
});

export const createAnalysers = (ctx: AudioContext, source: AudioNode) => {
  const lo = ctx.createAnalyser();
  lo.fftSize = LO_FFT;
  lo.smoothingTimeConstant = 0.7;
  const hi = ctx.createAnalyser();
  hi.fftSize = HI_FFT;
  hi.smoothingTimeConstant = 0.6;
  source.connect(lo);
  source.connect(hi);
  return { lo, hi };
};

const binOf = (hz: number, sampleRate: number, bins: number) =>
  Math.max(0, Math.min(bins - 1, Math.round((hz / (sampleRate / 2)) * bins)));

/** Mean of the byte levels (Web Audio maps -100..-30 dB onto 0..255) across a band. */
export const bandLevel = (bytes: Uint8Array, sampleRate: number, [lo, hi]: [number, number]) => {
  const a = binOf(lo, sampleRate, bytes.length);
  const b = Math.max(a + 1, binOf(Math.min(hi, sampleRate / 2), sampleRate, bytes.length));
  let sum = 0;
  for (let i = a; i < b; i++) sum += bytes[i];
  return sum / (b - a) / 255;
};

/** Fold a dB spectrum into 12 pitch classes. Each bin splits between the two nearest classes. Peak is 1. */
export const chromaOf = (db: Float32Array, sampleRate: number): Float32Array => {
  const chroma = new Float32Array(12);
  const hz = sampleRate / 2 / db.length;
  const first = Math.ceil(CHROMA_HZ[0] / hz);
  const last = Math.min(db.length - 1, Math.floor(CHROMA_HZ[1] / hz));
  let peak = -Infinity;
  for (let i = first; i <= last; i++) {
    if (db[i] > peak) peak = db[i];
    if (!(db[i] > CHROMA_FLOOR_DB)) continue;
    const midi = 69 + 12 * Math.log2((i * hz) / 440);
    const pos = ((midi % 12) + 12) % 12;
    const lower = Math.floor(pos);
    const frac = pos - lower;
    const mag = Math.pow(10, db[i] / 20);
    chroma[lower] += mag * (1 - frac);
    chroma[(lower + 1) % 12] += mag * frac;
  }
  if (!(peak > CHROMA_FLOOR_DB)) return new Float32Array(12);
  let max = 0;
  for (let c = 0; c < 12; c++) if (chroma[c] > max) max = chroma[c];
  for (let c = 0; c < 12; c++) chroma[c] /= max;
  return chroma;
};

/** Loudest bin between 40 Hz and 5 kHz, refined by a parabola through its neighbours. */
export const peakOf = (db: Float32Array, sampleRate: number): number => {
  const hz = sampleRate / 2 / db.length;
  const first = Math.ceil(40 / hz);
  const last = Math.min(db.length - 2, Math.floor(5000 / hz));
  let best = first;
  for (let i = first; i <= last; i++) if (db[i] > db[best]) best = i;
  if (!(db[best] > -80)) return 0;
  const a = db[best - 1], b = db[best], c = db[best + 1];
  const denom = a - 2 * b + c;
  const shift = denom !== 0 ? (0.5 * (a - c)) / denom : 0;
  return (best + Math.max(-0.5, Math.min(0.5, shift))) * hz;
};

/** Spectral centroid in Hz: sum(f * |X|) / sum(|X|) over 20 Hz to Nyquist. */
export const centroidOf = (db: Float32Array, sampleRate: number): number => {
  const hz = sampleRate / 2 / db.length;
  let num = 0, den = 0;
  for (let i = Math.ceil(20 / hz); i < db.length; i++) {
    if (!(db[i] > -100)) continue;
    const mag = Math.pow(10, db[i] / 20);
    num += i * hz * mag;
    den += mag;
  }
  return den > 0 ? num / den : 0;
};

/** RMS level of the time signal, mapped from -60..0 dBFS onto 0..1. */
export const levelOf = (signal: Float32Array): number => {
  let sum = 0;
  for (let i = 0; i < signal.length; i++) sum += signal[i] * signal[i];
  const rms = Math.sqrt(sum / signal.length);
  return rms > 0 ? Math.max(0, Math.min(1, (20 * Math.log10(rms) + 60) / 60)) : 0;
};

/** Reads both analysers once per frame and keeps the previous spectrum for flux. */
export class FeatureExtractor {
  private prev: Uint8Array;
  private db = new Float32Array(HI_FFT / 2);
  private time = new Float32Array(HI_FFT);

  constructor(private lo: AnalyserNode, private hi: AnalyserNode) {
    this.prev = new Uint8Array(lo.frequencyBinCount);
  }

  read(): AudioFeatures {
    const { lo, hi } = this;
    const sampleRate = lo.context.sampleRate;

    const fft = new Uint8Array(lo.frequencyBinCount);
    const waveform = new Uint8Array(lo.frequencyBinCount);
    lo.getByteFrequencyData(fft);
    lo.getByteTimeDomainData(waveform);

    const bytes = new Uint8Array(hi.frequencyBinCount);
    hi.getByteFrequencyData(bytes);
    hi.getFloatFrequencyData(this.db);
    hi.getFloatTimeDomainData(this.time);

    // Spectral flux: sum of positive per-bin changes between frames, scaled to roughly 0..1.
    let flux = 0;
    for (let i = 0; i < fft.length; i++) {
      const diff = (fft[i] - this.prev[i]) / 255;
      if (diff > 0) flux += diff;
    }
    this.prev.set(fft);

    const centroidHz = centroidOf(this.db, sampleRate);
    const [cLo, cHi] = CENTROID_HZ;
    const centroid = centroidHz > 0
      ? Math.max(0, Math.min(1, Math.log2(centroidHz / cLo) / Math.log2(cHi / cLo)))
      : 0;

    return {
      volume: levelOf(this.time),
      bass: bandLevel(bytes, sampleRate, BASS_HZ),
      mid: bandLevel(bytes, sampleRate, MID_HZ),
      treble: bandLevel(bytes, sampleRate, TREBLE_HZ),
      fft, waveform,
      centroid, centroidHz,
      flux: Math.min(1, flux / FLUX_SCALE),
      peakHz: peakOf(this.db, sampleRate),
      chroma: chromaOf(this.db, sampleRate),
      scope: this.time.slice(HI_FFT - SCOPE_LEN),
      sampleRate,
    };
  }
}
