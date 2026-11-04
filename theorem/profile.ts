import { defineProfile, geminiProvider, registerProvider, registerStructured } from "@theoremjs/agents";
import { z } from "zod";

export const KEY_SLOT = "gemini";
export const FALLBACK_KEY_SLOT = "gemini-b";

// Generations per week: one browser (cookie) gets 10, and one IP gets 35 across all its browsers, so an
// office or VPN can share a connection while clearing cookies still can't run up the key.
export const WEEKLY_PER_BROWSER = 10;
export const WEEKLY_PER_IP = 35;

const PATCH_SCHEMA_ID = "synth.patch";

const wave = z.enum(["sine", "square", "sawtooth", "triangle", "pulse", "organ", "bell"]);

const note = z.object({
  freq: z.number().describe("Frequency in Hz, never a note name."),
  startStep: z.number().int().min(0),
  durationSteps: z.number().int().min(1).max(8),
  velocity: z.number().min(0.1).max(1).optional().describe("How hard the note is played, 0.1 to 1. Omit for full level."),
});

const patchSchema = z.object({
  name: z.string(),
  description: z.string(),
  bpm: z.number(),
  totalSteps: z.number().int(),
  oscillator: z.object({
    type: wave,
    detune: z.number(),
    fmAmount: z.number(),
    fmRatio: z.number().min(0.25).max(8).optional().describe("Modulator frequency as a multiple of the note. 2 is the default."),
    fmWave: wave.optional().describe("Shape of the FM modulator. Sine is clean and bell-like. Omit to follow the carrier."),
    layer: z.object({
      type: wave,
      octave: z.number().int().min(-2).max(2).describe("Octaves from the note: -1 is a sub, 1 is above."),
      detune: z.number().min(-100).max(100),
      mix: z.number().min(0).max(1),
    }).optional().describe("A second oscillator played under every note."),
  }),
  lfo: z.object({
    target: z.enum(["filter", "pitch", "amp"]),
    rate: z.number().min(0.05).max(20).describe("Hz. 0.1 to 0.5 is a slow drift, 4 to 7 a vibrato or wobble."),
    depth: z.number().min(0).max(1),
  }).optional().describe("A slow wobble applied to every note: the cutoff, the pitch (vibrato) or the level (tremolo)."),
  drums: z.array(z.object({
    type: z.enum(["kick", "snare", "hat", "clap"]),
    startStep: z.number().int().min(0),
    velocity: z.number().min(0.1).max(1).optional(),
  })).optional().describe("Percussion hits on the same sixteenth-note grid as the notes."),
  filter: z.object({
    frequency: z.number(),
    q: z.number(),
    type: z.enum(["lowpass", "highpass", "bandpass"]),
    envAmount: z.number().min(-4).max(4).optional().describe("Octaves each note's cutoff sweeps from before settling at 'frequency'."),
  }),
  envelope: z.object({
    attack: z.number(),
    decay: z.number(),
    sustain: z.number(),
    release: z.number(),
  }),
  delay: z.object({ time: z.number(), feedback: z.number(), mix: z.number() }).optional(),
  reverb: z.object({
    decay: z.number(),
    mix: z.number(),
    tone: z.number().min(0).max(1).optional().describe("0 is a dark, soft room, 1 a bright plate. Omit for a warm room."),
  }).optional(),
  melody: z.array(note),
  bassline: z.array(note),
});

