import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { silentFeatures } from '../audio/analysis.ts';
import { DEFAULT_PATCH } from '../audio/defaultPatch.ts';
import { focusPart, normalizePatch, oneSound } from '../audio/patch.ts';
import { PORCELAIN_BEATS } from '../audio/porcelainBeats.ts';
import { SynthEngine } from '../audio/SynthEngine.ts';
import type { AudioFeatures, SynthPatch, WaveShape } from '../types.ts';

const PRESET_SOURCES: Record<string, SynthPatch> = {
  Porcelain: PORCELAIN_BEATS,
  Sonic: {
    name: 'Sonic Run',
    description: 'Fast, 8-bit inspired square waves',
    bpm: 142,
    totalSteps: 16,
    ...oneSound({
      oscillator: { type: 'square', detune: 5, fmAmount: 0 },
      filter: { type: 'lowpass', frequency: 8000, q: 2 },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.1, release: 0.1 },
    }),
    delay: { time: 0.15, feedback: 0.2, mix: 0.1 },
    reverb: { decay: 0.5, mix: 0.1 },
    melody: [
      { freq: 440, startStep: 0, durationSteps: 1 },
      { freq: 554, startStep: 2, durationSteps: 1 },
      { freq: 659, startStep: 4, durationSteps: 1 },
      { freq: 880, startStep: 6, durationSteps: 1 },
      { freq: 554, startStep: 8, durationSteps: 1 },
      { freq: 440, startStep: 10, durationSteps: 1 },
      { freq: 330, startStep: 12, durationSteps: 1 },
      { freq: 220, startStep: 14, durationSteps: 1 },
    ],
    bassline: [
      { freq: 110, startStep: 0, durationSteps: 8 },
      { freq: 55, startStep: 8, durationSteps: 8 },
    ],
  },
  Clouds: {
    name: 'Granular Clouds',
    description: 'Washed out textures with high reverb',
    bpm: 90,
    totalSteps: 32,
    ...oneSound({
      oscillator: { type: 'triangle', detune: 10, fmAmount: 20 },
      filter: { type: 'bandpass', frequency: 1200, q: 1 },
      envelope: { attack: 0.8, decay: 1.0, sustain: 0.8, release: 2.0 },
    }),
    delay: { time: 0.5, feedback: 0.6, mix: 0.4 },
    reverb: { decay: 4.0, mix: 0.6 },
    melody: [
      { freq: 261.63, startStep: 0, durationSteps: 8 },
      { freq: 329.63, startStep: 8, durationSteps: 8 },
      { freq: 392.0, startStep: 16, durationSteps: 8 },
      { freq: 523.25, startStep: 24, durationSteps: 8 },
    ],
    bassline: [
      { freq: 65.41, startStep: 0, durationSteps: 16 },
      { freq: 87.31, startStep: 16, durationSteps: 16 },
    ],
  },
  Chaos: {
    name: 'Industrial Chaos',
    description: 'Distorted, FM-heavy rhythmic noise',
    bpm: 130,
    totalSteps: 16,
    ...oneSound({
      oscillator: { type: 'sawtooth', detune: 25, fmAmount: 80 },
      filter: { type: 'highpass', frequency: 500, q: 8 },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.1 },
    }),
    delay: { time: 0.1, feedback: 0.5, mix: 0.3 },
    reverb: { decay: 0.2, mix: 0.1 },
    melody: [
      { freq: 110, startStep: 0, durationSteps: 1 },
      { freq: 220, startStep: 2, durationSteps: 1 },
      { freq: 110, startStep: 4, durationSteps: 1 },
      { freq: 880, startStep: 6, durationSteps: 1 },
      { freq: 110, startStep: 8, durationSteps: 1 },
      { freq: 220, startStep: 10, durationSteps: 1 },
      { freq: 110, startStep: 12, durationSteps: 1 },
      { freq: 1760, startStep: 14, durationSteps: 1 },
    ],
    bassline: [
      { freq: 55, startStep: 0, durationSteps: 4 },
      { freq: 55, startStep: 8, durationSteps: 4 },
    ],
  },
  Youth: {
    name: 'Lost Youth',
    description: 'Nostalgic, detuned analog pads',
    bpm: 100,
    totalSteps: 64,
    ...oneSound({
      oscillator: { type: 'sawtooth', detune: 15, fmAmount: 5 },
      filter: { type: 'lowpass', frequency: 800, q: 0.5 },
      envelope: { attack: 0.2, decay: 0.5, sustain: 0.6, release: 1.0 },
    }),
    delay: { time: 0.45, feedback: 0.3, mix: 0.2 },
    reverb: { decay: 2.5, mix: 0.4 },
    melody: [
      { freq: 329.63, startStep: 0, durationSteps: 8 },
      { freq: 293.66, startStep: 16, durationSteps: 8 },
      { freq: 261.63, startStep: 32, durationSteps: 8 },
      { freq: 196.0, startStep: 48, durationSteps: 8 },
    ],
    bassline: [
      { freq: 82.41, startStep: 0, durationSteps: 32 },
      { freq: 65.41, startStep: 32, durationSteps: 32 },
    ],
  },
  Blue: {
    name: 'Blue Monday',
    description: 'Steady, driving synth-pop bass',
    bpm: 135,
    totalSteps: 16,
    ...oneSound({
      oscillator: { type: 'square', detune: 2, fmAmount: 0 },
      filter: { type: 'lowpass', frequency: 2500, q: 3 },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.2 },
    }),
    delay: { time: 0.25, feedback: 0.1, mix: 0.1 },
    reverb: { decay: 1.0, mix: 0.1 },
    melody: [],
    bassline: [
      { freq: 110, startStep: 0, durationSteps: 2 },
      { freq: 110, startStep: 2, durationSteps: 2 },
      { freq: 110, startStep: 4, durationSteps: 2 },
      { freq: 110, startStep: 6, durationSteps: 2 },
      { freq: 220, startStep: 8, durationSteps: 2 },
      { freq: 220, startStep: 10, durationSteps: 2 },
      { freq: 165, startStep: 12, durationSteps: 2 },
      { freq: 146, startStep: 14, durationSteps: 2 },
    ],
  },
};

