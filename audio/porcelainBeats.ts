import { DrumEvent, NoteEvent, SynthPatch } from '../types';
import { oneSound } from './patch';

/** [freq Hz, startStep, durationSteps, velocity] */
type Row = [number, number, number, number];

const notes = (rows: Row[]): NoteEvent[] =>
  rows.map(([freq, startStep, durationSteps, velocity]) => ({ freq, startStep, durationSteps, velocity }));

const MELODY: Row[] = [
  [329.63, 0, 2, 0.9], [369.99, 2, 2, 0.7], [415.3, 4, 2, 0.8], [493.88, 6, 2, 1],
  [659.25, 8, 4, 1], [587.33, 12, 4, 0.85], [493.88, 16, 2, 0.8], [440, 18, 2, 0.7],
  [415.3, 20, 2, 0.85], [369.99, 22, 2, 0.75], [329.63, 24, 8, 0.95], [659.25, 32, 2, 1],
  [622.25, 34, 2, 0.8], [493.88, 36, 4, 0.9], [415.3, 40, 8, 0.85], [329.63, 48, 4, 0.9],
  [369.99, 52, 4, 0.8], [493.88, 56, 8, 1], [659.25, 64, 2, 1], [698.46, 66, 2, 0.9],
  [659.25, 68, 4, 0.85], [493.88, 72, 8, 0.9], [415.3, 80, 4, 0.8], [369.99, 84, 4, 0.75],
  [329.63, 88, 8, 0.9], [659.25, 96, 8, 1], [587.33, 104, 8, 0.85], [493.88, 112, 8, 0.9],
  [329.63, 120, 8, 1],
];

const BASS: Row[] = [
  [82.41, 0, 2, 1], [82.41, 3, 1, 0.7], [82.41, 4, 2, 1], [92.5, 8, 4, 0.9],
  [103.83, 16, 4, 1], [123.47, 24, 4, 0.9], [82.41, 32, 4, 1], [82.41, 38, 2, 0.7],
  [92.5, 40, 4, 0.9], [82.41, 48, 4, 1], [73.42, 56, 8, 0.85], [82.41, 64, 2, 1],
  [82.41, 67, 1, 0.7], [92.5, 72, 4, 0.9], [103.83, 80, 4, 1], [123.47, 88, 4, 0.9],
  [164.81, 96, 8, 1], [123.47, 104, 4, 0.85], [103.83, 112, 4, 0.9], [82.41, 120, 8, 1],
];

/** Eight bars: kick on the beat, a second kick on the 'and' of 3, hats between, snare on 2 and 4; every other bar ends with a clap, and the last bar pushes a little harder. */
const drumBars = (): DrumEvent[] => {
  const hits: DrumEvent[] = [];
  for (let bar = 0; bar < 8; bar++) {
    const o = bar * 16;
    const last = bar === 7;
    const fill = bar % 2 === 1;
    hits.push(
      { type: 'kick', startStep: o, velocity: 1 },
      { type: 'hat', startStep: o + 2, velocity: 0.6 },
      { type: 'snare', startStep: o + 4, velocity: 0.9 },
      { type: 'hat', startStep: o + 6, velocity: 0.6 },
      { type: 'kick', startStep: o + 8, velocity: 1 },
      { type: 'kick', startStep: o + 10, velocity: last ? 0.9 : 0.8 },
      { type: 'hat', startStep: o + 10, velocity: 0.6 },
      { type: 'snare', startStep: o + 12, velocity: fill || last ? 1 : 0.9 },
    );
    if (fill || last) hits.push({ type: 'clap', startStep: o + 12, velocity: last ? 0.9 : 0.8 });
    hits.push({ type: 'hat', startStep: o + 14, velocity: last ? 0.8 : 0.7 });
  }
  return hits;
};

export const PORCELAIN_BEATS: SynthPatch = {
  name: 'Porcelain Beats',
  description: 'Driving and dense E major sequence with Mixolydian D naturals, bell-like inharmonic FM and a punchy drum groove.',
  bpm: 127,
  totalSteps: 128,
  ...oneSound({
    oscillator: {
      type: 'sawtooth', detune: 8, fmAmount: 75, fmRatio: 5.19, fmWave: 'sine',
      layer: { type: 'square', octave: 1, detune: -5, mix: 0.3 },
    },
    lfo: { target: 'filter', rate: 5, depth: 0.25 },
    filter: { type: 'lowpass', frequency: 2200, q: 8, envAmount: 3 },
    envelope: { attack: 0.02, decay: 0.3, sustain: 0.2, release: 0.4 },
  }),
  drums: drumBars(),
  delay: { time: 0.3, feedback: 0.3, mix: 0 },
  reverb: { decay: 2.4, mix: 0.5, tone: 0.7 },
  melody: notes(MELODY),
  bassline: notes(BASS),
};
