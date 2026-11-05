import { describe, expect, it } from 'vitest';
import { createAnalysers, FeatureExtractor, PITCH_NAMES, silentFeatures } from './analysis.ts';

const RATE = 48_000;
const BINS = 4096;
const BIN_HZ = RATE / 2 / BINS;

/** One frame of what the two analysers hear: a dB spectrum, its byte form, and the time signal. */
interface Frame {
  db: (i: number) => number;
  signal: (i: number) => number;
  loBytes?: number;
}

/** A stand-in analyser that reports a synthetic frame instead of measuring one. */
class FakeAnalyser {
  fftSize: number;
  smoothingTimeConstant = 0;
  readonly context = { sampleRate: RATE };
  frame: Frame = { db: () => -120, signal: () => 0 };
  constructor(fftSize: number) {
    this.fftSize = fftSize;
  }
  get frequencyBinCount() {
    return this.fftSize / 2;
  }
  getByteFrequencyData(out: Uint8Array) {
    for (let i = 0; i < out.length; i++) {
      out[i] = this.frame.loBytes ?? Math.max(0, Math.min(255, ((this.frame.db(i) + 100) / 70) * 255));
    }
  }
  getByteTimeDomainData(out: Uint8Array) {
    out.fill(128);
  }
  getFloatFrequencyData(out: Float32Array) {
    for (let i = 0; i < out.length; i++) {
      out[i] = this.frame.db(i);
    }
  }
  getFloatTimeDomainData(out: Float32Array) {
    for (let i = 0; i < out.length; i++) {
      out[i] = this.frame.signal(i);
    }
  }
}

const extractor = () => {
  const lo = new FakeAnalyser(256);
  const hi = new FakeAnalyser(8192);
  const fx = new FeatureExtractor(lo as unknown as AnalyserNode, hi as unknown as AnalyserNode);
  const show = (frame: Frame) => {
    hi.frame = frame;
    lo.frame = frame;
    return fx.read();
  };
  return { show, lo };
};

/** A spectrum with one peak `width` bins wide at `hz`, on a floor far below every threshold. */
const tone =
  (hz: number, level = -20) =>
  (i: number) =>
    Math.abs(i - hz / BIN_HZ) < 0.6 ? level : -140;
const sine = (amp: number) => (i: number) => amp * Math.sin((2 * Math.PI * 440 * i) / RATE);

describe('FeatureExtractor', () => {
  it('reads silence as silence', () => {
    const { show } = extractor();
    const f = show({ db: () => -140, signal: () => 0 });
    expect(f.volume).toBe(0);
    expect(f.peakHz).toBe(0);
    expect(f.centroidHz).toBe(0);
    expect(f.centroid).toBe(0);
    expect(Array.from(f.chroma)).toEqual(new Array(12).fill(0));
    expect(f.scope).toHaveLength(2048);
  });

  it('finds the pitch, pitch class and centroid of a single tone', () => {
    const { show } = extractor();
    const hz = 100 * BIN_HZ; // exactly on a bin
    const f = show({ db: tone(hz), signal: sine(0.5) });
    expect(f.peakHz).toBeCloseTo(hz, 5);
    expect(f.centroidHz).toBeCloseTo(hz, 5);
    expect(f.centroid).toBeCloseTo(Math.log2(hz / 100) / Math.log2(80), 5);
    const loudest = f.chroma.indexOf(Math.max(...f.chroma));
    expect(PITCH_NAMES[loudest]).toBe('D'); // 585.9 Hz is a few cents under D5
    expect(Math.max(...f.chroma)).toBe(1);
  });

  it('refines a peak between bins with a parabola', () => {
    const { show } = extractor();
    const centre = 200;
    const f = show({
      db: (i) => (Math.abs(i - centre) <= 1 ? -20 - 3 * (i - centre) * (i - centre) + (i - centre) : -140),
      signal: () => 0,
    });
    expect(f.peakHz).toBeGreaterThan(centre * BIN_HZ);
    expect(f.peakHz).toBeLessThan((centre + 0.5) * BIN_HZ);
  });

  it('pulls the centroid up as treble is added', () => {
    const { show } = extractor();
    const low = show({ db: tone(200), signal: () => 0 }).centroidHz;
    const both = show({ db: (i) => Math.max(tone(200)(i), tone(4000)(i)), signal: () => 0 }).centroidHz;
    expect(both).toBeGreaterThan(low);
    expect(both).toBeLessThan(4000);
  });

  it('maps the RMS level from -60..0 dBFS onto 0..1', () => {
    const { show } = extractor();
    expect(show({ db: () => -140, signal: () => 1 }).volume).toBe(1);
    expect(show({ db: () => -140, signal: (i) => (i % 2 ? 0.01 : -0.01) }).volume).toBeCloseTo(1 / 3, 5);
    expect(show({ db: () => -140, signal: () => 1e-5 }).volume).toBe(0);
  });

  it('counts only rising bins as flux, and caps it at 1', () => {
    const { show } = extractor();
    const quiet = { db: () => -140, signal: () => 0, loBytes: 0 };
    const loud = { ...quiet, loBytes: 255 };
    expect(show(quiet).flux).toBe(0);
    expect(show(loud).flux).toBe(1);
    expect(show(loud).flux).toBe(0);
    expect(show(quiet).flux).toBe(0);
  });

  it('splits band levels at 250 Hz and 4 kHz', () => {
    const { show } = extractor();
    const f = show({ db: (i) => (i * BIN_HZ < 250 ? -30 : -100), signal: () => 0 });
    expect(f.bass).toBeGreaterThan(0.9);
    expect(f.mid).toBeLessThan(0.05);
    expect(f.treble).toBe(0);
  });
});

describe('chroma', () => {
  it('splits a tone between the two nearest pitch classes', () => {
    const { show } = extractor();
    const a4 = show({ db: tone(440), signal: () => 0 }).chroma;
    expect(PITCH_NAMES[a4.indexOf(1)]).toBe('A');
    const fifth = show({ db: (i) => Math.max(tone(440)(i), tone(660, -30)(i)), signal: () => 0 }).chroma;
    expect(fifth[PITCH_NAMES.indexOf('E')]).toBeGreaterThan(0.1);
    expect(fifth[PITCH_NAMES.indexOf('E')]).toBeLessThan(1);
  });

  it('ignores a peak under the chroma floor', () => {
    const { show } = extractor();
    expect(Math.max(...show({ db: tone(440, -80), signal: () => 0 }).chroma)).toBe(0);
  });
});

describe('createAnalysers', () => {
  it('feeds two analysers from one source', () => {
    const made: FakeAnalyser[] = [];
    const ctx = {
      createAnalyser: () => {
        const a = new FakeAnalyser(0);
        made.push(a);
        return a;
      },
    };
    const targets: unknown[] = [];
    const source = { connect: (to: unknown) => targets.push(to) };
    const { lo, hi } = createAnalysers(ctx as unknown as AudioContext, source as unknown as AudioNode);
    expect(lo.fftSize).toBe(256);
    expect(hi.fftSize).toBe(8192);
    expect(targets).toEqual(made);
  });

  it('starts from silent features', () => {
    const f = silentFeatures();
    expect(f.sampleRate).toBe(44_100);
    expect(f.fft).toHaveLength(128);
  });
});
