import { AudioFeatures } from '../types';
import { silentFeatures } from './analysis';

/* A soft A with a quiet fifth and a slow vibrato, shaped like the analyser's output, for canvases drawn with no sound playing. */
const FS = 44100;
const NOTES = [
  { hz: 220, amp: 0.5, pc: 9 },
  { hz: 330, amp: 0.12, pc: 4 },
];
const BIN_HZ = FS / 2 / 128;

export const demoFeatures = (seconds: number, out: AudioFeatures = silentFeatures(FS)): AudioFeatures => {
  const vibrato = 1 + 0.012 * Math.sin(seconds * 0.9);
  const swell = 0.75 + 0.25 * Math.sin(seconds * 0.5);

  for (let i = 0; i < out.scope.length; i++) {
    const t = seconds - (out.scope.length - 1 - i) / FS;
    let s = 0;
    for (const n of NOTES) s += n.amp * Math.sin(2 * Math.PI * n.hz * vibrato * t);
    out.scope[i] = s * 0.3 * swell;
  }
  for (let i = 0; i < out.waveform.length; i++) {
    out.waveform[i] = Math.max(0, Math.min(255, 128 + out.scope[out.scope.length - 1 - (out.waveform.length - 1 - i) * 8] * 160));
  }
  for (let b = 0; b < out.fft.length; b++) {
    let level = 0.02;
    for (const n of NOTES) {
      const d = b - (n.hz * vibrato) / BIN_HZ;
      level += n.amp * Math.exp(-(d * d) / 1.2);
    }
    out.fft[b] = Math.min(255, level * 150 * swell);
  }
  out.chroma.fill(0);
  for (const n of NOTES) out.chroma[n.pc] = Math.max(out.chroma[n.pc], n.amp * 2);
  out.chroma[9] = 1;

  out.volume = 0.18 * swell;
  out.bass = 0.2 * swell;
  out.mid = 0.14 * swell;
  out.treble = 0.02;
  out.centroidHz = 260;
  out.centroid = Math.log(out.centroidHz / 100) / Math.log(80);
  out.flux = 0.04;
  out.peakHz = 220 * vibrato;
  return out;
};
