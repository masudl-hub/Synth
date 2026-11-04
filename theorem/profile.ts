import { defineProfile, geminiProvider, registerProvider, registerStructured } from "@theoremjs/agents";
import { z } from "zod";

export const KEY_SLOT = "gemini";
export const FALLBACK_KEY_SLOT = "gemini-b";

const PATCH_SCHEMA_ID = "synth.patch";

const note = z.object({
  freq: z.number().describe("Frequency in Hz, never a note name."),
  startStep: z.number().int().min(0),
  durationSteps: z.number().int().min(1).max(8),
});

const patchSchema = z.object({
  name: z.string(),
  description: z.string(),
  bpm: z.number(),
  totalSteps: z.number().int(),
  oscillator: z.object({
    type: z.enum(["sine", "square", "sawtooth", "triangle"]),
    detune: z.number(),
    fmAmount: z.number(),
  }),
  filter: z.object({
    frequency: z.number(),
    q: z.number(),
    type: z.enum(["lowpass", "highpass", "bandpass"]),
  }),
  envelope: z.object({
    attack: z.number(),
    decay: z.number(),
    sustain: z.number(),
    release: z.number(),
  }),
  delay: z.object({ time: z.number(), feedback: z.number(), mix: z.number() }).optional(),
  reverb: z.object({ decay: z.number(), mix: z.number() }).optional(),
  melody: z.array(note),
  bassline: z.array(note),
});

const SYSTEM = [
  "You are an expert composer and synthesizer programmer.",
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
  "10. DYNAMICS: Vary the envelope. Use short plucks, long swells, and percussive hits.",
  "When a current patch is given as context, modify it to match the request. Keep what works and change what needs changing, unless the user asks to start from scratch.",
  "When an image is attached, translate its visual mood, texture, and composition into the patch.",
  "When audio is attached, describe the sound you hear and build a patch that matches it.",
  "The loop is exactly {loop} steps. Set 'totalSteps' to {loop}.",
  "when loop is 32: Create a concise loop.",
  "when loop is 64: Create a long, evolving structure. Use A/B sections.",
  "when loop is 128: Create a long, evolving structure. Use A/B sections.",
  "when loop is 256: Create a long, evolving structure. Use A/B sections.",
];

const gemini = registerProvider(geminiProvider, { keySlot: KEY_SLOT, fallbackKeySlot: FALLBACK_KEY_SLOT });

registerStructured(PATCH_SCHEMA_ID, { jsonSchema: z.toJSONSchema(patchSchema) as Record<string, unknown> });

export const synthProfile = defineProfile({
  type: "text",
  id: "synth.patch",
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
