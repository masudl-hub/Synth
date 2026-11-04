const pick = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];

const ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const SCALES = [
  'major', 'natural minor', 'harmonic minor', 'Dorian', 'Mixolydian', 'Lydian', 'Phrygian', 'Phrygian dominant',
  'major pentatonic', 'minor pentatonic', 'blues', 'whole-tone', 'octatonic', 'Hirajoshi',
] as const;
const FEELS = [
  'sparse and spacious', 'long held notes', 'straight and steady', 'syncopated', 'swung', 'driving and dense',
] as const;
const TIMBRES = [
  'clean and glassy', 'warm and soft', 'bright and plucky', 'hollow and woody', 'gritty and driven', 'bell-like and inharmonic',
] as const;

const hz = (note: (typeof ROOTS)[number]) => 130.81 * Math.pow(2, ROOTS.indexOf(note) / 12);

/** A random key, scale, feel, timbre and tempo to start a new piece from, so open requests don't all land in one place. */
export const paletteHint = () => {
  const root = pick(ROOTS);
  const bpm = 60 + 10 * Math.floor(Math.random() * 11);
  return `Palette hint: root ${root} (about ${hz(root).toFixed(1)} Hz in the low-mid register), ${pick(SCALES)} scale, ${pick(FEELS)}, ${pick(TIMBRES)} timbre, around ${bpm} bpm.`;
};

/**
 * The text a pure-text request goes out with. A picture or a voice note already carries its own
 * direction, so those go unchanged.
 */
export const withPalette = (text: string, hasMedia: boolean) =>
  hasMedia || !text.trim() ? text : `${text.trim()}\n\n${paletteHint()}`;
