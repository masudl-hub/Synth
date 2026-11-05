import { renderHook } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { silentFeatures } from '../audio/analysis.ts';
import type { AudioFeatures } from '../types.ts';
import { useDynamicFavicon } from './useDynamicFavicon.ts';

const ICON_SELECTOR = "link[rel*='icon']";
const PNG_URL = /^data:image\/png/u;
const rects: number[][] = [];

const stubCanvas = (withContext: boolean) => {
  const ctx = {
    fillStyle: '',
    fillRect: (...args: number[]) => {
      rects.push(args);
    },
  };
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const element = Document.prototype.createElement.call(document, tag);
    if (tag === 'canvas') {
      Object.defineProperty(element, 'getContext', { value: () => (withContext ? ctx : null) });
      Object.defineProperty(element, 'toDataURL', { value: () => `data:image/png;base64,${rects.length}` });
    }
    return element;
  });
};

const ref = (audio: AudioFeatures): React.MutableRefObject<AudioFeatures> => ({ current: audio });

beforeEach(() => {
  rects.length = 0;
  vi.useFakeTimers();
  for (const link of document.querySelectorAll(ICON_SELECTOR)) {
    link.remove();
  }
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useDynamicFavicon', () => {
  it('adds an icon link and redraws it every 100 ms', () => {
    stubCanvas(true);
    const audio = silentFeatures();
    for (let i = 0; i < audio.scope.length; i++) {
      audio.scope[i] = Math.sin((2 * Math.PI * 440 * i) / audio.sampleRate);
    }
    audio.peakHz = 440;
    const { unmount } = renderHook(() => useDynamicFavicon(ref(audio)));
    vi.advanceTimersByTime(100);

    const link = document.querySelector<HTMLLinkElement>(ICON_SELECTOR);
    expect(link?.href).toMatch(PNG_URL);
    // Background, then one column per pixel, each inside the icon.
    expect(rects).toHaveLength(33);
    for (const [x, y, w, h] of rects.slice(1)) {
      expect(w).toBe(1);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y + h).toBeLessThanOrEqual(33);
      expect(x).toBeLessThan(32);
    }
    // A full-scale sine reaches both edges of the icon.
    expect(Math.min(...rects.slice(1).map((r) => r[1]))).toBe(0);
    expect(Math.max(...rects.slice(1).map((r) => r[1] + r[3]))).toBeGreaterThanOrEqual(31);

    unmount();
    const drawn = rects.length;
    vi.advanceTimersByTime(500);
    expect(rects).toHaveLength(drawn);
  });

  it('reuses an existing icon link and draws a flat line when silent', () => {
    stubCanvas(true);
    const existing = document.createElement('link');
    existing.rel = 'icon';
    document.head.appendChild(existing);
    renderHook(() => useDynamicFavicon(ref(silentFeatures())));
    vi.advanceTimersByTime(100);

    expect(document.querySelectorAll(ICON_SELECTOR)).toHaveLength(1);
    expect(existing.href).toMatch(PNG_URL);
    for (const [, y, , h] of rects.slice(1)) {
      expect([y, h]).toEqual([15, 2]);
    }
  });

  it('does nothing without a 2D context', () => {
    stubCanvas(false);
    renderHook(() => useDynamicFavicon(ref(silentFeatures())));
    vi.advanceTimersByTime(300);
    expect(document.querySelector(ICON_SELECTOR)).toBeNull();
    expect(rects).toHaveLength(0);
  });
});
