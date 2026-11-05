import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PATCH } from '../audio/defaultPatch.ts';
import { focusPart, normalizePatch } from '../audio/patch.ts';
import type { SynthPatch } from '../types.ts';

const engines = vi.hoisted(() => ({ list: [] as Record<string, ReturnType<typeof vi.fn>>[] }));

vi.mock('../audio/SynthEngine.ts', () => ({
  SynthEngine: class {
    audioData = { rms: 0.25 };
    loadPatch = vi.fn();
    resume = vi.fn(() => Promise.resolve());
    start = vi.fn();
    stop = vi.fn();
    setMasterVolume = vi.fn();
    setBPM = vi.fn();
    setVolume = vi.fn();
    setOscillatorType = vi.fn();
    setPatchFilterFreq = vi.fn();
    constructor() {
      engines.list.push(this as unknown as Record<string, ReturnType<typeof vi.fn>>);
    }
  },
}));

const { useGenerativeAudio } = await import('./useGenerativeAudio.ts');

const STORE = 'audio_physics_patches';
let frames: FrameRequestCallback[] = [];

/** The hook after its first patch has loaded. */
const setup = async () => {
  const view = renderHook(() => useGenerativeAudio());
  await act(async () => {
    await Promise.resolve();
  });
  const [engine] = engines.list;
  if (!engine) {
    throw new Error('No engine was made');
  }
  return { ...view, engine };
};

// Node's own localStorage stands in front of the test document's, and is empty without a file, so the test brings one.
const storage = new Map<string, string>();
let isFull = false;
const fakeStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    if (isFull) {
      throw new Error('full');
    }
    storage.set(key, value);
  },
};

const named = (name: string): SynthPatch => normalizePatch({ ...DEFAULT_PATCH, name });

beforeEach(() => {
  engines.list.length = 0;
  frames = [];
  storage.clear();
  isFull = false;
  vi.stubGlobal('localStorage', fakeStorage);
  vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => frames.push(f));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useGenerativeAudio', () => {
  it('loads the default patch without playing it', async () => {
    const { result, engine } = await setup();
    expect(result.current.currentPatch?.name).toBe(DEFAULT_PATCH.name);
    expect(result.current.bpm).toBe(DEFAULT_PATCH.bpm);
    expect(result.current.isPlaying).toBe(false);
    expect(engine.loadPatch).toHaveBeenCalledTimes(1);
    expect(engine.start).not.toHaveBeenCalled();
    expect(result.current.patchVersion).toBe(1);
  });

  it('feeds the analyser data to the visuals on every frame', async () => {
    const { result } = await setup();
    const tick = frames.shift();
    tick?.(0);
    expect(result.current.audioDataRef.current).toEqual({ rms: 0.25 });
    expect(frames).toHaveLength(1);
  });

  it('plays a generated patch as it arrives', async () => {
    const { result, engine } = await setup();
    await act(() => result.current.loadGenerated({ ...DEFAULT_PATCH, name: 'New', bpm: 99 }));
    expect(engine.resume).toHaveBeenCalled();
    expect(engine.start).toHaveBeenCalled();
    expect(result.current.isPlaying).toBe(true);
    expect(result.current.currentPatch?.name).toBe('New');
    expect(result.current.bpm).toBe(99);
  });

  it('plays and pauses', async () => {
    const { result, engine } = await setup();
    await act(() => result.current.togglePlay());
    expect(result.current.isPlaying).toBe(true);
    await act(() => result.current.togglePlay());
    expect(result.current.isPlaying).toBe(false);
    expect(engine.stop).toHaveBeenCalledTimes(1);
  });

  it('clears the patch, stopping the sound', async () => {
    const { result, engine } = await setup();
    act(() => result.current.clearPatch());
    expect(result.current.currentPatch).toBeNull();
    expect(result.current.patchVersion).toBe(2);
    expect(engine.stop).toHaveBeenCalled();
    expect(result.current.filterFreq).toBe(20_000);
  });

  it('mutes and unmutes', async () => {
    const { result, engine } = await setup();
    act(() => result.current.toggleMute());
    expect(result.current.isMuted).toBe(true);
    expect(engine.setMasterVolume).toHaveBeenLastCalledWith(true);
    act(() => result.current.toggleMute());
    expect(engine.setMasterVolume).toHaveBeenLastCalledWith(false);
  });

  it('sets tempo and volume on the engine', async () => {
    const { result, engine } = await setup();
    act(() => result.current.updateBpm(150));
    act(() => result.current.updateVolume(0.8));
    expect(result.current.bpm).toBe(150);
    expect(result.current.volume).toBe(0.8);
    expect(engine.setBPM).toHaveBeenCalledWith(150);
    expect(engine.setVolume).toHaveBeenCalledWith(0.8);
  });

  it('changes the wave and filter of the playing part in place', async () => {
    const { result, engine } = await setup();
    const part = focusPart(DEFAULT_PATCH);
    act(() => result.current.updateOscillator('bell'));
    act(() => result.current.updateFilter(1234));
    expect(result.current.currentPatch?.[part].oscillator.type).toBe('bell');
    expect(result.current.filterFreq).toBe(1234);
    expect(engine.setOscillatorType).toHaveBeenCalledWith('bell', part);
    expect(engine.setPatchFilterFreq).toHaveBeenCalledWith(1234, part);
    expect(result.current.patchVersion).toBe(1);
  });

  it('leaves the wave and filter alone with no patch', async () => {
    const { result, engine } = await setup();
    act(() => result.current.clearPatch());
    act(() => result.current.updateOscillator('bell'));
    act(() => result.current.updateFilter(1234));
    expect(engine.setOscillatorType).not.toHaveBeenCalled();
    expect(engine.setPatchFilterFreq).not.toHaveBeenCalled();
  });
});

