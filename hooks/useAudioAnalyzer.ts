import { useCallback, useEffect, useRef, useState } from 'react';
import { createAnalysers, FeatureExtractor, silentFeatures } from '../audio/analysis.ts';
import type { AudioFeatures } from '../types.ts';

/** Older Safari only has the prefixed constructor. */
declare global {
  var webkitAudioContext: typeof AudioContext | undefined;
}

export const useAudioAnalyzer = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const extractorRef = useRef<FeatureExtractor | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);

  // Read synchronously by the frame loop, so state updates can't leave it stale.
  const isRunningRef = useRef(false);

  const audioDataRef = useRef<AudioFeatures>(silentFeatures());

  // A timer, not requestAnimationFrame, so the tab icon keeps moving while the tab is hidden.
  const updateAnalysis = () => {
    if (!(extractorRef.current && isRunningRef.current)) {
      return;
    }
    audioDataRef.current = extractorRef.current.read();
  };

  const startAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
      audioContextRef.current = ctx;
      const { lo, hi } = createAnalysers(ctx, ctx.createMediaStreamSource(stream));
      extractorRef.current = new FeatureExtractor(lo, hi);

      isRunningRef.current = true;
      setIsAudioEnabled(true);
      timerRef.current = globalThis.setInterval(updateAnalysis, 16);
    } catch {
      alert('Microphone access denied or not available.');
    }
  };

  // Releases the microphone, so the browser's recording indicator goes away.
  const stopAudio = useCallback(() => {
    isRunningRef.current = false;
    if (timerRef.current) {
      globalThis.clearInterval(timerRef.current);
    }
    timerRef.current = null;
    for (const t of streamRef.current?.getTracks() ?? []) {
      t.stop();
    }
    streamRef.current = null;
    audioContextRef.current?.close();
    audioContextRef.current = null;
    extractorRef.current = null;
    audioDataRef.current = silentFeatures();
    setIsAudioEnabled(false);
  }, []);

  useEffect(() => stopAudio, [stopAudio]);

  return { isAudioEnabled, startAudio, stopAudio, audioDataRef };
};
