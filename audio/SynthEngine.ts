
import { AudioFeatures, DrumEvent, NoteEvent, SynthPatch, WaveShape } from '../types';
import { FeatureExtractor, createAnalysers, silentFeatures } from './analysis';
import { EnvelopeShape, extendEnvelope, scheduleEnvelope } from './envelope';
import { Part } from './patch';

const SUB_MIN_HZ = 40;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * A tanh soft-clipping curve. `amount` 0 is no curve (the shaper passes the signal through untouched); 1 drives
 * it about 20 dB into the curve. Make-up gain keeps a half-scale sine as loud (RMS) as it went in.
 */
const driveCurve = (amount: number): Float32Array | null => {
  if (amount <= 0) return null;
  const k = 1 + amount * 9;
  const shape = (x: number) => Math.tanh(k * x);
  let rmsIn = 0, rmsOut = 0;
  for (let i = 0; i < 256; i++) {
    const x = 0.5 * Math.sin((2 * Math.PI * i) / 256);
    rmsIn += x * x;
    rmsOut += shape(x) * shape(x);
  }
  const makeup = Math.sqrt(rmsIn / rmsOut);
  const curve = new Float32Array(2049);
  for (let i = 0; i < curve.length; i++) curve[i] = makeup * shape((i / (curve.length - 1)) * 2 - 1);
  return curve;
};

/** A sounding note, kept so a slide note can hold it and bend it to a new pitch instead of starting another. */
interface Voice {
  start: number;
  duration: number; // seconds the key is held, from `start`
  gateEnd: number;
  stopAt: number;
  freq: number; // the pitch its oscillators were built at; slides bend away from it
  env: GainNode;
  shape: EnvelopeShape;
  peak: number;
  sources: AudioScheduledSourceNode[]; // everything that sounds as long as the note is held
  nodes: AudioNode[];
  bend: ConstantSourceNode; // cents added to every pitch in the note
  bendTo: number;
  bendEnd: number;
  fm?: { gain: GainNode; depth: number; amount: number }; // a steady FM depth, which follows the pitch
  heldAt: number;
  cleanup?: number;
}

export class SynthEngine {
  private ctx: AudioContext;
  private extractor: FeatureExtractor;
  private masterGain: GainNode;
  private voiceOutput: GainNode;
  private drumOutput: GainNode;
  private noiseBuffer: AudioBuffer | undefined;
  
  // Master Effects
  private masterFilter: BiquadFilterNode;

  // Sends
  private delayNode: DelayNode;
  private delayFeedback: GainNode;
  private delayWet: GainNode;
  
  private convolver: ConvolverNode;
  private reverbWet: GainNode;

  private isPlaying: boolean = false;
  private isMuted: boolean = false;
  private currentPatch: SynthPatch | null = null;
  
  // State
  private masterVolumeLevel: number = 0.4; // Default to 40% for safety
  
  // Scheduling
  private nextNoteTime: number = 0;
  private currentStep: number = 0;
  private timerID: number | undefined;
  private lookahead: number = 25.0; // ms
  // Per part: the voice that sounded last, which a slide note holds and bends, and the pitch the part last went to.
  private active: Record<Part, Voice | null> = { lead: null, bass: null };
  private lastPitch: Record<Part, { freq: number; time: number; from: number } | null> = { lead: null, bass: null };
  // Soft clipping on the synth voices (not the drums), set by the patch's `drive`.
  private drive: WaveShaperNode;
  private scheduleAheadTime: number = 0.1; // s

  // Analysis State
  private analysisTimer: number | undefined;
  public audioData: AudioFeatures;

  /** `silent` keeps the analysers fed but sends nothing to the speakers. */
  constructor(silent = false) {
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Graph: Voices -> VoiceOutput -> MasterFilter -> (Sends + Dry) -> MasterGain -> Analyser -> Dest
    
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.masterVolumeLevel;
    
    this.voiceOutput = this.ctx.createGain(); 
    // Drums skip the master filter, so the sweep slider doesn't dull them, but they share the music's
    // room and echo (wired below), so they sit in the same space instead of in front of it.
    this.drumOutput = this.ctx.createGain();
    this.drumOutput.gain.value = 0.7;
    this.drumOutput.connect(this.masterGain);
    
    // Master Filter (for DJ sweeps)
    this.masterFilter = this.ctx.createBiquadFilter();
    this.masterFilter.type = 'lowpass';
    this.masterFilter.frequency.value = 20000; // Open by default
    this.masterFilter.Q.value = 1;

    // --- Delay Setup ---
    this.delayNode = this.ctx.createDelay(2.0); 
    this.delayFeedback = this.ctx.createGain();
    this.delayWet = this.ctx.createGain();
    
    this.delayNode.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayNode);
    this.delayNode.connect(this.delayWet);
    this.delayWet.connect(this.masterGain);
    
