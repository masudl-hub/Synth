
import { useRef, useState, useEffect, useCallback } from 'react';
import { SynthEngine } from '../audio/SynthEngine';
import { AudioFeatures, SynthPatch, NoteEvent } from '../types';
import { silentFeatures } from '../audio/analysis';
import { PORCELAIN_BEATS } from '../audio/porcelainBeats';
import { DEFAULT_PATCH } from '../audio/defaultPatch';


const PRESETS: Record<string, SynthPatch> = {
    "Porcelain": PORCELAIN_BEATS,
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

export const useGenerativeAudio = () => {
  const synthRef = useRef<SynthEngine | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPatch, setCurrentPatch] = useState<SynthPatch | null>(null);
  // Bumped when a different patch is loaded or cleared, not when one of its knobs changes.
  const [patchVersion, setPatchVersion] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  
  // Mixer State
  const [bpm, setBpm] = useState(120);
  const [volume, setVolume] = useState(0.4);
  // The Filter slider is the patch's own cutoff, so it follows whichever patch is loaded.
  const filterFreq = currentPatch?.filter.frequency ?? 20000;
  
  // Library State
  const [savedPatches, setSavedPatches] = useState<SynthPatch[]>([]);

  // Refs for audio visualizer connection
  const audioDataRef = useRef<AudioFeatures>(silentFeatures());

  useEffect(() => {
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

  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const velocityOf = (v: unknown) => (v == null || v === '' ? 1 : clamp(Number(v) || 1, 0.1, 1));

  const WAVES = ['sine', 'square', 'sawtooth', 'triangle', 'pulse', 'organ', 'bell'];

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
              fmAmount: Number(patch.oscillator?.fmAmount) || 0,
              fmRatio: clamp(Number(patch.oscillator?.fmRatio) || 2, 0.25, 8),
              ...(WAVES.includes(patch.oscillator?.fmWave) ? { fmWave: patch.oscillator.fmWave } : {}),
              ...(patch.oscillator?.layer ? { layer: {
                  type: WAVES.includes(patch.oscillator.layer.type) ? patch.oscillator.layer.type : 'sine',
                  octave: Math.round(clamp(Number(patch.oscillator.layer.octave) || 0, -2, 2)),
                  detune: clamp(Number(patch.oscillator.layer.detune) || 0, -100, 100),
                  mix: clamp(Number(patch.oscillator.layer.mix) || 0, 0, 1)
              } } : {})
          },
          ...(patch.lfo ? { lfo: {
              target: ['filter', 'pitch', 'amp'].includes(patch.lfo.target) ? patch.lfo.target : 'filter',
              rate: clamp(Number(patch.lfo.rate) || 1, 0.05, 20),
              depth: clamp(Number(patch.lfo.depth) || 0, 0, 1)
          } } : {}),
          ...(Array.isArray(patch.drums) ? { drums: patch.drums.map((d: any) => ({
              type: ['kick', 'snare', 'hat', 'clap'].includes(d.type) ? d.type : 'hat',
              startStep: Math.floor(Number(d.startStep) || 0),
              velocity: velocityOf(d.velocity)
          })) } : {}),
          filter: {
              type: patch.filter?.type || 'lowpass',
              frequency: Number(patch.filter?.frequency) || 2000,
              q: Number(patch.filter?.q) || 1,
              envAmount: clamp(Number(patch.filter?.envAmount) || 0, -4, 4)
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
              mix: Number(patch.reverb?.mix) || 0,
              ...(patch.reverb?.tone !== undefined ? { tone: clamp(Number(patch.reverb.tone) || 0, 0, 1) } : {})
          },
          melody: Array.isArray(patch.melody) ? patch.melody.map((n: any) => ({
              freq: Number(n.freq) || 440,
              startStep: Math.floor(Number(n.startStep) || 0),
              durationSteps: Number(n.durationSteps) || 1,
              velocity: velocityOf(n.velocity)
          })) : [],
          bassline: Array.isArray(patch.bassline) ? patch.bassline.map((n: any) => ({
              freq: Number(n.freq) || 110,
              startStep: Math.floor(Number(n.startStep) || 0),
              durationSteps: Number(n.durationSteps) || 1,
              velocity: velocityOf(n.velocity)
          })) : []
      };
  };

  /** Loads a patch a Theorem turn returned, after clamping it to what the engine accepts, and plays it. */
  const loadGenerated = (raw: unknown) => loadPatch(sanitizePatch(raw), true);

  const loadPatch = useCallback(async (patch: SynthPatch, playOnLoad: boolean = true) => {
      setCurrentPatch(patch);
      setPatchVersion((n) => n + 1);
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

  const stopPlayback = () => {
    synthRef.current?.stop();
    setIsPlaying(false);
  };

  // Back to the empty state; saved patches stay in the library.
  const clearPatch = () => {
    stopPlayback();
    setCurrentPatch(null);
    setPatchVersion((n) => n + 1);
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
  
  // Swaps the wave shape in place. The patch version stays put, so the visuals aren't reset.
  const updateOscillator = (type: SynthPatch['oscillator']['type']) => {
      setCurrentPatch((p) => (p ? { ...p, oscillator: { ...p.oscillator, type } } : p));
      synthRef.current?.setOscillatorType(type);
  };

  const updateFilter = (val: number) => {
      setCurrentPatch((p) => (p ? { ...p, filter: { ...p.filter, frequency: val } } : p));
      synthRef.current?.setPatchFilterFreq(val);
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
    loadGenerated,
    togglePlay,
    stopPlayback,
    clearPatch,
    toggleMute,
    isPlaying,
    isMuted,
    currentPatch,
    // Mixer
    bpm, updateBpm,
    volume, updateVolume,
    filterFreq, updateFilter, updateOscillator, patchVersion,
    // Library
    savedPatches, saveCurrentPatch, deleteSavedPatch, loadPatch, PRESETS
  };
};
