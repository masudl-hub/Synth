import { afterEach, describe, expect, it, vi } from 'vitest';
import { withPalette } from './palette.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('withPalette', () => {
  it('adds a palette hint to a plain text request', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(withPalette('  a slow piece  ', false)).toBe(
      'a slow piece\n\nPalette hint: root C (about 130.8 Hz in the low-mid register), major scale, sparse and spacious, clean and glassy timbre, around 60 bpm.',
    );
  });

  it('picks across the whole palette', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    expect(withPalette('x', false)).toContain('root B (about 246.9 Hz');
    expect(withPalette('x', false)).toContain('Hirajoshi scale');
    expect(withPalette('x', false)).toContain('around 160 bpm');
  });

  it('leaves media requests and empty text alone', () => {
    expect(withPalette('with a picture', true)).toBe('with a picture');
    expect(withPalette('   ', false)).toBe('   ');
  });
});