    // --- Reverb Setup ---
    this.convolver = this.ctx.createConvolver();
    this.reverbWet = this.ctx.createGain();
    
    this.convolver.connect(this.reverbWet);
    this.reverbWet.connect(this.masterGain);
    const drumRoom = this.ctx.createGain();
    drumRoom.gain.value = 0.7;
    this.drumOutput.connect(drumRoom);
    drumRoom.connect(this.convolver);
    const drumEcho = this.ctx.createGain();
    drumEcho.gain.value = 0.3;
    this.drumOutput.connect(drumEcho);
    drumEcho.connect(this.delayNode);
    
    // Connect Chain. A rumble filter first: tones under ~35 Hz are barely audible, but laptop and
    // small speakers flutter on them (the 'blowing' sound), and they eat headroom.
    const rumble = this.ctx.createBiquadFilter();
    rumble.type = 'highpass';
    rumble.frequency.value = 35;
    rumble.Q.value = 0.707;
    this.drive = this.ctx.createWaveShaper();
    this.drive.oversample = '4x';
    this.voiceOutput.connect(this.drive);
    this.drive.connect(rumble);
    rumble.connect(this.masterFilter);
    
    // Split from Filter
    this.masterFilter.connect(this.masterGain); // Dry signal
    this.masterFilter.connect(this.delayNode);  // Send to delay
    this.masterFilter.connect(this.convolver);  // Send to reverb
    
    // Connect Master to Output
    const { lo, hi } = createAnalysers(this.ctx, this.masterGain);
    this.extractor = new FeatureExtractor(lo, hi);
    if (silent) {
      const mute = this.ctx.createGain();
      mute.gain.value = 0;
      this.masterGain.connect(mute);
      mute.connect(this.ctx.destination);
    } else {
      this.masterGain.connect(this.ctx.destination);
    }
    this.audioData = silentFeatures(this.ctx.sampleRate);
    
