
import { useRef, useState, useEffect } from 'react';
import { AudioFeatures } from '../types';

export const useAudioAnalyzer = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  
  // Use a ref to track running state synchronously to avoid stale closures in the loop
  const isRunningRef = useRef(false);
  
  // Store previous FFT frame for Flux calculation
  const prevFFTRef = useRef<Uint8Array>(new Uint8Array(128));
  
  // Default silent state
  const audioDataRef = useRef<AudioFeatures>({
    volume: 0,
    bass: 0,
    mid: 0,
    treble: 0,
    fft: new Uint8Array(128),
    waveform: new Uint8Array(128),
    centroid: 0,
    flux: 0
  });

  const updateAnalysis = () => {
    if (!analyserRef.current || !isRunningRef.current) return;
    
    const bufferLength = analyserRef.current.frequencyBinCount; // 128 (set via fftSize=256)
    
    // Frequency Data
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    // Time Domain Data (Waveform)
    const waveformArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteTimeDomainData(waveformArray);
    
    // 1. Calculate Bands & Volume
    let bassSum = 0;
    let midSum = 0;
    let trebleSum = 0;
    let totalMagnitude = 0;
    let weightedFrequencySum = 0;
    let fluxSum = 0;
    
    const prevFFT = prevFFTRef.current;

    for (let i = 0; i < bufferLength; i++) {
        const val = dataArray[i] / 255;
        
        // Bands
        if (i < 5) bassSum += val;
        else if (i < 30) midSum += val;
        else trebleSum += val;
        
        // Spectral Centroid (Pitch/Timbre)
        // sum(magnitude * frequency_bin) / sum(magnitude)
        totalMagnitude += val;
        weightedFrequencySum += val * i;
        
        // Spectral Flux (Rhythm/Transient)
        // Sum of positive changes in magnitude
        const prevVal = prevFFT[i] / 255;
        const diff = val - prevVal;
        if (diff > 0) {
            fluxSum += diff;
        }
    }
    
    // Update previous frame for next loop
    prevFFTRef.current.set(dataArray);
    
    const bass = Math.min(1, bassSum / 5);
    const mid = Math.min(1, midSum / 25);
    const treble = Math.min(1, trebleSum / 98);
    const volume = (bass + mid + treble) / 3;
    
    // Normalize Centroid (0 to 1 roughly, covering main audible range in bins)
    // Avg bin index / Max bin count
    let centroid = 0;
    if (totalMagnitude > 0) {
        centroid = (weightedFrequencySum / totalMagnitude) / (bufferLength / 2); 
    }
    
    // Normalize Flux (experimentally tweaked scaler)
    const flux = Math.min(1, fluxSum / 10);

    audioDataRef.current = {
        volume,
        bass,
        mid,
        treble,
        fft: dataArray,
        waveform: waveformArray,
        centroid: Math.min(1, centroid),
        flux
    };
    
    rafRef.current = requestAnimationFrame(updateAnalysis);
  };

  const startAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256; // 128 bins
      analyserRef.current.smoothingTimeConstant = 0.8;
      
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current.connect(analyserRef.current);
      
      // Init prev buffer
      prevFFTRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);

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