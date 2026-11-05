import { describe, expect, it } from 'vitest';
import { DEFAULT_PATCH } from './defaultPatch.ts';
import { focusPart, normalizePatch, oneSound } from './patch.ts';
import { PORCELAIN_BEATS } from './porcelainBeats.ts';

const sound = {
  oscillator: { type: 'sawtooth' as const, detune: 7, fmAmount: 40 },
  filter: { type: 'lowpass' as const, frequency: 900, q: 3 },
  envelope: { attack: 0.02, decay: 0.2, sustain: 0.5, release: 0.3 },
};

/** A patch as an LLM might send it: wrong types, out of range, missing and null fields. */
const messy = {
  name: '',
  bpm: '999',
  totalSteps: 64.7,
  swing: 3,
  drive: null,
  lead: {
    oscillator: {
      type: 'kazoo',
      detune: 500,
      fmAmount: '30',
      fmRatio: 0,
      fmWave: 'bell',
      fmDecay: null,
      layer: { type: 'organ', octave: 1.6, detune: -300, mix: '' },
    },
    sub: 3,
    level: null,
    glide: -1,
    lfo: { target: 'wobble', rate: 0, depth: 2 },
    filter: { type: 'notch', frequency: 'loud', q: 40, envAmount: -9, slope: 20, accent: null },
    envelope: { attack: -1, decay: 0, sustain: 2, release: 'x' },
  },
  drums: [{ type: 'cowbell', startStep: 2.9, velocity: 0 }, { type: 'kick' }],
  delay: { time: 9, feedback: 1, mix: -1 },
  reverb: { decay: 0, mix: 2, tone: null },
  melody: [{ freq: 'x', startStep: '3.5', durationSteps: 999, velocity: '', slide: 'yes' }, { slide: true }],
  bassline: 'none',
};

describe('normalizePatch', () => {
  it('fills and clamps every field of an untrusted patch', () => {
    expect(normalizePatch(messy)).toMatchSnapshot();
  });

  it('gives defaults for nothing at all', () => {
    expect(normalizePatch(undefined)).toMatchSnapshot();
    expect(normalizePatch('nonsense')).toEqual(normalizePatch({}));
  });

  it('plays one part for both when only one is given', () => {
    const onlyBass = normalizePatch({ bass: sound });
    expect(onlyBass.lead).toEqual(onlyBass.bass);
  });

  it('changes nothing in a normalized patch', () => {
    for (const raw of [messy, DEFAULT_PATCH, PORCELAIN_BEATS, {}]) {
      const once = normalizePatch(raw);
      expect(normalizePatch(once)).toEqual(once);
    }
  });

  it('splits an old single-sound patch into a lead and a bass, moving glide to the part', () => {
    const old = normalizePatch({
      name: 'Old',
      oscillator: { ...sound.oscillator, glide: 0.2 },
      filter: sound.filter,
      envelope: sound.envelope,
      lfo: { target: 'pitch', rate: 4, depth: 0.2 },
    });
    expect(old.lead.sub).toBe(0);
    expect(old.lead.oscillator.detune).toBe(7);
    expect(old.lead.glide).toBe(0.2);
    expect(old.bass.sub).toBe(1);
    expect(old.bass.oscillator.detune).toBe(0);
    expect(old.bass.lfo).toEqual({ target: 'pitch', rate: 4, depth: 0.2 });
    expect(old).toMatchSnapshot();
  });

  it('migrates an old patch with a null glide, or only a filter', () => {
    expect(normalizePatch({ oscillator: { type: 'square', glide: null } }).lead.glide).toBeUndefined();
    expect(normalizePatch({ filter: { frequency: 300 } }).bass.filter.frequency).toBe(300);
    expect(normalizePatch({ envelope: { attack: 1 } }).lead.envelope.attack).toBe(1);
  });

  it('keeps the shipped patches as they were written', () => {
    expect(normalizePatch(DEFAULT_PATCH)).toMatchSnapshot();
    expect(normalizePatch(PORCELAIN_BEATS)).toMatchSnapshot();
  });
});

describe('oneSound', () => {
  it('puts the sub on the bass only and drops its detune', () => {
    const { lead, bass } = oneSound(sound);
    expect(lead).toEqual({ ...sound, sub: 0 });
    expect(bass).toEqual({ ...sound, sub: 1, oscillator: { ...sound.oscillator, detune: 0 } });
  });
});

describe('focusPart', () => {
  it('is the lead unless there is no melody', () => {
    const patch = normalizePatch({});
    expect(focusPart(patch)).toBe('bass');
    expect(focusPart({ ...patch, melody: [{ freq: 1, startStep: 0, durationSteps: 1 }] })).toBe('lead');
  });
});
