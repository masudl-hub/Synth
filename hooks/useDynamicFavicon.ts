import { useEffect, type MutableRefObject } from 'react';
import { AudioFeatures } from '../types';

const SIZE = 32;
const INTERVAL_MS = 100;
const GAIN = 1.6;

/** Index of the first rising zero crossing in [0, last], so each frame starts on the same phase. */
const triggerOf = (scope: Float32Array, last: number) => {
  for (let i = 1; i <= last; i++) if (scope[i - 1] < 0 && scope[i] >= 0) return i;
  return 0;
};

/**
 * Draws the tab icon as a small oscilloscope of the live signal: about three periods of the
 * loudest pitch, trigger-aligned, one min–max column per pixel so nothing aliases away.
 * It runs on a timer, not requestAnimationFrame, so it keeps moving while the tab is hidden.
 */
export const useDynamicFavicon = (audioDataRef: MutableRefObject<AudioFeatures>) => {
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    const icon = link;

    const draw = () => {
      const { scope, peakHz, sampleRate } = audioDataRef.current;
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.fillStyle = '#ffffff';

      const span = peakHz > 0 ? Math.round((3 * sampleRate) / peakHz) : 512;
      const length = Math.min(scope.length, Math.max(256, span));
      const start = triggerOf(scope, scope.length - length);
      const mid = SIZE / 2;

      for (let x = 0; x < SIZE; x++) {
        const from = start + Math.floor((x * length) / SIZE);
        const to = start + Math.max(from - start + 1, Math.floor(((x + 1) * length) / SIZE));
        let lo = 0;
        let hi = 0;
        for (let i = from; i < to && i < scope.length; i++) {
          if (scope[i] < lo) lo = scope[i];
          if (scope[i] > hi) hi = scope[i];
        }
        const top = Math.round(mid - Math.min(1, hi * GAIN) * mid);
        const bottom = Math.round(mid - Math.max(-1, lo * GAIN) * mid);
        ctx.fillRect(x, Math.min(top, mid - 1), 1, Math.max(2, bottom - top));
      }
      icon.href = canvas.toDataURL('image/png');
    };

    const timer = window.setInterval(draw, INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [audioDataRef]);
};
