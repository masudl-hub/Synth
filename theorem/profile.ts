import { defineProfile, geminiProvider, registerProvider, registerStructured } from '@theoremjs/agents';
import { z } from 'zod';

export const KEY_SLOT = 'gemini';
export const FALLBACK_KEY_SLOT = 'gemini-b';

// Generations per week: one browser (cookie) gets 10, and one IP gets 35 across all its browsers, so an
// office or VPN can share a connection while clearing cookies still can't run up the key.
export const WEEKLY_PER_BROWSER = 10;
export const WEEKLY_PER_IP = 35;

const PATCH_SCHEMA_ID = 'synth.patch';

const wave = z.enum(['sine', 'square', 'sawtooth', 'triangle', 'pulse', 'organ', 'bell']);

const note = z.object({
  freq: z.number().describe('Frequency in Hz, never a note name.'),
  startStep: z.number().int().min(0),
  durationSteps: z
    .number()
    .int()
    .min(1)
    .max(32)
    .describe('Sixteenth-note steps the note holds: 1 is a stab, 16 a bar, 32 two bars.'),
  velocity: z
    .number()
    .min(0.1)
    .max(1)
    .optional()
    .describe('How hard the note is played, 0.1 to 1. Omit for full level.'),
  slide: z
    .boolean()
    .optional()
    .describe(
      "Bend into this note from the part's previous note over the part's 'glide' time. If that note is still held when this one starts (it ends on or after this startStep), the two join legato: no new attack, no new filter sweep, and the first note's level carries on, as on a 303. Omit for a clean new note.",
    ),
});

const instrument = z.object({
  oscillator: z.object({
    type: wave,
    detune: z.number().min(-100).max(100),
    fmAmount: z.number(),
    fmRatio: z
      .number()
      .min(0.25)
      .max(8)
      .optional()
      .describe('Modulator frequency as a multiple of the note. 2 is the default.'),
    fmWave: wave
      .optional()
      .describe('Shape of the FM modulator. Sine is clean and bell-like. Omit to follow the carrier.'),
    fmDecay: z
      .number()
      .min(0)
      .max(8)
      .optional()
      .describe(
        'Seconds for the FM brightness to fade to a tenth within each note. 0.2 to 1 gives struck, bell or electric-piano tones. Omit to hold it.',
      ),
    layer: z
      .object({
        type: wave,
        octave: z.number().int().min(-2).max(2).describe('Octaves from the note: -1 is below, 1 is above.'),
        detune: z.number().min(-100).max(100),
        mix: z.number().min(0).max(1),
      })
      .optional()
      .describe('A second oscillator played under every note.'),
  }),
  sub: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe('Level of a sine an octave below each note, for weight. Omit for none.'),
  level: z.number().min(0).max(1).optional().describe("The part's level in the mix. Omit for full."),
  glide: z
    .number()
    .min(0)
    .max(2)
    .optional()
    .describe("Seconds a 'slide' note takes to bend to its pitch. Omit for 0.06."),
  lfo: z
    .object({
      target: z.enum(['filter', 'pitch', 'amp']),
      rate: z.number().min(0.05).max(20).describe('Hz. 0.1 to 0.5 is a slow drift, 4 to 7 a vibrato or wobble.'),
      depth: z.number().min(0).max(1),
    })
    .optional()
    .describe('A slow wobble applied to every note: the cutoff, the pitch (vibrato) or the level (tremolo).'),
  filter: z.object({
    frequency: z.number(),
    q: z.number(),
    type: z.enum(['lowpass', 'highpass', 'bandpass']),
    envAmount: z
      .number()
      .min(-4)
      .max(4)
      .optional()
      .describe("Octaves each note's cutoff sweeps from before settling at 'frequency'."),
    slope: z
      .number()
      .optional()
      .describe(
        "12 or 24 dB per octave. 24 cuts twice as hard past the cutoff, darker and rounder, like a 303's or a Moog's. Omit for 12.",
      ),
    accent: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe(
        'How much velocity scales the filter sweep: at 1 a soft note barely sweeps and a hard one sweeps fully. Omit and every note sweeps fully.',
      ),
  }),
  envelope: z.object({
    attack: z.number(),
    decay: z.number(),
    sustain: z.number(),
    release: z.number(),
  }),
});

