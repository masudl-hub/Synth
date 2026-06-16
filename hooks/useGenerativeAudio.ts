
import { useRef, useState, useEffect, useCallback } from 'react';
import { GoogleGenAI, Type, Schema } from '@google/genai';
import { SynthEngine } from '../audio/SynthEngine';
import { AudioFeatures, SynthPatch, NoteEvent } from '../types';

const SYSTEM_INSTRUCTION = `
You are an expert composer and synthesizer programmer.
Your goal is to create a 'SynthPatch' based on the user's description, image analysis, or refinement request.
The response must be valid JSON.

CRITICAL RULES:
1. Frequency ('freq') MUST be a number in Hz (e.g., 440, 110). DO NOT use note names like "C4".
2. 'startStep' must be an integer between 0 and totalSteps-1.
3. 'durationSteps' must be an integer 1-8.
4. Melody and Bassline MUST be substantial. Create variation between the first and second half of the loop.
5. Use 'delay' and 'reverb' to add space and dimension.
6. Think about musical structure (Call and Response, A/B sections) before generating.
7. SONIC VARIETY: Do NOT default to basic "Sine" + "Lowpass". Use Sawtooth/Square waves. Use Filter Resonance (Q > 5).
8. FM SYNTHESIS: Use 'fmAmount' aggressively (30-90) to create metallic, bell-like, or gritty textures.
9. SCALES: Use exotic scales (Phrygian, Lydian, Dorian) or chromaticism. Avoid plain Major scales unless requested.
10. DYNAMICS: Vary the envelope. Use short plucks, long swells, and percussive hits.
`;

const DEFAULT_PATCH: SynthPatch = {
    name: "Atmospheric Pulse",
    description: "A simple starter patch with space",
    bpm: 120,
    totalSteps: 32,
    oscillator: { type: "sine", detune: 0, fmAmount: 10 },
    filter: { type: "lowpass", frequency: 2000, q: 1 },
    envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.1 },
    delay: { time: 0.375, feedback: 0.4, mix: 0.3 },
    reverb: { decay: 2.0, mix: 0.25 },
    melody: [
        { freq: 440, startStep: 0, durationSteps: 2 },
        { freq: 554, startStep: 4, durationSteps: 2 },
        { freq: 659, startStep: 8, durationSteps: 2 },
        { freq: 880, startStep: 12, durationSteps: 2 },
        { freq: 659, startStep: 16, durationSteps: 2 },
        { freq: 554, startStep: 20, durationSteps: 2 },
        { freq: 440, startStep: 24, durationSteps: 2 },
        { freq: 330, startStep: 28, durationSteps: 2 },
    ],
    bassline: [
        { freq: 110, startStep: 0, durationSteps: 4 },
        { freq: 110, startStep: 8, durationSteps: 4 },
        { freq: 165, startStep: 16, durationSteps: 4 },
        { freq: 146, startStep: 24, durationSteps: 4 },
    ]
};

