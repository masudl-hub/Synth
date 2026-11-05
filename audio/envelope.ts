export interface EnvelopeShape {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

type Param = Pick<AudioParam, 'setValueAtTime' | 'linearRampToValueAtTime' | 'exponentialRampToValueAtTime' | 'cancelScheduledValues'>;

/** One breakpoint, `at` seconds after the note starts, reached from the one before by `ramp`. */
interface Point { at: number; value: number; ramp: 'set' | 'linear' | 'exp' }

const FLOOR = 0.001;

/** The level an exponential decay from `peak` to `sustain * peak` over `decay` seconds has reached after `t` seconds. */
const decayed = (peak: number, sustain: number, decay: number, t: number) =>
  peak * Math.pow(Math.max(FLOOR, sustain), Math.min(1, Math.max(0, t) / decay));

/**
 * One note's gain: attack, decay to sustain, hold, release. A note shorter than attack plus decay is cut off
 * mid-curve, and its release starts from wherever the curve had reached, so the level never jumps (a jump is
 * an audible click).
 */
function points(duration: number, { attack, decay, sustain, release }: EnvelopeShape, peak: number): Point[] {
  const out: Point[] = [{ at: 0, value: 0, ramp: 'set' }];
  if (duration <= attack) {
    out.push({ at: duration, value: peak * (duration / attack), ramp: 'linear' });
  } else {
    out.push({ at: attack, value: peak, ramp: 'linear' });
    if (duration < attack + decay) {
      out.push({ at: duration, value: Math.max(FLOOR, decayed(peak, sustain, decay, duration - attack)), ramp: 'exp' });
    } else {
      const level = Math.max(FLOOR, sustain * peak);
      out.push({ at: attack + decay, value: level, ramp: 'exp' }, { at: duration, value: level, ramp: 'set' });
    }
  }
  // Down to true silence, so the oscillator stops on zero rather than on a tiny step.
  out.push({ at: duration + release, value: FLOOR, ramp: 'exp' }, { at: duration + release + 0.01, value: 0, ramp: 'linear' });
  return out;
}

/** The level the curve has `t` seconds after the note starts. */
function levelAt(curve: Point[], t: number) {
  for (let i = 1; i < curve.length; i++) {
    const a = curve[i - 1], b = curve[i];
    if (t > b.at) continue;
    if (b.ramp === 'set') return t < b.at ? a.value : b.value;
    const f = b.at > a.at ? (t - a.at) / (b.at - a.at) : 1;
    return b.ramp === 'linear' || a.value <= 0 ? a.value + (b.value - a.value) * f : a.value * Math.pow(b.value / a.value, f);
  }
  return 0;
}

function apply(gain: Param, time: number, curve: Point[]) {
  curve.forEach(({ at, value, ramp }) => {
    if (ramp === 'set') gain.setValueAtTime(value, time + at);
    else if (ramp === 'linear') gain.linearRampToValueAtTime(value, time + at);
    else gain.exponentialRampToValueAtTime(Math.max(FLOOR, value), time + at);
  });
}

export function scheduleEnvelope(gain: Param, time: number, duration: number, shape: EnvelopeShape, peak: number) {
  apply(gain, time, points(duration, shape, peak));
}

/**
 * Holds a sounding note for `duration` more seconds from `at`, as if its key had been held down: no new attack. The
 * curve up to `at` stays exactly as it was. The ramp under way at `at` is replaced by one of the same kind that ends
 * on the level it would have reached, so nothing jumps, without `cancelAndHoldAtTime` (which Firefox lacks). Returns
 * the note's new total length, or null when it has already gone silent.
 */
export function extendEnvelope(gain: Param, time: number, oldDuration: number, at: number, duration: number, shape: EnvelopeShape, peak: number) {
  const before = points(oldDuration, shape, peak);
  const t = at - time;
  const segment = before.find((p) => p.at >= t);
  if (t <= 0 || !segment || segment === before[before.length - 1]) return null;
  const level = levelAt(before, t);
  gain.cancelScheduledValues(at);
  if (segment.ramp === 'linear') gain.linearRampToValueAtTime(level, at);
  else if (segment.ramp === 'exp') gain.exponentialRampToValueAtTime(Math.max(FLOOR, level), at);
  else gain.setValueAtTime(level, at);

  const total = t + duration;
  const after = points(total, shape, peak);
  // If the old note had already begun its release, ease back up to where the held note would be.
  let from = t;
  if (Math.abs(levelAt(after, t) - level) > 0.01 * peak) {
    gain.exponentialRampToValueAtTime(Math.max(FLOOR, levelAt(after, t + 0.005)), at + 0.005);
    from = t + 0.005;
  }
  apply(gain, time, after.filter((p) => p.at > from));
  return total;
}
