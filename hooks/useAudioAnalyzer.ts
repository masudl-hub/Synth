import { useRef, useState, useEffect } from 'react';
import { AudioFeatures } from '../types';
import { FeatureExtractor, createAnalysers, silentFeatures } from '../audio/analysis';

export const useAudioAnalyzer = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const extractorRef = useRef<FeatureExtractor | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);

  // Read synchronously by the frame loop, so state updates can't leave it stale.
  const isRunningRef = useRef(false);

  const audioDataRef = useRef<AudioFeatures>(silentFeatures());

  // A timer, not requestAnimationFrame, so the tab icon keeps moving while the tab is hidden.
  const updateAnalysis = () => {
    if (!extractorRef.current || !isRunningRef.current) return;
    audioDataRef.current = extractorRef.current.read();
  };

  const startAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = ctx;
      const { lo, hi } = createAnalysers(ctx, ctx.createMediaStreamSource(stream));
      extractorRef.current = new FeatureExtractor(lo, hi);

      isRunningRef.current = true;
      setIsAudioEnabled(true);
      timerRef.current = window.setInterval(updateAnalysis, 16);
    } catch (e) {
      console.error("Audio init failed", e);
      alert("Microphone access denied or not available.");
    }
  };

  // Releases the microphone, so the browser's recording indicator goes away.
  const stopAudio = () => {
    isRunningRef.current = false;
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioContextRef.current?.close();
    audioContextRef.current = null;
    extractorRef.current = null;
    audioDataRef.current = silentFeatures();
    setIsAudioEnabled(false);
  };

  useEffect(() => stopAudio, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { isAudioEnabled, startAudio, stopAudio, audioDataRef };
};