const PRESETS: Record<string, SynthPatch> = {
    "Sonic": {
        name: "Sonic Run",
        description: "Fast, 8-bit inspired square waves",
        bpm: 142,
        totalSteps: 16,
        oscillator: { type: "square", detune: 5, fmAmount: 0 },
        filter: { type: "lowpass", frequency: 8000, q: 2 },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.1, release: 0.1 },
        delay: { time: 0.15, feedback: 0.2, mix: 0.1 },
        reverb: { decay: 0.5, mix: 0.1 },
        melody: [
            { freq: 440, startStep: 0, durationSteps: 1 }, { freq: 554, startStep: 2, durationSteps: 1 },
            { freq: 659, startStep: 4, durationSteps: 1 }, { freq: 880, startStep: 6, durationSteps: 1 },
            { freq: 554, startStep: 8, durationSteps: 1 }, { freq: 440, startStep: 10, durationSteps: 1 },
            { freq: 330, startStep: 12, durationSteps: 1 }, { freq: 220, startStep: 14, durationSteps: 1 }
        ],
        bassline: [
            { freq: 110, startStep: 0, durationSteps: 8 }, { freq: 55, startStep: 8, durationSteps: 8 }
        ]
    },
    "Clouds": {
        name: "Granular Clouds",
        description: "Washed out textures with high reverb",
        bpm: 90,
        totalSteps: 32,
        oscillator: { type: "triangle", detune: 10, fmAmount: 20 },
        filter: { type: "bandpass", frequency: 1200, q: 1 },
        envelope: { attack: 0.8, decay: 1.0, sustain: 0.8, release: 2.0 },
        delay: { time: 0.5, feedback: 0.6, mix: 0.4 },
        reverb: { decay: 4.0, mix: 0.6 },
        melody: [
            { freq: 261.63, startStep: 0, durationSteps: 8 }, { freq: 329.63, startStep: 8, durationSteps: 8 },
            { freq: 392.00, startStep: 16, durationSteps: 8 }, { freq: 523.25, startStep: 24, durationSteps: 8 }
        ],
        bassline: [
             { freq: 65.41, startStep: 0, durationSteps: 16 }, { freq: 87.31, startStep: 16, durationSteps: 16 }
        ]
    },
    "Chaos": {
        name: "Industrial Chaos",
        description: "Distorted, FM-heavy rhythmic noise",
        bpm: 130,
        totalSteps: 16,
        oscillator: { type: "sawtooth", detune: 25, fmAmount: 80 },
        filter: { type: "highpass", frequency: 500, q: 8 },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.1 },
        delay: { time: 0.1, feedback: 0.5, mix: 0.3 },
        reverb: { decay: 0.2, mix: 0.1 },
        melody: [
            { freq: 110, startStep: 0, durationSteps: 1 }, { freq: 220, startStep: 2, durationSteps: 1 },
            { freq: 110, startStep: 4, durationSteps: 1 }, { freq: 880, startStep: 6, durationSteps: 1 },
             { freq: 110, startStep: 8, durationSteps: 1 }, { freq: 220, startStep: 10, durationSteps: 1 },
            { freq: 110, startStep: 12, durationSteps: 1 }, { freq: 1760, startStep: 14, durationSteps: 1 }
        ],
        bassline: [
            { freq: 55, startStep: 0, durationSteps: 4 }, { freq: 55, startStep: 8, durationSteps: 4 }
        ]
    },
    "Youth": {
        name: "Lost Youth",
        description: "Nostalgic, detuned analog pads",
        bpm: 100,
        totalSteps: 64,
        oscillator: { type: "sawtooth", detune: 15, fmAmount: 5 },
        filter: { type: "lowpass", frequency: 800, q: 0.5 },
        envelope: { attack: 0.2, decay: 0.5, sustain: 0.6, release: 1.0 },
        delay: { time: 0.45, feedback: 0.3, mix: 0.2 },
        reverb: { decay: 2.5, mix: 0.4 },
        melody: [
            { freq: 329.63, startStep: 0, durationSteps: 8 }, { freq: 293.66, startStep: 16, durationSteps: 8 },
            { freq: 261.63, startStep: 32, durationSteps: 8 }, { freq: 196.00, startStep: 48, durationSteps: 8 }
        ],
        bassline: [
            { freq: 82.41, startStep: 0, durationSteps: 32 }, { freq: 65.41, startStep: 32, durationSteps: 32 }
        ]
    },
    "Blue": {
        name: "Blue Monday",
        description: "Steady, driving synth-pop bass",
        bpm: 135,
        totalSteps: 16,
        oscillator: { type: "square", detune: 2, fmAmount: 0 },
        filter: { type: "lowpass", frequency: 2500, q: 3 },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.2 },
        delay: { time: 0.25, feedback: 0.1, mix: 0.1 },
        reverb: { decay: 1.0, mix: 0.1 },
        melody: [],
        bassline: [
            { freq: 110, startStep: 0, durationSteps: 2 }, { freq: 110, startStep: 2, durationSteps: 2 },
            { freq: 110, startStep: 4, durationSteps: 2 }, { freq: 110, startStep: 6, durationSteps: 2 },
            { freq: 220, startStep: 8, durationSteps: 2 }, { freq: 220, startStep: 10, durationSteps: 2 },
            { freq: 165, startStep: 12, durationSteps: 2 }, { freq: 146, startStep: 14, durationSteps: 2 }
        ]
    }
};

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    description: { type: Type.STRING },
    bpm: { type: Type.NUMBER },
    totalSteps: { type: Type.NUMBER },
    oscillator: {
      type: Type.OBJECT,
      properties: {
        type: { type: Type.STRING, enum: ["sine", "square", "sawtooth", "triangle"] },
        detune: { type: Type.NUMBER },
        fmAmount: { type: Type.NUMBER }
      },
      required: ["type", "detune", "fmAmount"]
    },
    filter: {
      type: Type.OBJECT,
      properties: {
        frequency: { type: Type.NUMBER },
        q: { type: Type.NUMBER },
        type: { type: Type.STRING, enum: ["lowpass", "highpass", "bandpass"] }
      },
      required: ["frequency", "q", "type"]
    },
    envelope: {
      type: Type.OBJECT,
      properties: {
        attack: { type: Type.NUMBER },
        decay: { type: Type.NUMBER },
        sustain: { type: Type.NUMBER },
        release: { type: Type.NUMBER }
      },
      required: ["attack", "decay", "sustain", "release"]
    },
    delay: {
      type: Type.OBJECT,
      properties: {
        time: { type: Type.NUMBER },
        feedback: { type: Type.NUMBER },
        mix: { type: Type.NUMBER }
      },
      required: ["time", "feedback", "mix"]
    },
    reverb: {
      type: Type.OBJECT,
      properties: {
        decay: { type: Type.NUMBER },
        mix: { type: Type.NUMBER }
      },
      required: ["decay", "mix"]
    },
    melody: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          freq: { type: Type.NUMBER },
          startStep: { type: Type.NUMBER },
          durationSteps: { type: Type.NUMBER }
        },
        required: ["freq", "startStep", "durationSteps"]
      }
    },
    bassline: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          freq: { type: Type.NUMBER },
          startStep: { type: Type.NUMBER },
          durationSteps: { type: Type.NUMBER }
        },
        required: ["freq", "startStep", "durationSteps"]
      }
    }
  },
  required: ["name", "description", "bpm", "oscillator", "filter", "envelope", "melody", "bassline"]
};