    this.analysisTimer = window.setInterval(this.loopAnalysis, 16);
  }

  public get isRunning() {
    return this.ctx.state === 'running';
  }

  public dispose() {
    this.stop();
    window.clearInterval(this.analysisTimer);
    void this.ctx.close();
  }

  public async resume() {
    if (this.ctx.state === 'suspended') {
      return this.ctx.resume();
    }
  }

  public setVolume(val: number) {
      this.masterVolumeLevel = Math.max(0, Math.min(1, val));
      if (!this.isMuted) {
          this.masterGain.gain.setTargetAtTime(this.masterVolumeLevel, this.ctx.currentTime, 0.1);
      }
  }

  public setMasterVolume(isMuted: boolean) {
      this.isMuted = isMuted;
      const target = isMuted ? 0 : this.masterVolumeLevel;
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.linearRampToValueAtTime(target, now + 0.1);
  }

  /** Notes not yet played use the new shape; the ones sounding finish as they were. */
  private waves: Partial<Record<string, PeriodicWave>> = {};

  // The four built-in shapes, plus three drawn from harmonics: a thin 25% pulse, an organ's drawbars, a bell's partials.
  private setWave(osc: OscillatorNode, shape: string) {
    const harmonics: Record<string, (n: number) => number> = {
      pulse: (n) => (2 / (n * Math.PI)) * Math.sin(n * Math.PI * 0.25),
      organ: (n) => ({ 1: 1, 2: 1, 3: 0.8, 4: 0.8, 5: 0.5, 6: 0.5, 8: 0.4 } as Record<number, number>)[n] ?? 0,
      bell: (n) => ({ 1: 1, 2: 0.25 } as Record<number, number>)[n] ?? 0,
    };
    const weight = harmonics[shape];
    if (!weight) { osc.type = shape as OscillatorType; return; }
    if (!this.waves[shape]) {
      const real = new Float32Array(33), imag = new Float32Array(33);
      for (let n = 1; n < 33; n++) imag[n] = weight(n);
      this.waves[shape] = this.ctx.createPeriodicWave(real, imag);
    }
    osc.setPeriodicWave(this.waves[shape]!);
  }

  public setOscillatorType(type: WaveShape, part: Part) {
      const p = this.currentPatch;
      if (p) this.currentPatch = { ...p, [part]: { ...p[part], oscillator: { ...p[part].oscillator, type } } };
  }

  /** One part's own filter cutoff. Notes not yet played use it; the ones sounding finish as they were. */
  public setPatchFilterFreq(freq: number, part: Part) {
      const p = this.currentPatch;
      if (p) this.currentPatch = { ...p, [part]: { ...p[part], filter: { ...p[part].filter, frequency: freq } } };
  }

  public setBPM(bpm: number) {
      if (this.currentPatch) {
          this.currentPatch.bpm = Math.max(20, Math.min(300, bpm));
      }
  }

  public setFilterFreq(freq: number) {
      // Updates the master sweep filter
      this.masterFilter.frequency.setTargetAtTime(Math.max(20, Math.min(22000, freq)), this.ctx.currentTime, 0.1);
  }

  public loadPatch(patch: SynthPatch) {
    console.log("SynthEngine loading patch:", patch.name);
    this.currentPatch = patch;
    this.active = { lead: null, bass: null };
    this.lastPitch = { lead: null, bass: null };
    
    const now = this.ctx.currentTime;

    // Reset Master Filter slightly but keep it somewhat open or use patch default if we mapped it
    this.masterFilter.frequency.setTargetAtTime(20000, now, 0.5);

    // Apply Delay Params
    if (patch.delay) {
        this.delayNode.delayTime.setTargetAtTime(patch.delay.time, now, 0.1);
        this.delayFeedback.gain.setTargetAtTime(patch.delay.feedback, now, 0.1);
        this.delayWet.gain.setTargetAtTime(patch.delay.mix, now, 0.1);
    } else {
        this.delayWet.gain.setTargetAtTime(0, now, 0.1);
    }

    this.drive.curve = driveCurve(clamp(Number(patch.drive) || 0, 0, 1));

    // Apply Reverb Params
    if (patch.reverb) {
        this.reverbWet.gain.setTargetAtTime(patch.reverb.mix, now, 0.1);
        const seconds = Number(patch.reverb.decay);
        const impulse = this.generateImpulse(clamp(Number.isFinite(seconds) ? seconds : 2, 0.1, 6), clamp(Number(patch.reverb.tone ?? 0.4), 0, 1));
        this.convolver.buffer = impulse;
    } else {
        this.reverbWet.gain.setTargetAtTime(0, now, 0.1);
    }
  }

  /**
   * A room's tail: independent noise per ear, so it has width, and low-passed more as it fades, the way
   * air and walls soak up the highs. `tone` sets how bright it starts: 0 is a dark room, 1 a bright plate.
   * `seconds` is the reverb time (RT60): the tail's envelope decays exponentially to −60 dB at its end. The
   * narrowing filter takes the highs down a further ~8 dB, so they die sooner, as they do in a real room.
   */
  private generateImpulse(seconds: number, tone: number) {
      const sampleRate = this.ctx.sampleRate;
      const length = Math.floor(sampleRate * seconds);
      const impulse = this.ctx.createBuffer(2, length, sampleRate);
      const startHz = 2500 + tone * 13000;
      for (let channel = 0; channel < 2; channel++) {
          const data = impulse.getChannelData(channel);
          let y = 0;
          for (let i = 0; i < length; i++) {
              const progress = i / length;
              const cutoff = startHz * (1 - 0.85 * progress);
              const a = 1 - Math.exp((-2 * Math.PI * cutoff) / sampleRate);
              y += a * ((Math.random() * 2 - 1) - y);
              data[i] = y * Math.exp(-6.91 * progress);
          }
      }
      return impulse;
  }

  public start() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.currentStep = 0;
    this.active = { lead: null, bass: null };
    this.lastPitch = { lead: null, bass: null };
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.scheduler();
  }

  public stop() {
    this.isPlaying = false;
    window.clearTimeout(this.timerID);
  }

  private scheduler() {
    if (!this.currentPatch) return;

    while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
      this.scheduleNote(this.currentStep, this.nextNoteTime);
      this.nextStep();
    }
    
    if (this.isPlaying) {
        this.timerID = window.setTimeout(() => this.scheduler(), this.lookahead);
    }
  }

  private nextStep() {
    if (!this.currentPatch) return;
    const secondsPerBeat = 60.0 / this.currentPatch.bpm;
    const secondsPerStep = secondsPerBeat * 0.25; 
    this.nextNoteTime += secondsPerStep;
    
    this.currentStep++;
    const limit = this.currentPatch.totalSteps || 32;
    if (this.currentStep >= limit) { 
      this.currentStep = 0;
    }
  }

  private scheduleNote(step: number, gridTime: number) {
    if (!this.currentPatch) return;
    // Swing: every off-beat sixteenth lands late by this share of a step. A third of a step is triplet swing.
    const swing = clamp(Number(this.currentPatch.swing) || 0, 0, 0.5);
    const time = step % 2 === 1 ? gridTime + swing * (15 / (Number(this.currentPatch.bpm) || 120)) : gridTime;

    const melody = this.currentPatch.melody || [];
    melody.forEach(note => {
      if (Math.floor(note.startStep) === step) {
        this.triggerVoice(note, time, 'lead');
      }
    });

    (this.currentPatch.drums || []).forEach(hit => {
      if (Math.floor(hit.startStep) === step) this.triggerDrum(hit, time);
    });

    const bassline = this.currentPatch.bassline || [];
    bassline.forEach(note => {
      if (Math.floor(note.startStep) === step) {
        this.triggerVoice(note, time, 'bass');
      }
    });
  }

  private triggerVoice(note: NoteEvent, time: number, part: Part) {
    if (!this.currentPatch) return;
    const freq = Number(note.freq);
    if (!Number.isFinite(freq) || freq <= 0) return;
    const inst = this.currentPatch[part];
    const stepSeconds = 15 / (Number(this.currentPatch.bpm) || 120);
    const duration = Math.max(1, Number(note.durationSteps) || 1) * stepSeconds;
    const glide = clamp(inst.glide ?? 0.06, 0, 2);

    // The pitch a slide starts from: the part's previous note. Notes of one chord all start from the same place.
    const last = this.lastPitch[part];
    const from = last ? (Math.abs(time - last.time) < 0.001 ? last.from : last.freq) : freq;
    this.lastPitch[part] = { freq, time, from };
    const sounding = this.active[part];
    if (note.slide && sounding && this.hold(sounding, freq, time, duration, glide, stepSeconds)) return;

    const velocity = clamp(Number(note.velocity) || 1, 0.1, 1);
    const peak = 0.5 * velocity * clamp(Number(inst.level ?? 1), 0, 1);
    if (!(peak > 0)) return;

    const { attack, decay, sustain, release } = inst.envelope;
    // Tweak attack for snappier transients if requested by AI
    const shape: EnvelopeShape = { attack: Math.max(0.005, attack), decay, sustain, release };
    const end = time + duration + release + 0.1;
    const nodes: AudioNode[] = [];
    // Everything with a pitch in this note, so the pitch LFO and a slide move them together.
    const pitched: OscillatorNode[] = [];
    // Bell partials ring for a moment and stop on their own; the rest last as long as the note is held.
    const struck: OscillatorNode[] = [];
    const osc = (wave: string, hz: number) => {
      const o = this.ctx.createOscillator();
      this.setWave(o, wave);
      o.frequency.value = hz;
      nodes.push(o);
      pitched.push(o);
      return o;
    };
    const gain = (value: number) => {
      const g = this.ctx.createGain();
      g.gain.value = value;
      nodes.push(g);
      return g;
    };

    const wave = inst.oscillator.type || 'sine';
    const detune = clamp(Number(inst.oscillator.detune) || 0, -100, 100);
    const fmAmount = clamp(Number(inst.oscillator.fmAmount) || 0, 0, 100);

    // Filter: one resonant biquad, 12 dB an octave. Slope 24 puts a flat (Butterworth) stage before it, so the
    // slope beyond the cutoff is twice as steep while the resonance stays a single peak.
    const filterType = inst.filter.type || 'lowpass';
    const cutoff = clamp(Number(inst.filter.frequency) || 1000, 20, 20000);
    const q = Number(inst.filter.q);
    const stages = (inst.filter.slope === 24 ? [true, false] : [false]).map((flat) => {
      const f = this.ctx.createBiquadFilter();
      f.type = filterType;
      f.frequency.value = cutoff;
      // Lowpass and highpass Q is in dB, so a flat stage is -3.01 dB (a linear Q of 1/√2); bandpass Q is linear.
      f.Q.value = flat ? (filterType === 'bandpass' ? Math.SQRT1_2 : -3.0103) : Number.isFinite(q) ? q : 1;
      nodes.push(f);
      return f;
    });
    stages.slice(1).forEach((f, i) => stages[i].connect(f));
    const input = stages[0];

    // The carriers sound the note itself: one, or with a detune two that beat. A pair runs at 1/√2 each, so it
    // carries one carrier's power and sounds as loud.
    const carrierBus = gain(detune !== 0 ? Math.SQRT1_2 : 1);
    carrierBus.connect(input);
    const carriers = [osc(wave, freq)];
    if (detune !== 0) {
      const second = osc(wave, freq);
      second.detune.value = detune;
      carriers.push(second);
    }
    carriers.forEach((c) => c.connect(carrierBus));

    // Sub: a sine an octave down, never modulated, and only above ~40 Hz, since lower it is a rumble, not a note.
    const subLevel = clamp(Number(inst.sub) || 0, 0, 1);
    if (subLevel > 0 && freq / 2 >= SUB_MIN_HZ) {
      const sub = osc('sine', freq / 2);
      const subGain = gain(subLevel);
      sub.connect(subGain);
      subGain.connect(input);
    }

    // FM: a modulator at `fmRatio` times the note swings the carriers' frequency. The swing follows the note
    // (fmAmount × 20 Hz at 440 Hz), so the modulation index, and with it the timbre, holds across the range.
    let fm: Voice['fm'];
    if (fmAmount > 0) {
      const mod = osc(inst.oscillator.fmWave || wave, freq * (Number(inst.oscillator.fmRatio) || 2.0));
      const depth = fmAmount * 20 * (freq / 440);
      const modGain = gain(0);
      modGain.gain.setValueAtTime(depth, time);
      // An FM decay lets the brightness fade within the note, as a struck sound's does: depth falls to a tenth in `fmDecay` seconds.
      const fmDecay = Number(inst.oscillator.fmDecay);
      if (fmDecay > 0) modGain.gain.setTargetAtTime(0, time, clamp(fmDecay, 0.02, 8) / Math.LN10);
      else fm = { gain: modGain, depth, amount: fmAmount };
      mod.connect(modGain);
      carriers.forEach((c) => modGain.connect(c.frequency));
    }

    // A struck bar's strike (glockenspiel modes 2.76, 5.40, 8.93): inharmonic partials that ring briefly above the note and die away faster the higher they sit.
    if (wave === 'bell') {
      ([[2.76, 0.5, 0.9], [5.4, 0.3, 0.5], [8.93, 0.16, 0.28]] as const).forEach(([ratio, level, ring]) => {
        const partial = osc('sine', freq * ratio);
        const partialGain = gain(0);
        partialGain.gain.setValueAtTime(level * 0.6, time);
        partialGain.gain.exponentialRampToValueAtTime(0.001, time + ring);
        partial.connect(partialGain);
        partialGain.connect(input);
        partial.start(time);
        partial.stop(Math.min(end, time + ring + 0.05));
        struck.push(partial);
      });
    }

    // A second oscillator under the note, blended in by `mix`.
    const layer = inst.oscillator.layer;
    if (layer && layer.mix > 0) {
      const layerFreq = freq * Math.pow(2, Math.round(clamp(Number(layer.octave) || 0, -2, 2)));
      if (layerFreq >= SUB_MIN_HZ && layerFreq < 12000) {
        const layerOsc = osc(layer.type, layerFreq);
        layerOsc.detune.value = Number(layer.detune) || 0;
        const layerGain = gain(clamp(Number(layer.mix), 0, 1) * 0.8);
        layerOsc.connect(layerGain);
        layerGain.connect(input);
      }
    }

    const sources: AudioScheduledSourceNode[] = pitched.filter((o) => !struck.includes(o));

    // Filter envelope: each note's cutoff starts `envAmount` octaves away and glides back to the set cutoff.
    // With an accent, a softer note sweeps less, as a 303's accent does: velocity scales the sweep by up to `accent`.
    const accent = clamp(Number(inst.filter.accent) || 0, 0, 1);
    const sweep = (Number(inst.filter.envAmount) || 0) * (1 - accent + accent * velocity);
    if (sweep !== 0) {
      const sweepFrom = clamp(cutoff * Math.pow(2, sweep), 20, 20000);
      stages.forEach((f) => {
        f.frequency.setValueAtTime(sweepFrom, time);
        f.frequency.exponentialRampToValueAtTime(cutoff, time + shape.attack + Math.max(0.05, decay));
      });
    }

    // Gain Envelope
    const env = this.ctx.createGain();
    nodes.push(env);
    scheduleEnvelope(env.gain, time, duration, shape, peak);
    stages[stages.length - 1].connect(env);

    // A slow wobble that restarts with each note: on the cutoff, on the pitch, or on the level.
    let tail: AudioNode = env;
    const lfo = inst.lfo;
    if (lfo && lfo.depth > 0) {
      const lfoOsc = this.ctx.createOscillator();
      const lfoGain = gain(0);
      const depth = clamp(Number(lfo.depth), 0, 1);
      lfoOsc.frequency.value = clamp(Number(lfo.rate) || 1, 0.05, 20);
      if (lfo.target === 'filter') {
        lfoGain.gain.value = depth * 1200; // cents: up to an octave either way
        stages.forEach((f) => lfoGain.connect(f.detune));
      } else if (lfo.target === 'pitch') {
        lfoGain.gain.value = depth * 100; // cents: up to a semitone either way
        pitched.forEach((p) => lfoGain.connect(p.detune));
      } else {
        const tremolo = gain(1 - depth / 2);
        lfoGain.gain.value = depth / 2;
        lfoGain.connect(tremolo.gain);
        env.connect(tremolo);
        tail = tremolo;
      }
      lfoOsc.connect(lfoGain);
      nodes.push(lfoOsc);
      sources.push(lfoOsc);
    }

    // Slide: a slide note that can't hold the last voice (it had stopped, or there was none) starts its own and
    // bends into its pitch from the previous note's, evenly in cents. Other notes jump straight to theirs.
    const bend = this.ctx.createConstantSource();
    const bendFrom = note.slide && from !== freq ? 1200 * Math.log2(from / freq) : 0;
    let bendEnd = time;
    bend.offset.setValueAtTime(bendFrom, time);
    if (bendFrom) {
      bendEnd = time + Math.max(0.005, Math.min(glide, duration));
      bend.offset.linearRampToValueAtTime(0, bendEnd);
    }
    pitched.forEach((p) => bend.connect(p.detune));
    nodes.push(bend);
    sources.push(bend);

    // Panning & Output
    const panner = this.ctx.createStereoPanner();
    const spread = part === 'bass' ? 0.1 : 0.6;
    panner.pan.value = (Math.random() * spread * 2) - spread;
    nodes.push(panner);
    tail.connect(panner);
    panner.connect(this.voiceOutput);

    sources.forEach((s) => { s.start(time); s.stop(end); });

    const voice: Voice = {
      start: time, duration, gateEnd: time + duration, stopAt: end, freq, env, shape, peak,
      sources, nodes, bend, bendTo: 0, bendEnd, fm, heldAt: time,
    };
    this.active[part] = voice;
    this.disposeLater(voice);
  }

  /**
   * Holds a sounding voice into a slide note, as a 303 does: no new attack and no new filter sweep, just the pitch
   * bending to the new note over `glide` seconds. Only a voice still held when the note starts is joined (or just
   * let go, which swing can do); otherwise, and for a chord's second note, it returns false and a new voice starts.
   */
  private hold(v: Voice, freq: number, time: number, duration: number, glide: number, stepSeconds: number) {
    if (time <= v.start + 0.001 || Math.abs(time - v.heldAt) < 0.001 || time > v.gateEnd + stepSeconds / 2) return false;
    if (time >= v.stopAt - 0.02 || this.ctx.currentTime >= v.stopAt - 0.02) return false;
    const total = extendEnvelope(v.env.gain, v.start, v.duration, time, duration, v.shape, v.peak);
    if (total === null) return false;

    v.duration = total;
    v.gateEnd = v.start + total;
    v.stopAt = v.gateEnd + v.shape.release + 0.1;
    v.heldAt = time;
    v.sources.forEach((s) => s.stop(v.stopAt));

    // Ramps never overlap: a new one starts where the last ends, so nothing scheduled needs cancelling.
    const at = Math.max(time, v.bendEnd);
    const to = at + Math.max(0.005, glide);
    const cents = 1200 * Math.log2(freq / v.freq);
    v.bend.offset.setValueAtTime(v.bendTo, at);
    v.bend.offset.linearRampToValueAtTime(cents, to);
    v.bendTo = cents;
    v.bendEnd = to;
    if (v.fm) {
      // Keep the modulation index, and so the timbre, as the pitch moves.
      const depth = v.fm.amount * 20 * (freq / 440);
      v.fm.gain.gain.setValueAtTime(v.fm.depth, at);
      v.fm.gain.gain.linearRampToValueAtTime(depth, to);
      v.fm.depth = depth;
    }
    this.disposeLater(v);
    return true;
  }

  /** Disconnects a voice's nodes once it has stopped; a held voice pushes this back. */
  private disposeLater(v: Voice) {
    window.clearTimeout(v.cleanup);
    v.cleanup = window.setTimeout(() => v.nodes.forEach((n) => n.disconnect()), (v.stopAt - this.ctx.currentTime + 1) * 1000);
  }

  private noise() {
    if (!this.noiseBuffer) {
      const length = this.ctx.sampleRate;
      this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    return this.noiseBuffer;
  }

  /** A burst of filtered noise that dies away over `decay` seconds. */
  private noiseBurst(at: number, kind: BiquadFilterType, hz: number, q: number, peak: number, decay: number) {
    const src = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    src.buffer = this.noise();
    filter.type = kind;
    filter.frequency.value = hz;
    filter.Q.value = q;
    gain.gain.setValueAtTime(peak, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + decay);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.drumOutput);
    src.start(at, Math.random() * 0.5);
    src.stop(at + decay + 0.02);
    src.onended = () => { src.disconnect(); filter.disconnect(); gain.disconnect(); };
  }

  /** A pitched thump or snap that falls from `fromHz` to `toHz`. */
  private tone(at: number, shape: OscillatorType, fromHz: number, toHz: number, sweep: number, peak: number, decay: number) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = shape;
    osc.frequency.setValueAtTime(fromHz, at);
    osc.frequency.exponentialRampToValueAtTime(toHz, at + sweep);
    gain.gain.setValueAtTime(peak, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + decay);
    osc.connect(gain);
    gain.connect(this.drumOutput);
    osc.start(at);
    osc.stop(at + decay + 0.02);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }

  private triggerDrum(hit: DrumEvent, time: number) {
    const v = clamp(Number(hit.velocity) || 1, 0.1, 1);
    switch (hit.type) {
      case 'kick':
        this.tone(time, 'sine', 150, 45, 0.12, 0.9 * v, 0.4);
        break;
      case 'snare':
        this.noiseBurst(time, 'bandpass', 1800, 0.8, 0.5 * v, 0.18);
        this.tone(time, 'triangle', 220, 170, 0.08, 0.35 * v, 0.1);
        break;
      case 'clap':
        [0, 0.012, 0.024].forEach((offset, i) =>
          this.noiseBurst(time + offset, 'bandpass', 1200, 1.2, 0.4 * v, i === 2 ? 0.16 : 0.02));
        break;
      default:
        this.noiseBurst(time, 'highpass', 7500, 0.7, 0.3 * v, 0.05);
    }
  }

  // A timer, not requestAnimationFrame: frames stop in a hidden tab, and the tab icon still needs the signal.
  private loopAnalysis = () => {
    this.audioData = this.extractor.read();
  }
}