// Normalized once, so a preset and the copy of it that is playing compare equal.
const PRESETS: Record<string, SynthPatch> = Object.fromEntries(
  Object.entries(PRESET_SOURCES).map(([key, patch]) => [key, normalizePatch(patch)]),
);

const STORE_KEY = 'audio_physics_patches';

/** The patches saved to the library, kept in local storage. */
const useSavedPatches = (currentPatch: SynthPatch | null) => {
  const [savedPatches, setSavedPatches] = useState<SynthPatch[]>([]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORE_KEY);
      if (saved) {
        // Patches saved before the lead and bass were split are migrated as they load.
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setSavedPatches(parsed.map(normalizePatch));
        }
      }
    } catch {
      // Storage is blocked or the saved list is unreadable: the library starts empty.
    }
  }, []);

  const saveCurrentPatch = useCallback(() => {
    if (currentPatch) {
      setSavedPatches((prev) => {
        const updated = [...prev, currentPatch];
        try {
          localStorage.setItem(STORE_KEY, JSON.stringify(updated));
        } catch {
          // Storage is blocked or full: the patch stays in the library for this visit.
        }
        return updated;
      });
    }
  }, [currentPatch]);

  const deleteSavedPatch = useCallback((index: number) => {
    setSavedPatches((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(updated));
      } catch {
        // Storage is blocked or full: the patch is gone for this visit, and may come back on the next.
      }
      return updated;
    });
  }, []);

  return { savedPatches, saveCurrentPatch, deleteSavedPatch };
};

type EngineRef = React.RefObject<SynthEngine | null>;

