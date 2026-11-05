import { describe, expect, it } from 'vitest';
import { type EnvelopeNote, type EnvelopeParam, extendEnvelope, scheduleEnvelope } from './envelope.ts';

/** An exponential ramp to a small level (above the floor) at the cut-off, 1.1 s. */
const CUT_DECAY = /^exp\(0\.0[0-9]+, 1\.1\)$/u;

interface Event {
  kind: 'set' | 'linear' | 'exp';
  value: number;
  time: number;
}

/** Plays back automation the way Web Audio does, so a test can read the level at any moment. */
class Automation implements EnvelopeParam {
  events: Event[] = [];
  calls: string[] = [];
  private add(kind: Event['kind'], value: number, time: number) {
    this.calls.push(`${kind}(${Number(value.toPrecision(10))}, ${Number(time.toPrecision(10))})`);
    this.events.push({ kind, value, time });
    this.events.sort((a, b) => a.time - b.time);
    return this as unknown as AudioParam;
  }
  setValueAtTime(value: number, time: number) {
    return this.add('set', value, time);
  }
  linearRampToValueAtTime(value: number, time: number) {
    return this.add('linear', value, time);
  }
  exponentialRampToValueAtTime(value: number, time: number) {
    return this.add('exp', value, time);
  }
  cancelScheduledValues(time: number) {
    this.calls.push(`cancel(${time})`);
    this.events = this.events.filter((e) => e.time < time);
    return this as unknown as AudioParam;
  }
  valueAt(t: number) {
    let prev: Event = { kind: 'set', value: 0, time: 0 };
    for (const e of this.events) {
      if (e.time <= t) {
        prev = e;
        continue;
      }
      if (e.kind === 'set') {
        return prev.value;
      }
      const f = (t - prev.time) / (e.time - prev.time);
      return e.kind === 'linear' ? prev.value + (e.value - prev.value) * f : prev.value * (e.value / prev.value) ** f;
    }
    return prev.value;
  }
}

const shape = { attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.25 };
const note = (over: Partial<EnvelopeNote> = {}): EnvelopeNote => ({
  time: 1,
  duration: 0.5,
  shape,
  peak: 0.5,
  ...over,
});

/** The largest step between neighbouring samples across the window, in units of `peak`. */
const biggestJump = (a: Automation, from: number, to: number) => {
  let worst = 0;
  let last = a.valueAt(from);
  for (let t = from; t <= to; t += 0.0001) {
    const v = a.valueAt(t);
    worst = Math.max(worst, Math.abs(v - last));
    last = v;
  }
  return worst;
};

describe('scheduleEnvelope', () => {
  it('rises, decays to sustain, holds and releases to silence', () => {
    const a = new Automation();
    scheduleEnvelope(a, note());
    expect(a.calls).toEqual([
      'set(0, 1)',
      'linear(0.5, 1.02)',
      'exp(0.2, 1.32)',
      'set(0.2, 1.5)',
      'exp(0.001, 1.75)',
      'linear(0, 1.76)',
    ]);
    expect(a.valueAt(1.4)).toBeCloseTo(0.2);
    expect(a.valueAt(2)).toBe(0);
  });

  it('cuts a note shorter than its attack mid-rise', () => {
    const a = new Automation();
    scheduleEnvelope(a, note({ duration: 0.01 }));
    expect(a.calls.slice(0, 2)).toEqual(['set(0, 1)', 'linear(0.25, 1.01)']);
  });

  it('cuts a note shorter than attack plus decay mid-decay, never below the floor', () => {
    const a = new Automation();
    scheduleEnvelope(a, note({ duration: 0.1, shape: { ...shape, sustain: 0 } }));
    expect(a.calls[2]).toMatch(CUT_DECAY);
    expect(biggestJump(a, 1, 1.5)).toBeLessThan(0.01);
  });
});

describe('extendEnvelope', () => {
  it('holds a note in its sustain without moving the level', () => {
    const a = new Automation();
    scheduleEnvelope(a, note());
    const before = a.valueAt(1.4);
    expect(extendEnvelope(a, note(), 1.4, 1)).toBeCloseTo(1.4);
    expect(a.valueAt(1.4)).toBeCloseTo(before);
    expect(a.valueAt(2.3)).toBeCloseTo(0.2);
    expect(biggestJump(a, 1, 3)).toBeLessThan(0.01);
  });

  it('joins a note mid-attack and mid-decay with no jump', () => {
    for (const at of [1.01, 1.1]) {
      const a = new Automation();
      scheduleEnvelope(a, note());
      extendEnvelope(a, note(), at, 0.5);
      expect(biggestJump(a, 1, 2.5)).toBeLessThan(0.01);
    }
  });

  it('eases back up from a release that had begun', () => {
    const a = new Automation();
    scheduleEnvelope(a, note());
    const total = extendEnvelope(a, note(), 1.6, 0.5);
    expect(total).toBeCloseTo(1.1);
    expect(a.valueAt(1.6)).toBeLessThan(0.2);
    expect(a.valueAt(1.9)).toBeCloseTo(0.2);
    expect(biggestJump(a, 1, 3)).toBeLessThan(0.01);
  });

  it('refuses a note that has gone silent or not yet begun', () => {
    const a = new Automation();
    expect(extendEnvelope(a, note(), 1.8, 0.5)).toBeNull();
    expect(extendEnvelope(a, note(), 1, 0.5)).toBeNull();
    expect(extendEnvelope(a, note(), 5, 0.5)).toBeNull();
    expect(a.calls).toEqual([]);
  });
});
