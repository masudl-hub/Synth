import { describe, expect, it } from 'vitest';
import { silentFeatures } from './analysis.ts';
import { demoFeatures } from './demo.ts';

describe('demoFeatures', () => {
  it('draws a soft A: its pitch, its pitch class and a spectrum peak near 220 Hz', () => {
    const f = demoFeatures(0);
    expect(f.peakHz).toBeCloseTo(220);
    expect(f.chroma[9]).toBe(1);
    expect(f.chroma[4]).toBeCloseTo(0.24);
    const loudest = f.fft.indexOf(Math.max(...f.fft));
    expect(loudest).toBe(Math.round(220 / (44_100 / 2 / 128)));
    expect(f.centroid).toBeGreaterThan(0);
    expect(f.centroid).toBeLessThan(1);
  });

  it('keeps every sample in range as it moves, and fills the frame it is given', () => {
    const out = silentFeatures();
    for (const t of [0, 1.3, 7.9, 120]) {
      expect(demoFeatures(t, out)).toBe(out);
      expect(Math.max(...out.scope.map(Math.abs))).toBeLessThanOrEqual(0.3);
      expect(Math.max(...out.waveform)).toBeLessThanOrEqual(255);
      expect(Math.min(...out.waveform)).toBeGreaterThanOrEqual(0);
    }
  });
});