/** Tempo, volume and mute, set on the engine as they change. */
const useMixer = (synthRef: EngineRef) => {
  const [bpm, setBpm] = useState(120);
  const [volume, setVolume] = useState(0.4);
  const [isMuted, setIsMuted] = useState(false);

  const updateBpm = (val: number) => {
    setBpm(val);
    synthRef.current?.setBPM(val);
  };

  const updateVolume = (val: number) => {
    setVolume(val);
    synthRef.current?.setVolume(val);
  };

  const toggleMute = () => {
    if (synthRef.current) {
      const newState = !isMuted;
      setIsMuted(newState);
      synthRef.current.setMasterVolume(newState);
    }
  };
  return { bpm, setBpm, updateBpm, volume, updateVolume, isMuted, toggleMute };
};

/**
 * The wave button and the Filter slider. The slider is the patch's own cutoff, so it follows whichever patch is
 * loaded. Both act on the lead, or on the bass when there is no melody.
 */
const usePatchKnobs = (
  synthRef: EngineRef,
  currentPatch: SynthPatch | null,
  setCurrentPatch: React.Dispatch<React.SetStateAction<SynthPatch | null>>,
) => {
  const filterFreq = currentPatch ? currentPatch[focusPart(currentPatch)].filter.frequency : 20_000;

  // Swaps the wave shape in place. The patch version stays put, so the visuals aren't reset.
  const updateOscillator = (type: WaveShape) => {
    if (!currentPatch) {
      return;
    }
    const part = focusPart(currentPatch);
    setCurrentPatch((p) => (p ? { ...p, [part]: { ...p[part], oscillator: { ...p[part].oscillator, type } } } : p));
    synthRef.current?.setOscillatorType(type, part);
  };

  const updateFilter = (val: number) => {
    if (!currentPatch) {
      return;
    }
    const part = focusPart(currentPatch);
    setCurrentPatch((p) => (p ? { ...p, [part]: { ...p[part], filter: { ...p[part].filter, frequency: val } } } : p));
    synthRef.current?.setPatchFilterFreq(val, part);
  };
  return { filterFreq, updateOscillator, updateFilter };
};

export const useGenerativeAudio = () => {
  const synthRef = useRef<SynthEngine | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPatch, setCurrentPatch] = useState<SynthPatch | null>(null);
  // Bumped when a different patch is loaded or cleared, not when one of its knobs changes.
  const [patchVersion, setPatchVersion] = useState(0);

  const { bpm, setBpm, updateBpm, volume, updateVolume, isMuted, toggleMute } = useMixer(synthRef);
  const { filterFreq, updateOscillator, updateFilter } = usePatchKnobs(synthRef, currentPatch, setCurrentPatch);

  // Refs for audio visualizer connection
  const audioDataRef = useRef<AudioFeatures>(silentFeatures());

  /** Loads a patch a Theorem turn returned and plays it. */
  const loadGenerated = (raw: unknown) => loadPatch(raw, true);

  // Every patch comes through here (presets, saved ones, the JSON editor, Theorem), so every one is clamped to
  // what the engine accepts and migrated if it has the old shape.
  const loadPatch = useCallback(
    async (raw: unknown, playOnLoad = true) => {
      const patch = normalizePatch(raw);
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
    },
    [setBpm],
  );

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

    return () => {
      synthRef.current?.stop();
    };
  }, [loadPatch]);

  const togglePlay = async () => {
    if (!synthRef.current) {
      return;
    }
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

  const { savedPatches, saveCurrentPatch, deleteSavedPatch } = useSavedPatches(currentPatch);

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
    bpm,
    updateBpm,
    volume,
    updateVolume,
    filterFreq,
    updateFilter,
    updateOscillator,
    patchVersion,
    // Library
    savedPatches,
    saveCurrentPatch,
    deleteSavedPatch,
    loadPatch,
    PRESETS,
  };
};