const SYSTEM = [
  "You are an expert composer and synthesizer programmer.",
  "You craft sonic experiences that are visualised in real time as cymatic patterns and physics simulations, so the spectrum, rhythm and dynamics of your patch shape what the listener sees as well as what they hear.",
  "Your goal is to create a 'SynthPatch' based on the user's description, image analysis, or refinement request.",
  "CRITICAL RULES:",
  "1. Frequency ('freq') MUST be a number in Hz (e.g., 440, 110). DO NOT use note names like \"C4\".",
  "2. 'startStep' must be an integer between 0 and totalSteps-1.",
  "3. 'durationSteps' must be an integer 1-8.",
  "4. Melody and Bassline MUST be substantial. Create variation between the first and second half of the loop.",
  "5. Use 'delay' and 'reverb' to add space and dimension.",
  "6. Think about musical structure (Call and Response, A/B sections) before generating.",
  "7. SONIC VARIETY: Do NOT default to basic \"Sine\" + \"Lowpass\". Use Sawtooth/Square waves. Use Filter Resonance (Q > 5).",
  "8. FM SYNTHESIS: Use 'fmAmount' aggressively (30-90) to create metallic, bell-like, or gritty textures.",
  "9. SCALES: Use exotic scales (Phrygian, Lydian, Dorian) or chromaticism. Avoid plain Major scales unless requested.",
  "   The palette is wide, so use all of it: major, natural and harmonic minor, Mixolydian, major and minor pentatonic, blues, whole-tone, octatonic, Hirajoshi, Phrygian dominant, or a just-intonation or microtonal tuning, as well as the modes above. Let the request's mood choose. Bright or warm requests want major, Lydian, Mixolydian or pentatonic; do not default to dark.",
  "   TEMPO AND RHYTHM: Anything from 60 to 160 bpm is fair. Choose by feel: sparse and spacious, long held notes, straight and steady, syncopated, swung, or driving and dense. Do not settle on one groove.",
  "   TIMBRE: Gritty is one option among many. Clean and glassy, warm and soft, plucky, hollow and woody, bell-like and inharmonic are equally valid; match the request.",
  "   A line starting 'Palette hint:' may follow the request. It is a random starting point for a NEW piece. Use it only where the request leaves the key, scale, rhythm or timbre open. Ignore it when the request names its own, or asks to change or refine the current patch.",
  "10. DYNAMICS: Vary the envelope. Use short plucks, long swells, and percussive hits.",
  "11. PHRASING: Give each note a 'velocity' (0.1-1). Accent downbeats, soften passing notes, leave some ghost notes near 0.3.",
  "12. FILTER SWEEP: 'filter.envAmount' (-4 to 4 octaves) sweeps the cutoff on every note. Positive values pluck or wow; negative values open up from dark. Use 0 for a steady tone.",
  "13. FM RATIO: 'oscillator.fmRatio' (0.25-8) sets the modulator pitch. Whole numbers (1, 2, 3, 4) sound harmonic and bright; 1.4, 3.5 or 5.19 sound inharmonic like bells and metal; below 1 is hollow and woody. Vary it with the mood instead of leaving it at 2.",
  "14. FM WAVE: 'oscillator.fmWave' shapes the modulator. 'sine' gives clean bells and electric pianos; leave it out for the grittier default.",
  "15. LAYER: 'oscillator.layer' adds a second oscillator under every note: a sine at octave -1 for weight, a detuned saw for thickness, a square at octave 1 for bite. Use it when the sound should be fuller.",
  "16. LFO: 'lfo' wobbles every note. Target 'filter' for a slow sweep or wah, 'pitch' for vibrato, 'amp' for tremolo. Slow rates (0.1-0.5 Hz) drift; 4-7 Hz wobbles. Depth 0.1-0.3 is subtle. Leave it out for steady sounds.",
  "17. DRUMS: 'drums' is an optional list of kick, snare, hat and clap hits on the same sixteenth-note grid as the notes. Use them when the request wants a beat, a pulse or energy. Leave them out for ambient or purely melodic music. Kick on the downbeats, snare or clap on the backbeat, hats for the subdivisions; vary the velocity.",
  "18. REVERB TONE: 'reverb.tone' is 0 for a dark, soft room and 1 for a bright plate. Match the space to the mood.",
  "When a current patch is given as context, modify it to match the request. Keep what works and change what needs changing, unless the user asks to start from scratch.",
  "When an image is attached, translate its visual mood, texture, and composition into the patch.",
  "When audio is attached, describe the sound you hear and build a patch that matches it.",
  "The loop is exactly {loop} steps. Set 'totalSteps' to {loop}.",
  "when loop is 32: Create a concise loop.",
  "when loop is 64: Create a long, evolving structure. Use A/B sections.",
  "when loop is 128: Create a long, evolving structure. Use A/B sections.",
  "when loop is 256: Create a long, evolving structure. Use A/B sections.",
  "when loop is 512: Create a very long piece with several distinct sections that develop and return. Build it from a few phrases that repeat with variations, and make sure the melody and the bassline run the whole length with notes in every section, not only the start.",
];

const gemini = registerProvider(geminiProvider, { keySlot: KEY_SLOT, fallbackKeySlot: FALLBACK_KEY_SLOT });

registerStructured(PATCH_SCHEMA_ID, { jsonSchema: z.toJSONSchema(patchSchema) as Record<string, unknown> });

export const synthProfile = defineProfile({
  type: "text",
  id: "synth.patch",
  // Theorem's quota is per day, so the Pages function counts these over a week itself
  // (see functions/api/theorem/[[path]].ts) and uses the quota only for its refusal.
  guardrails: { quota: { perDay: WEEKLY_PER_BROWSER } },
  labels: { "quota.exhausted": "You've used this week's {perDay} generations. Come back in a few days." },
  identity: { handle: "synth", system: SYSTEM },
  models: {
    main: {
      // Google stores each interaction; the next turn sends its id and only the new input.
      ...gemini.model("geminiInteractions", "gemini-3.5-flash-lite", {
        options: { store: true, persistViaInteractionId: true },
      }),
      efforts: { think: "low" },
      defaultEffort: "think",
    },
  },
  defaultModel: "main",
  maxSteps: 1,
  tools: { allow: [] },
  inputs: {
    text: true,
    attachments: { accept: ["image/*"] },
    voice: { accept: ["audio/*"] },
    maxFiles: 2,
    maxBytes: 12_000_000,
    maxTurnBytes: 20_000_000,
    context: { from: ["client"], maxChars: 40_000 },
    options: {
      loop: {
        label: "Loop length",
        choices: [
          { value: "32", description: "Short" },
          { value: "64", description: "Medium" },
          { value: "128", description: "Long" },
          { value: "256", description: "Extended" },
          { value: "512", description: "Epic" },
        ],
      },
    },
  },
  outputs: {
    structured: PATCH_SCHEMA_ID,
    streaming: { mode: "sse", streamThoughts: false },
  },
  turnBehaviour: {
    allowSteering: false,
    resumption: { autoContinue: ["stream_incomplete", "provider_error"], maxContinues: 1 },
  },
});
