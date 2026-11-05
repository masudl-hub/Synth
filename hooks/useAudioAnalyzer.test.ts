import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { silentFeatures } from '../audio/analysis.ts';
import { useAudioAnalyzer } from './useAudioAnalyzer.ts';

const reading = { ...silentFeatures(), volume: 0.5 };

vi.mock('../audio/analysis.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../audio/analysis.ts')>();
  return {
    ...actual,
    createAnalysers: () => ({ lo: {}, hi: {} }),
    FeatureExtractor: class {
      read() {
        return reading;
      }
    },
  };
});

const track = { stop: vi.fn() };
const close = vi.fn();
const getUserMedia = vi.fn();

class FakeAudioContext {
  createMediaStreamSource() {
    return {};
  }
  close() {
    close();
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  track.stop.mockClear();
  close.mockClear();
  getUserMedia.mockReset();
  getUserMedia.mockResolvedValue({ getTracks: () => [track] });
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  vi.stubGlobal('AudioContext', FakeAudioContext);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const started = async () => {
  const hook = renderHook(() => useAudioAnalyzer());
  await act(() => hook.result.current.startAudio());
  return hook;
};

describe('useAudioAnalyzer', () => {
  it('starts silent and disabled', () => {
    const { result } = renderHook(() => useAudioAnalyzer());
    expect(result.current.isAudioEnabled).toBe(false);
    expect(result.current.audioDataRef.current.volume).toBe(0);
  });

  it('reads features from the microphone on a timer once started', async () => {
    const { result } = await started();
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(result.current.isAudioEnabled).toBe(true);
    vi.advanceTimersByTime(20);
    expect(result.current.audioDataRef.current).toBe(reading);
  });

  it('falls back to the prefixed constructor', async () => {
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', FakeAudioContext);
    const { result } = await started();
    expect(result.current.isAudioEnabled).toBe(true);
  });

  it('releases the microphone and goes silent on stop', async () => {
    const { result } = await started();
    vi.advanceTimersByTime(20);
    act(() => result.current.stopAudio());
    expect(track.stop).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
    expect(result.current.isAudioEnabled).toBe(false);
    expect(result.current.audioDataRef.current.volume).toBe(0);
    vi.advanceTimersByTime(100);
    expect(result.current.audioDataRef.current.volume).toBe(0);
  });

  it('stops before start without throwing', () => {
    const { result } = renderHook(() => useAudioAnalyzer());
    expect(() => act(() => result.current.stopAudio())).not.toThrow();
  });

  it('releases the microphone on unmount', async () => {
    const { unmount } = await started();
    unmount();
    expect(track.stop).toHaveBeenCalled();
  });

  it('tells the user when the microphone is unavailable', async () => {
    const alert = vi.fn();
    vi.stubGlobal('alert', alert);
    getUserMedia.mockRejectedValue(new Error('denied'));
    const { result } = renderHook(() => useAudioAnalyzer());
    await act(() => result.current.startAudio());
    expect(alert).toHaveBeenCalledWith('Microphone access denied or not available.');
    expect(result.current.isAudioEnabled).toBe(false);
  });
});