export const useGenerativeAudio = () => {
  const genAIRef = useRef<GoogleGenAI | null>(null);
  const synthRef = useRef<SynthEngine | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentPatch, setCurrentPatch] = useState<SynthPatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  
  // Mixer State
  const [bpm, setBpm] = useState(120);
  const [volume, setVolume] = useState(0.4);
  const [filterFreq, setFilterFreq] = useState(20000);
  
  // Loop State
  const [loopLength, setLoopLength] = useState(32);

  // Library State
  const [savedPatches, setSavedPatches] = useState<SynthPatch[]>([]);

  // Refs for audio visualizer connection
  const audioDataRef = useRef<AudioFeatures>({
      volume: 0, bass: 0, mid: 0, treble: 0,
      fft: new Uint8Array(128), waveform: new Uint8Array(128),
      centroid: 0, flux: 0
  });

  useEffect(() => {
    // Init Gemini SDK
    if (process.env.API_KEY) {
        genAIRef.current = new GoogleGenAI({ apiKey: process.env.API_KEY });
    }

    // Init Synth Engine
    synthRef.current = new SynthEngine();
    
    // Connect Synth Analysis to Hook Ref
    const syncLoop = () => {
        if (synthRef.current) {
            audioDataRef.current = synthRef.current.audioData;
        }
        requestAnimationFrame(syncLoop);
    };
    syncLoop();

    // Load Default Patch immediately
    loadPatch(DEFAULT_PATCH, false); // Don't auto-play default

    // Load Saved Patches from LocalStorage
    try {
        const saved = localStorage.getItem('audio_physics_patches');
        if (saved) {
            setSavedPatches(JSON.parse(saved));
        }
    } catch(e) { console.error("LS Error", e); }

    return () => {
        synthRef.current?.stop();
    };
  }, []);

  const mapToHumanReadableError = (e: any): string => {
      const msg = (e?.message || String(e) || '').trim();
      const lower = msg.toLowerCase();

      if (lower.includes("api key") || lower.includes("api_key") || lower.includes("key_invalid") || lower.includes("credential") || lower.includes("unauthorized") || lower.includes("forbidden") || lower.includes("403")) {
          return "The Gemini API key is missing or invalid. Please check your project environment settings.";
      }
      if (lower.includes("fetch failed") || lower.includes("network") || lower.includes("offline") || lower.includes("dns") || lower.includes("connect")) {
          return "Network connection issue. Please make sure you are online and that the API is reachable.";
      }
      if (lower.includes("quota") || lower.includes("resource_exhausted") || lower.includes("exhausted") || lower.includes("rate limit") || lower.includes("429")) {
          return "Gemini API request limit exceeded (Quota exhausted). Please wait a few moments and try again.";
      }
      if (lower.includes("safety") || lower.includes("blocked") || lower.includes("harm") || lower.includes("violat") || lower.includes("finishreason")) {
          return "This request was declined by Gemini's safety standards. Please rephrase your audio prompt.";
      }
      if (lower.includes("syntaxerror") || lower.includes("json") || lower.includes("parse")) {
          return "The generative model returned an incorrect patch structure. Click 'Generate' again to rebuild it.";
      }
      if (lower.includes("model") && (lower.includes("not found") || lower.includes("404"))) {
          return "Synthesizer model is currently unavailable on the server. Please try again in higher traffic moments later.";
      }

      // Clean up generic headers if any
      let cleaned = msg;
      cleaned = cleaned.replace(/^Error:\s*/i, '');
      cleaned = cleaned.replace(/^GoogleGenAIError:\s*/i, '');
      cleaned = cleaned.replace(/^\[GoogleGenAI Error\]:\s*/i, '');
      
      if (cleaned.length > 180) {
          cleaned = cleaned.substring(0, 177) + "...";
      }

      return cleaned || "An unexpected error occurred during sound generation. Please try again.";
  };

  const sanitizePatch = (patch: any): SynthPatch => {
      // Ensure numerical safety and required structure
      return {
          name: patch.name || "Untitled",
          description: patch.description || "Generated Patch",
          bpm: Number(patch.bpm) || 120,
          totalSteps: Number(patch.totalSteps) || 32,
          oscillator: {
              type: patch.oscillator?.type || 'sine',
              detune: Number(patch.oscillator?.detune) || 0,
              fmAmount: Number(patch.oscillator?.fmAmount) || 0
          },
          filter: {
              type: patch.filter?.type || 'lowpass',
              frequency: Number(patch.filter?.frequency) || 2000,
              q: Number(patch.filter?.q) || 1
          },
          envelope: {
              attack: Number(patch.envelope?.attack) || 0.01,
              decay: Number(patch.envelope?.decay) || 0.1,
              sustain: Number(patch.envelope?.sustain) || 0.5,
              release: Number(patch.envelope?.release) || 0.1
          },
          delay: {
              time: Number(patch.delay?.time) || 0.3,
              feedback: Number(patch.delay?.feedback) || 0.3,
              mix: Number(patch.delay?.mix) || 0
          },
          reverb: {
              decay: Number(patch.reverb?.decay) || 2.0,
              mix: Number(patch.reverb?.mix) || 0
          },
          melody: Array.isArray(patch.melody) ? patch.melody.map((n: any) => ({
              freq: Number(n.freq) || 440,
              startStep: Math.floor(Number(n.startStep) || 0),
              durationSteps: Number(n.durationSteps) || 1
          })) : [],
          bassline: Array.isArray(patch.bassline) ? patch.bassline.map((n: any) => ({
              freq: Number(n.freq) || 110,
              startStep: Math.floor(Number(n.startStep) || 0),
              durationSteps: Number(n.durationSteps) || 1
          })) : []
      };
  };

  const generatePatch = async (prompt: string, imageBase64?: string) => {
    setIsGenerating(true);
    setError(null);

    try {
        const response = await fetch("/api/generate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                prompt,
                loopLength,
                imageBase64,
                currentPatch
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `Server responded with status ${response.status}`);
        }

        const rawPatch = await response.json();
        const patch = sanitizePatch(rawPatch);
        
        loadPatch(patch, false);
        // Do NOT auto-play. Let user click play.
        
    } catch (e: any) {
        console.error("Generation failed", e);
        setError(mapToHumanReadableError(e));
    } finally {
        setIsGenerating(false);
    }
  };

  const loadPatch = useCallback(async (patch: SynthPatch, playOnLoad: boolean = true) => {
      setCurrentPatch(patch);
      // Sync mixer controls to new patch defaults
      setBpm(patch.bpm);
      
      if (synthRef.current) {
          synthRef.current.loadPatch(patch);
          
          if (playOnLoad) {
             await synthRef.current.resume();
             synthRef.current.start();
             setIsPlaying(true);
          }
      }
  }, []);

  const togglePlay = async () => {
    if (!synthRef.current) return;
    await synthRef.current.resume();

    if (isPlaying) {
        synthRef.current.stop();
        setIsPlaying(false);
    } else {
        synthRef.current.start();
        setIsPlaying(true);
    }
  };

  const toggleMute = () => {
      if (synthRef.current) {
          const newState = !isMuted;
          setIsMuted(newState);
          synthRef.current.setMasterVolume(newState);
      }
  };
  
  // Mixer Control Wrappers
  const updateBpm = (val: number) => {
      setBpm(val);
      synthRef.current?.setBPM(val);
  };
  
  const updateVolume = (val: number) => {
      setVolume(val);
      synthRef.current?.setVolume(val);
  };
  
  const updateFilter = (val: number) => {
      setFilterFreq(val);
      synthRef.current?.setFilterFreq(val);
  };

  // Library Actions
  const saveCurrentPatch = useCallback(() => {
      if (currentPatch) {
          setSavedPatches(prev => {
              const updated = [...prev, currentPatch];
              try {
                localStorage.setItem('audio_physics_patches', JSON.stringify(updated));
              } catch(e) { console.error("Save failed", e); }
              return updated;
          });
      }
  }, [currentPatch]);

  const deleteSavedPatch = useCallback((index: number) => {
      setSavedPatches(prev => {
          const updated = prev.filter((_, i) => i !== index);
          try {
              localStorage.setItem('audio_physics_patches', JSON.stringify(updated));
          } catch(e) { console.error("Delete failed", e); }
          return updated;
      });
  }, []);

  return {
    audioDataRef,
    generatePatch,
    togglePlay,
    toggleMute,
    isPlaying,
    isMuted,
    isGenerating,
    currentPatch,
    error,
    setError,
    // Mixer
    bpm, updateBpm,
    volume, updateVolume,
    filterFreq, updateFilter,
    // Library
    savedPatches, saveCurrentPatch, deleteSavedPatch, loadPatch, PRESETS,
    // Loops
    loopLength, setLoopLength
  };
};
