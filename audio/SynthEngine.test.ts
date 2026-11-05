import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Instrument, SynthPatch } from '../types.ts';
import { SynthEngine } from './SynthEngine.ts';

const GAIN_DISCONNECT = /^gain\d+\.disconnect\(\)$/u;

/** Every call the engine makes on the fake graph, in order, as `node.method(args)`. */
let log: string[] = [];
let ids = 0;
const clock = { now: 0, state: 'running' as AudioContextState };

const show = (v: unknown): string => {
  if (typeof v === 'number') {
    return String(Number(v.toPrecision(10)));
  }
  if (v instanceof Float32Array) {
    return `f32[${v.length}:${Array.from(v.slice(0, 4), show).join(',')}]`;
  }
  if (v instanceof FakeNode || v instanceof FakeParam) {
    return v.id;
  }
  return String(v);
};
const record = (target: string, method: string, args: unknown[]) => {
  log.push(`${target}.${method}(${args.map(show).join(', ')})`);
};

class FakeParam {
  readonly id: string;
  private current = 0;
  constructor(id: string) {
    this.id = id;
  }
  get value() {
    return this.current;
  }
  set value(v: number) {
    this.current = v;
    record(this.id, 'value=', [v]);
  }
  setValueAtTime(...args: number[]) {
    record(this.id, 'set', args);
  }
  linearRampToValueAtTime(...args: number[]) {
    record(this.id, 'linear', args);
  }
  exponentialRampToValueAtTime(...args: number[]) {
    record(this.id, 'exp', args);
  }
  setTargetAtTime(...args: number[]) {
    record(this.id, 'target', args);
  }
  cancelScheduledValues(...args: number[]) {
    record(this.id, 'cancel', args);
  }
}

class FakeNode {
  readonly id: string;
  readonly gain: FakeParam;
  readonly frequency: FakeParam;
  readonly detune: FakeParam;
  readonly Q: FakeParam;
  readonly offset: FakeParam;
  readonly pan: FakeParam;
  readonly delayTime: FakeParam;
  onended: (() => void) | null = null;
  fftSize = 0;
  smoothingTimeConstant = 0;
  readonly context = { sampleRate: 48_000 };
  constructor(kind: string) {
    ids += 1;
    this.id = `${kind}${ids}`;
    this.gain = new FakeParam(`${this.id}.gain`);
    this.frequency = new FakeParam(`${this.id}.frequency`);
    this.detune = new FakeParam(`${this.id}.detune`);
    this.Q = new FakeParam(`${this.id}.Q`);
    this.offset = new FakeParam(`${this.id}.offset`);
    this.pan = new FakeParam(`${this.id}.pan`);
    this.delayTime = new FakeParam(`${this.id}.delayTime`);
  }
  get frequencyBinCount() {
    return this.fftSize / 2;
  }
  set type(v: string) {
    record(this.id, 'type=', [v]);
  }
  set oversample(v: string) {
    record(this.id, 'oversample=', [v]);
  }
  set curve(v: Float32Array | null) {
    record(this.id, 'curve=', [v]);
  }
  set buffer(v: { length: number } | null) {
    record(this.id, 'buffer=', [v ? v.length : null]);
  }
  connect(to: FakeNode | FakeParam) {
    record(this.id, 'connect', [to]);
  }
  disconnect() {
    record(this.id, 'disconnect', []);
  }
  start(...args: number[]) {
    record(this.id, 'start', args);
  }
  stop(...args: number[]) {
    record(this.id, 'stop', args);
  }
  setPeriodicWave(wave: { id: string }) {
    record(this.id, 'setPeriodicWave', [wave.id]);
  }
  getByteFrequencyData(out: Uint8Array) {
    out.fill(0);
  }
  getByteTimeDomainData(out: Uint8Array) {
    out.fill(128);
  }
  getFloatFrequencyData(out: Float32Array) {
    out.fill(-120);
  }
  getFloatTimeDomainData(out: Float32Array) {
    out.fill(0);
  }
}

class FakeContext {
  readonly sampleRate = 48_000;
  readonly destination = new FakeNode('dest');
  get currentTime() {
    return clock.now;
  }
  get state() {
    return clock.state;
  }
  createGain() {
    return new FakeNode('gain');
  }
  createOscillator() {
    return new FakeNode('osc');
  }
  createBiquadFilter() {
    return new FakeNode('filter');
  }
  createDelay(max: number) {
    record('ctx', 'createDelay', [max]);
    return new FakeNode('delay');
  }
  createConvolver() {
    return new FakeNode('convolver');
  }
  createWaveShaper() {
    return new FakeNode('shaper');
  }
  createAnalyser() {
    return new FakeNode('analyser');
  }
  createConstantSource() {
    return new FakeNode('const');
  }
  createStereoPanner() {
    return new FakeNode('pan');
  }
  createBufferSource() {
    return new FakeNode('src');
  }
  createBuffer(channels: number, length: number, rate: number) {
    record('ctx', 'createBuffer', [channels, length, rate]);
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { length, getChannelData: (c: number) => data[c] };
  }
  createPeriodicWave(_real: Float32Array, imag: Float32Array) {
    ids += 1;
    const id = `wave${ids}`;
    record('ctx', 'createPeriodicWave', [imag]);
    return { id };
  }
  close() {
    record('ctx', 'close', []);
    return Promise.resolve();
  }
  resume() {
    record('ctx', 'resume', []);
    return Promise.resolve();
  }
}

