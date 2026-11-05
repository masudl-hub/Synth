import { describe, expect, it } from 'vitest';
import { silentFeatures } from '../audio/analysis.ts';
import type { AudioFeatures, Point } from '../types.ts';
import { legendre, simulations } from './logic.ts';

interface Call {
  name: string;
  args: unknown[];
}

/** happy-dom's canvas has no 2D context, so a Proxy stands in: every method call and property set is recorded. */
const fakeContext = (bare: boolean) => {
  const calls: Call[] = [];
  const store: Record<string | symbol, unknown> = { canvas: { dataset: bare ? { bare: '1' } : {} } };
  const ctx = new Proxy(store, {
    get: (target, key) => {
      if (key in target) {
        return target[key];
      }
      return (...args: unknown[]) => {
        calls.push({ name: String(key), args });
      };
    },
    set: (target, key, value) => {
      target[key] = value;
      calls.push({ name: `=${String(key)}`, args: [value] });
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
};

const FS = 44_100;

/** Every band busy, a clear pitch, a strong onset: drives the audio-gated branches. */
const loudFeatures = (centroid: number): AudioFeatures => {
  const audio = silentFeatures(FS);
  audio.volume = 0.8;
  audio.bass = 0.9;
  audio.mid = 0.7;
  audio.treble = 0.8;
  audio.centroid = centroid;
  audio.centroidHz = 2000;
  audio.flux = 0.9;
  audio.peakHz = 440;
  for (let i = 0; i < audio.scope.length; i++) {
    audio.scope[i] = 0.8 * Math.sin((2 * Math.PI * 440 * i) / FS);
  }
  for (let i = 0; i < audio.waveform.length; i++) {
    audio.waveform[i] = Math.round(128 + 127 * Math.sin(i / 4));
  }
  for (let i = 0; i < audio.fft.length; i++) {
    audio.fft[i] = (i * 37) % 256;
  }
  audio.chroma.fill(0.3);
  audio.chroma[9] = 1;
  return audio;
};

const WIDTH = 480;
const HEIGHT = 320;
const MOUSE_IN: Point = { x: WIDTH / 2, y: HEIGHT / 2 };
const MOUSE_OUT: Point = { x: -5000, y: -5000 };

const numbersIn = (calls: Call[]) => calls.flatMap((c) => c.args.filter((a) => typeof a === 'number'));

const run = (draw: (typeof simulations)[number]['draw'], audio: AudioFeatures, mouse: Point, bare: boolean) => {
  const { ctx, calls } = fakeContext(bare);
  for (let frame = 0; frame < 4; frame++) {
    draw({ ctx, width: WIDTH, height: HEIGHT, time: frame * 0.016, mouse, isHovered: mouse === MOUSE_IN, audio });
  }
  return calls;
};

describe('legendre', () => {
  it('matches the closed forms of the low associated Legendre functions', () => {
    for (const x of [-1, -0.6, 0, 0.3, 0.5, 1]) {
      const s = Math.sqrt(1 - x * x);
      expect(legendre(0, 0, x)).toBeCloseTo(1);
      expect(legendre(1, 0, x)).toBeCloseTo(x);
      expect(legendre(2, 0, x)).toBeCloseTo((3 * x * x - 1) / 2);
      expect(legendre(3, 0, x)).toBeCloseTo((5 * x ** 3 - 3 * x) / 2);
      // No Condon–Shortley phase.
      expect(legendre(1, 1, x)).toBeCloseTo(s);
      expect(legendre(2, 1, x)).toBeCloseTo(3 * x * s);
      expect(legendre(2, 2, x)).toBeCloseTo(3 * (1 - x * x));
      expect(legendre(4, 2, x)).toBeCloseTo((15 / 2) * (7 * x * x - 1) * (1 - x * x));
    }
  });
});

describe('simulations', () => {
  it('lists thirteen drawings with unique ids', () => {
    expect(simulations).toHaveLength(13);
    expect(new Set(simulations.map((s) => s.id)).size).toBe(13);
  });

  const cases = [
    { label: 'silent', audio: () => silentFeatures(FS) },
    { label: 'loud, dark', audio: () => loudFeatures(0.1) },
    { label: 'loud, bright', audio: () => loudFeatures(1) },
  ];

  for (const sim of simulations) {
    describe(sim.title, () => {
      for (const { label, audio } of cases) {
        for (const [where, mouse] of [
          ['inside', MOUSE_IN],
          ['outside', MOUSE_OUT],
        ] as const) {
          it(`draws finite shapes and its formula, ${label}, mouse ${where}`, () => {
            const calls = run(sim.draw, audio(), mouse, false);
            expect(calls.length).toBeGreaterThan(0);
            for (const n of numbersIn(calls)) {
              expect(Number.isFinite(n)).toBe(true);
            }
            expect(calls.some((c) => c.name === 'fillText' && c.args[0] === sim.formula)).toBe(true);
          });
        }
      }

      it('draws the shapes alone when bare', () => {
        const calls = run(sim.draw, loudFeatures(0.5), MOUSE_IN, true);
        expect(calls.some((c) => c.name === 'fillText' && c.args[0] === sim.formula)).toBe(false);
        for (const n of numbersIn(calls)) {
          expect(Number.isFinite(n)).toBe(true);
        }
      });
    });
  }

  it('keeps the Lorenz trail on the attractor, near the tile', () => {
    const lorenz = simulations.find((s) => s.id === 13);
    expect(lorenz).toBeDefined();
    const audio = loudFeatures(0.5);
    const { ctx, calls } = fakeContext(false);
    for (let frame = 0; frame < 200; frame++) {
      lorenz?.draw({ ctx, width: WIDTH, height: HEIGHT, time: frame * 0.1, mouse: MOUSE_OUT, isHovered: false, audio });
    }
    // Clock running backwards adds no steps.
    lorenz?.draw({ ctx, width: WIDTH, height: HEIGHT, time: 0, mouse: MOUSE_OUT, isHovered: false, audio });
    const path = calls.filter((c) => c.name === 'lineTo' || c.name === 'moveTo');
    expect(path.length).toBeGreaterThan(0);
    for (const n of numbersIn(path)) {
      expect(Math.abs(n)).toBeLessThan(WIDTH * 4);
    }
  });

  it('rebuilds the fluid grid when the tile changes size', () => {
    const fluid = simulations.find((s) => s.id === 10);
    const { ctx, calls } = fakeContext(false);
    const audio = loudFeatures(0.5);
    for (const [width, height] of [
      [WIDTH, HEIGHT],
      [200, 150],
    ]) {
      calls.length = 0;
      fluid?.draw({ ctx, width, height, time: 0, mouse: { x: width / 2, y: height / 2 }, isHovered: true, audio });
      fluid?.draw({ ctx, width, height, time: 0.016, mouse: { x: width / 3, y: height / 3 }, isHovered: true, audio });
      const rects = calls.filter((c) => c.name === 'fillRect');
      expect(rects.length).toBeGreaterThan(0);
      for (const n of numbersIn(rects)) {
        expect(Number.isFinite(n)).toBe(true);
      }
    }
  });
});
