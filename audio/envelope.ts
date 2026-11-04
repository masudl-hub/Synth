export interface EnvelopeShape {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

/** The level an exponential decay from `peak` to `sustain * peak` over `decay` seconds has reached after `t` seconds. */
const decayed = (peak: number, sustain: number, decay: number, t: number) =>
  peak * Math.pow(Math.max(0.001, sustain), Math.min(1, Math.max(0, t) / decay));

/**
 * Schedules one note's gain: attack, decay to sustain, hold, release. A note shorter than attack plus decay
 * is cut off mid-curve, and its release starts from wherever the curve had reached, so the level never
 * jumps (a jump is an audible click).
 */
export function scheduleEnvelope(
  gain: Pick<AudioParam, 'setValueAtTime' | 'linearRampToValueAtTime' | 'exponentialRampToValueAtTime'>,
  time: number,
  duration: number,
  { attack, decay, sustain, release }: EnvelopeShape,
  peak: number,
) {
  const floor = 0.001;
  gain.setValueAtTime(0, time);

  let level: number;
  if (duration <= attack) {
    level = peak * (duration / attack);
    gain.linearRampToValueAtTime(level, time + duration);
  } else {
    gain.linearRampToValueAtTime(peak, time + attack);
    if (duration < attack + decay) {
      level = decayed(peak, sustain, decay, duration - attack);
      gain.exponentialRampToValueAtTime(Math.max(floor, level), time + duration);
    } else {
      level = Math.max(floor, sustain * peak);
      gain.exponentialRampToValueAtTime(level, time + attack + decay);
      gain.setValueAtTime(level, time + duration);
    }
  }

  gain.exponentialRampToValueAtTime(floor, time + duration + release);
  // Down to true silence, so the oscillator stops on zero rather than on a tiny step.
  gain.linearRampToValueAtTime(0, time + duration + release + 0.01);
}