const instrument = (over: Partial<Instrument> = {}): Instrument => ({
  oscillator: { type: 'sawtooth', detune: 0, fmAmount: 0 },
  filter: { type: 'lowpass', frequency: 1200, q: 4 },
  envelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.2 },
  ...over,
});

const basePatch = (over: Partial<SynthPatch> = {}): SynthPatch => ({
  name: 'Test',
  description: 'A test patch',
  bpm: 120,
  totalSteps: 16,
  lead: instrument(),
  bass: instrument(),
  melody: [],
  bassline: [],
  ...over,
});

/** Runs the scheduler the way a browser would: the clock moves on 25 ms between timer ticks. */
const run = (seconds: number) => {
  const ticks = Math.round(seconds / 0.025);
  for (let i = 0; i < ticks; i++) {
    clock.now += 0.025;
    vi.advanceTimersByTime(25);
  }
};

let engines: SynthEngine[] = [];
const engine = (silent = false) => {
  const e = new SynthEngine(silent);
  engines.push(e);
  return e;
};

beforeEach(() => {
  log = [];
  ids = 0;
  clock.now = 0;
  clock.state = 'running';
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(0.75);
  vi.stubGlobal('AudioContext', FakeContext);
});

afterEach(() => {
  for (const e of engines) {
    e.dispose();
  }
  engines = [];
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('SynthEngine graph', () => {
  it('builds the master chain', () => {
    engine();
    expect(log).toMatchSnapshot();
  });

  it('mutes the speakers when silent, and reports features', () => {
    const e = engine(true);
    expect(log.filter((l) => l.includes('dest'))).toHaveLength(1);
    vi.advanceTimersByTime(16);
    expect(e.audioData.volume).toBe(0);
    expect(e.isRunning).toBe(true);
  });
});

describe('SynthEngine patches', () => {
  it('loads effects, drive and the room', () => {
    const e = engine();
    log = [];
    e.loadPatch(
      basePatch({
        drive: 0.5,
        delay: { time: 0.25, feedback: 0.4, mix: 0.3 },
        reverb: { decay: 1.5, mix: 0.4, tone: 0.8 },
      }),
    );
    expect(log).toMatchSnapshot();
  });

  it('turns the sends off when a patch has none', () => {
    const e = engine();
    log = [];
    e.loadPatch(basePatch({ reverb: { decay: Number.NaN, mix: 0.2 } }));
    e.loadPatch(basePatch({ delay: undefined, reverb: undefined }));
    expect(log).toMatchSnapshot();
  });
});

describe('SynthEngine voices', () => {
  it('plays a full lead: detune, sub, steady FM, 24 dB slope, accent, filter LFO, slide hold and chord', () => {
    const e = engine();
    e.loadPatch(
      basePatch({
        swing: 0.2,
        lead: instrument({
          oscillator: { type: 'sawtooth', detune: 10, fmAmount: 30, fmRatio: 2 },
          sub: 0.5,
          glide: 0.1,
          filter: { type: 'lowpass', frequency: 1200, q: 6, envAmount: 2, slope: 24, accent: 0.5 },
          lfo: { target: 'filter', rate: 3, depth: 0.5 },
        }),
        melody: [
          { freq: 220, startStep: 0, durationSteps: 4, velocity: 0.8 },
          { freq: 330, startStep: 2, durationSteps: 2, slide: true },
          { freq: 440, startStep: 3, durationSteps: 2, slide: true },
          { freq: 262, startStep: 8, durationSteps: 2 },
          { freq: 330, startStep: 8, durationSteps: 2, slide: true },
        ],
      }),
    );
    log = [];
    e.start();
    e.start();
    run(1.5);
    expect(log).toMatchSnapshot();
  });

  it('plays a bass: bandpass 24 dB, decaying FM, pitch LFO, layer, and a slide after the note stopped', () => {
    const e = engine();
    e.loadPatch(
      basePatch({
        bass: instrument({
          oscillator: {
            type: 'square',
            detune: 0,
            fmAmount: 20,
            fmWave: 'sine',
            fmDecay: 0.3,
            layer: { type: 'triangle', octave: -1, detune: 5, mix: 0.5 },
          },
          level: 0.8,
          filter: { type: 'bandpass', frequency: 600, q: 2, slope: 24 },
          lfo: { target: 'pitch', rate: 5, depth: 0.3 },
        }),
        bassline: [
          { freq: 110, startStep: 0, durationSteps: 1 },
          { freq: 82.41, startStep: 6, durationSteps: 1, slide: true },
        ],
      }),
    );
    log = [];
    e.start();
    run(1.25);
    expect(log).toMatchSnapshot();
  });

  it('plays bell, organ and pulse waves, an amp LFO and a layer out of range', () => {
    const e = engine();
    e.loadPatch(
      basePatch({
        totalSteps: 0,
        lead: instrument({
          oscillator: {
            type: 'bell',
            detune: 0,
            fmAmount: 0,
            layer: { type: 'organ', octave: 2, detune: 0, mix: 1 },
          },
          filter: { type: 'highpass', frequency: 300, q: Number.NaN },
          lfo: { target: 'amp', rate: 2, depth: 0.6 },
        }),
        bass: instrument({
          oscillator: { type: 'pulse', detune: 0, fmAmount: 0, layer: { type: 'organ', octave: 0, detune: 0, mix: 0 } },
          filter: { type: 'bandpass', frequency: 500, q: 1, envAmount: -1 },
        }),
        melody: [
          { freq: 523.25, startStep: 0, durationSteps: 2 },
          { freq: 5000, startStep: 2, durationSteps: 2 },
          { freq: 0, startStep: 4, durationSteps: 1 },
        ],
        bassline: [{ freq: 55, startStep: 1, durationSteps: 1 }],
      }),
    );
    log = [];
    e.start();
    run(0.75);
    vi.runOnlyPendingTimers();
    expect(log).toMatchSnapshot();
  });

  it('skips a part with no level', () => {
    const e = engine();
    e.loadPatch(basePatch({ lead: instrument({ level: 0 }), melody: [{ freq: 220, startStep: 0, durationSteps: 1 }] }));
    log = [];
    e.start();
    run(0.25);
    expect(log.some((l) => l.startsWith('osc'))).toBe(false);
  });

  it('wraps the loop at totalSteps', () => {
    const e = engine();
    e.loadPatch(basePatch({ totalSteps: 2, bpm: 240, melody: [{ freq: 220, startStep: 1, durationSteps: 1 }] }));
    log = [];
    e.start();
    run(0.5);
    expect(log.filter((l) => l.endsWith('.frequency.value=(220)')).length).toBeGreaterThan(1);
  });
});

describe('SynthEngine drums', () => {
  it('plays each kind of hit', () => {
    const e = engine();
    e.loadPatch(
      basePatch({
        drums: [
          { type: 'kick', startStep: 0 },
          { type: 'snare', startStep: 1, velocity: 0.5 },
          { type: 'clap', startStep: 2 },
          { type: 'hat', startStep: 3 },
        ],
      }),
    );
    log = [];
    e.start();
    run(0.5);
    vi.runOnlyPendingTimers();
    expect(log).toMatchSnapshot();
  });

  it('plays the onended cleanup', () => {
    const e = engine();
    e.loadPatch(basePatch({ drums: [{ type: 'kick', startStep: 0 }] }));
    const created: FakeNode[] = [];
    const ctx = FakeContext.prototype;
    const original = ctx.createOscillator;
    vi.spyOn(ctx, 'createOscillator').mockImplementation(function make(this: FakeContext) {
      const node = original.call(this);
      created.push(node);
      return node;
    });
    e.start();
    run(0.25);
    log = [];
    for (const node of created) {
      node.onended?.();
    }
    expect(created).toHaveLength(1);
    expect(log).toEqual([`${created[0]?.id}.disconnect()`, expect.stringMatching(GAIN_DISCONNECT)]);
  });
});

describe('SynthEngine controls', () => {
  it('sets volume, mute, tempo, waves, cutoffs and the sweep', async () => {
    const e = engine();
    e.setBPM(140);
    e.setOscillatorType('square', 'lead');
    e.setPatchFilterFreq(500, 'bass');
    const patch = basePatch();
    e.loadPatch(patch);
    log = [];
    e.setVolume(2);
    e.setMasterVolume(true);
    e.setVolume(0.5);
    e.setMasterVolume(false);
    e.setBPM(1000);
    expect(patch.bpm).toBe(300);
    e.setOscillatorType('square', 'lead');
    e.setPatchFilterFreq(500, 'bass');
    e.setFilterFreq(30_000);
    await e.resume();
    clock.state = 'suspended';
    await e.resume();
    e.stop();
    expect(log).toMatchSnapshot();
  });

  it('does nothing on start without a patch', () => {
    const e = engine();
    log = [];
    e.start();
    run(0.1);
    expect(log).toEqual([]);
  });
});