describe('useGenerativeAudio library', () => {
  it('saves and deletes patches, keeping them in storage', async () => {
    const { result } = await setup();
    act(() => result.current.saveCurrentPatch());
    await act(() => result.current.loadPatch(named('Second'), false));
    act(() => result.current.saveCurrentPatch());
    expect(result.current.savedPatches.map((p) => p.name)).toEqual([DEFAULT_PATCH.name, 'Second']);
    act(() => result.current.deleteSavedPatch(0));
    expect(result.current.savedPatches.map((p) => p.name)).toEqual(['Second']);
    expect(JSON.parse(storage.get(STORE) ?? '[]').map((p: SynthPatch) => p.name)).toEqual(['Second']);
  });

  it('saves nothing when no patch is loaded', async () => {
    const { result } = await setup();
    act(() => result.current.clearPatch());
    act(() => result.current.saveCurrentPatch());
    expect(result.current.savedPatches).toEqual([]);
  });

  it('loads the saved list from storage, migrating each patch', async () => {
    storage.set(STORE, JSON.stringify([{ ...DEFAULT_PATCH, name: 'Kept' }]));
    const { result } = await setup();
    expect(result.current.savedPatches).toEqual([named('Kept')]);
  });

  it('starts with an empty library when storage is blocked', async () => {
    vi.stubGlobal('localStorage', undefined);
    const { result } = await setup();
    expect(result.current.savedPatches).toEqual([]);
  });

  it('starts with an empty library when the saved list is unreadable', async () => {
    storage.set(STORE, '{not json');
    const broken = await setup();
    expect(broken.result.current.savedPatches).toEqual([]);
    broken.unmount();

    storage.set(STORE, '{"not":"a list"}');
    const notList = await setup();
    expect(notList.result.current.savedPatches).toEqual([]);
    notList.unmount();
  });

  it('keeps saved patches for the visit when storage is full', async () => {
    const { result } = await setup();
    isFull = true;
    act(() => result.current.saveCurrentPatch());
    expect(result.current.savedPatches).toHaveLength(1);
    act(() => result.current.deleteSavedPatch(0));
    expect(result.current.savedPatches).toHaveLength(0);
  });

  it('normalizes every preset once, so each compares equal to its playing copy', async () => {
    const { result } = await setup();
    const presets = Object.values(result.current.PRESETS);
    expect(presets).toHaveLength(6);
    for (const preset of presets) {
      expect(normalizePatch(preset)).toEqual(preset);
    }
  });

  it('stops the engine when it goes away', async () => {
    const { engine, unmount } = await setup();
    unmount();
    expect(engine.stop).toHaveBeenCalled();
  });
});