const patchSchema = z.object({
  name: z.string(),
  description: z.string(),
  bpm: z.number(),
  totalSteps: z.number().int(),
  swing: z
    .number()
    .min(0)
    .max(0.5)
    .optional()
    .describe(
      'Share of a step each off-beat sixteenth lands late. 0.1 to 0.2 is a light shuffle, 0.33 triplet swing. Omit for straight time.',
    ),
  drive: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe('Soft clipping on the synth voices: 0.1 to 0.3 warms, 0.5 and up distorts. Omit for a clean sound.'),
  lead: instrument.describe('The sound that plays the melody.'),
  bass: instrument.describe('The sound that plays the bassline.'),
  drums: z
    .array(
      z.object({
        type: z.enum(['kick', 'snare', 'hat', 'clap']),
        startStep: z.number().int().min(0),
        velocity: z.number().min(0.1).max(1).optional(),
      }),
    )
    .optional()
    .describe('Percussion hits on the same sixteenth-note grid as the notes.'),
  delay: z.object({ time: z.number(), feedback: z.number(), mix: z.number() }).optional(),
  reverb: z
    .object({
      decay: z
        .number()
        .describe(
          'Reverb time in seconds: how long the tail takes to fade. 0.3 to 1 is a small room, 1.5 to 3 a hall, 4 to 6 a vast wash.',
        ),
      mix: z.number(),
      tone: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe('0 is a dark, soft room, 1 a bright plate. Omit for a warm room.'),
    })
    .optional(),
  melody: z.array(note).describe("Played by 'lead'. May be empty for a bass-led piece."),
  bassline: z.array(note).describe("Played by 'bass'."),
});

const SYSTEM = [
  'You are an expert composer and synthesizer programmer.',
  'You craft sonic experiences that are visualised in real time as cymatic patterns and physics simulations, so the spectrum, rhythm and dynamics of your patch shape what the listener sees as well as what they hear.',
  'The goal is to distill the emotion in the experience. Find the feeling at the heart of the request and let every choice (key, tempo, timbre, envelope, space) serve that feeling, rather than illustrating the scene note by note.',
  "Your goal is to create a 'SynthPatch' based on the user's description, image analysis, or refinement request.",
  'CRITICAL RULES:',
  '1. Frequency (\'freq\') MUST be a number in Hz (e.g., 440, 110). DO NOT use note names like "C4".',
  "2. 'startStep' must be an integer between 0 and totalSteps-1. A step is a sixteenth note: 4 steps make a beat and 16 a bar. In each bar the beats fall on steps 0, 4, 8 and 12 (four on the floor), the backbeat on 4 and 12, and the off-beat eighths on 2, 6, 10 and 14. 'swing' delays the odd steps (1, 3, 5...) only.",
  "3. 'durationSteps' must be an integer 1-32. Hold pads, drones and long notes for 16 or 32 steps instead of re-striking them.",
  '4. The bassline MUST be substantial. Make the melody substantial too, unless the style is bass-led (acid, dub, minimal techno), where it may be empty. Create variation between the first and second half of the loop.',
  "5. Use 'delay' and 'reverb' to add space and dimension.",
  '6. Think about musical structure (Call and Response, A/B sections) before generating.',
  '7. SONIC VARIETY: Make the most of the toolkit where it enhances the experience: sawtooth and square waves, filter resonance, FM, layers and LFOs. Do not settle on a plain sine and lowpass out of habit, but use them when the feeling calls for it.',
  "8. FM SYNTHESIS: 'fmAmount' gives a part metallic, bell-like or gritty textures. Set it by style: 30-90 for bells, metal and grit; 0 for classic subtractive sounds such as acid basslines, analog pads and chiptune.",
  '9. SCALES: Consider variance when the request permits: modes such as Phrygian, Lydian and Dorian, or chromaticism. Plain major is fine when the feeling calls for it.',
  "   The palette is wide, so use all of it: major, natural and harmonic minor, Mixolydian, major and minor pentatonic, blues, whole-tone, octatonic, Hirajoshi, Phrygian dominant, or a just-intonation or microtonal tuning, as well as the modes above. Let the request's mood choose. Bright or warm requests want major, Lydian, Mixolydian or pentatonic; do not default to dark.",
  '   TEMPO AND RHYTHM: Anything from 60 to 160 bpm is fair. Choose by feel: sparse and spacious, long held notes, straight and steady, syncopated, swung, or driving and dense. Do not settle on one groove.',
  '   TIMBRE: Gritty is one option among many. Clean and glassy, warm and soft, plucky, hollow and woody, bell-like and inharmonic are equally valid; match the request.',
  '10. DYNAMICS: Vary the envelope. Use short plucks, long swells, and percussive hits.',
  "11. PHRASING: Give each note a 'velocity' (0.1-1). Accent downbeats, soften passing notes, leave some ghost notes near 0.3.",
  "12. FILTER SWEEP: each part's 'filter.envAmount' (-4 to 4 octaves) sweeps the cutoff on every note. Positive values pluck or wow; negative values open up from dark. Use 0 for a steady tone.",
  "13. FM RATIO: each part's 'oscillator.fmRatio' (0.25-8) sets the modulator pitch. Whole numbers (1, 2, 3, 4) keep the tone harmonic; with sine waves 1 is full and bright and 2 is hollow like a clarinet. Halves (0.5, 1.5, 3.5) are harmonic too, but on a fundamental an octave below the note, so the pitch can drop an octave. Ratios that are not simple fractions (1.41, 2.76, 5.19) are inharmonic, like bells and metal. Vary it with the mood instead of leaving it at 2.",
  "14. FM WAVE: each part's 'oscillator.fmWave' shapes the modulator. 'sine' gives clean bells and electric pianos; leave it out for the grittier default.",
  "15. LAYER: each part's 'oscillator.layer' adds a second oscillator under every note: a sine at octave -1 for weight, a detuned saw for thickness, a square at octave 1 for bite. Use it when the sound should be fuller.",
  "16. LFO: each part's 'lfo' wobbles its notes. Target 'filter' for a slow sweep or wah, 'pitch' for vibrato, 'amp' for tremolo. Slow rates (0.1-0.5 Hz) drift; 4-7 Hz wobbles. Depth 0.1-0.3 is subtle. Leave it out for steady sounds.",
  "17. DRUMS: 'drums' is an optional list of kick, snare, hat and clap hits on the same sixteenth-note grid as the notes. Use them when the request wants a beat, a pulse or energy. Leave them out for ambient or purely melodic music. Kick on the downbeats, snare or clap on the backbeat, hats for the subdivisions; vary the velocity.",
  "18. REVERB TONE: 'reverb.tone' is 0 for a dark, soft room and 1 for a bright plate. Match the space to the mood.",
  "19. SWING, DRIVE, SLIDE, FM DECAY: 'swing' (0-0.5) shuffles the off-beat sixteenths; 0.33 is triplet swing. 'drive' (0-1) warms or distorts the synth. A note's 'slide' bends into it from the part's previous note, legato when that note is still held; 'glide' sets how long. 'oscillator.fmDecay' lets the FM brightness die away within each note, for struck sounds. Use them when they suit the request and leave them out otherwise.",
  "20. PARTS: 'lead' plays the melody and 'bass' the bassline, each with its own oscillator, filter, envelope and LFO. 'sub' adds a sine an octave below a part, 'filter.slope' 24 makes its filter steeper, and 'filter.accent' lets velocity drive its sweep.",
  'When a current patch is given as context, modify it to match the request. Keep what works and change what needs changing, unless the user asks to start from scratch.',
  'When an image is attached, translate its visual mood, texture, and composition into the patch.',
  'When audio is attached, describe the sound you hear and build a patch that matches it.',
  "The loop is exactly {loop} steps. Set 'totalSteps' to {loop}.",
  'when loop is 32: Create a concise loop.',
  'when loop is 64: Create a long, evolving structure. Use A/B sections.',
  'when loop is 128: Create a long, evolving structure. Use A/B sections.',
  'when loop is 256: Create a long, evolving structure. Use A/B sections.',
  'when loop is 512: Create a very long piece with several distinct sections that develop and return. Build it from a few phrases that repeat with variations, and make sure the melody and the bassline run the whole length with notes in every section, not only the start.',
];

