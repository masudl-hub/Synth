import { useRef, useState, useEffect } from 'react';
import { AudioFeatures } from '../types';
import { FeatureExtractor, createAnalysers, silentFeatures } from '../audio/analysis';

export const useAudioAnalyzer = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const extractorRef = useRef<FeatureExtractor | null>(null);
  const rafRef = useRef<number | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);

  // Read synchronously by the frame loop, so state updates can't leave it stale.
  const isRunningRef = useRef(false);

  const audioDataRef = useRef<AudioFeatures>(silentFeatures());

  const updateAnalysis = () => {
    if (!extractorRef.current || !isRunningRef.current) return;
    audioDataRef.current = extractorRef.current.read();
    rafRef.current = requestAnimationFrame(updateAnalysis);
  };

  const startAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = ctx;
      const { lo, hi } = createAnalysers(ctx, ctx.createMediaStreamSource(stream));
      extractorRef.current = new FeatureExtractor(lo, hi);

      isRunningRef.current = true;
      setIsAudioEnabled(true);
      updateAnalysis();
    } catch (e) {
      console.error("Audio init failed", e);
      alert("Microphone access denied or not available.");
    }
  };

  useEffect(() => {
    return () => {
      isRunningRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  return { isAudioEnabled, startAudio, audioDataRef };
};