const gemini = registerProvider(geminiProvider, { keySlot: KEY_SLOT, fallbackKeySlot: FALLBACK_KEY_SLOT });

registerStructured(PATCH_SCHEMA_ID, { jsonSchema: z.toJSONSchema(patchSchema) as Record<string, unknown> });

export const synthProfile = defineProfile({
  type: 'text',
  id: 'synth.patch',
  // Theorem's quota is per day, so the Pages function counts these over a week itself
  // (see functions/api/theorem/[[path]].ts) and uses the quota only for its refusal.
  guardrails: { quota: { perDay: WEEKLY_PER_BROWSER } },
  labels: { 'quota.exhausted': "You've used this week's {perDay} generations. Come make more noise in a few days." },
  identity: { handle: 'synth', system: SYSTEM },
  models: {
    main: {
      // Google stores each interaction; the next turn sends its id and only the new input.
      ...gemini.model('geminiInteractions', 'gemini-3.5-flash-lite', {
        options: { store: true, persistViaInteractionId: true },
      }),
      efforts: { think: 'low' },
      defaultEffort: 'think',
    },
  },
  defaultModel: 'main',
  maxSteps: 1,
  tools: { allow: [] },
  inputs: {
    text: true,
    attachments: { accept: ['image/*'] },
    maxFiles: 2,
    maxBytes: 12_000_000,
    maxTurnBytes: 20_000_000,
    context: { from: ['client'], maxChars: 40_000 },
    options: {
      loop: {
        label: 'Loop length',
        choices: [
          { value: '32', description: 'Short' },
          { value: '64', description: 'Medium' },
          { value: '128', description: 'Long' },
          { value: '256', description: 'Extended' },
          { value: '512', description: 'Epic' },
        ],
      },
    },
  },
  outputs: {
    structured: PATCH_SCHEMA_ID,
    streaming: { mode: 'sse', streamThoughts: false },
  },
  turnBehaviour: {
    allowSteering: false,
    resumption: { autoContinue: ['stream_incomplete', 'provider_error'], maxContinues: 1 },
  },
});
