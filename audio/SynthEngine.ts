
import { AudioFeatures, DrumEvent, SynthPatch } from '../types';
import { FeatureExtractor, createAnalysers, silentFeatures } from './analysis';
import { scheduleEnvelope } from './envelope';

const SUB_MIN_HZ = 40;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

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
  private scheduleAheadTime: number = 0.1; // s

  // Analysis State
  private analysisTimer: number | undefined;
  public audioData: AudioFeatures;

  constructor() {
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
    this.voiceOutput.connect(rumble);
    rumble.connect(this.masterFilter);
    
    // Split from Filter
    this.masterFilter.connect(this.masterGain); // Dry signal
    this.masterFilter.connect(this.delayNode);  // Send to delay
    this.masterFilter.connect(this.convolver);  // Send to reverb
    
    // Connect Master to Output
    const { lo, hi } = createAnalysers(this.ctx, this.masterGain);
    this.extractor = new FeatureExtractor(lo, hi);
    this.masterGain.connect(this.ctx.destination);
    this.audioData = silentFeatures(this.ctx.sampleRate);
    
    this.analysisTimer = window.setInterval(this.loopAnalysis, 16);
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
  public setOscillatorType(type: SynthPatch['oscillator']['type']) {
      if (this.currentPatch) this.currentPatch = { ...this.currentPatch, oscillator: { ...this.currentPatch.oscillator, type } };
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

    // Apply Reverb Params
    if (patch.reverb) {
        this.reverbWet.gain.setTargetAtTime(patch.reverb.mix, now, 0.1);
        const impulse = this.generateImpulse(2.0, patch.reverb.decay, clamp(Number(patch.reverb.tone ?? 0.4), 0, 1));
        this.convolver.buffer = impulse;
    } else {
        this.reverbWet.gain.setTargetAtTime(0, now, 0.1);
    }
  }

  /**
   * A room's tail: independent noise per ear, so it has width, and low-passed more as it fades, the way
   * air and walls soak up the highs. `tone` sets how bright it starts: 0 is a dark room, 1 a bright plate.
   */
  private generateImpulse(duration: number, decay: number, tone: number) {
      const sampleRate = this.ctx.sampleRate;
      const length = Math.floor(sampleRate * duration);
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
              data[i] = y * Math.pow(1 - progress, decay);
          }
      }
      return impulse;
  }

  public start() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.currentStep = 0;
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

  private scheduleNote(step: number, time: number) {
    if (!this.currentPatch) return;

    const melody = this.currentPatch.melody || [];
    melody.forEach(note => {
      if (Math.floor(note.startStep) === step) {
        this.triggerVoice(note.freq, time, note.durationSteps, 'melody', note.velocity);
      }
    });

    (this.currentPatch.drums || []).forEach(hit => {
      if (Math.floor(hit.startStep) === step) this.triggerDrum(hit, time);
    });

    const bassline = this.currentPatch.bassline || [];
    bassline.forEach(note => {
      if (Math.floor(note.startStep) === step) {
        this.triggerVoice(note.freq, time, note.durationSteps, 'bass', note.velocity);
      }
    });
  }

  private triggerVoice(rawFreq: number, time: number, durationSteps: number, type: 'melody' | 'bass', velocity = 1) {
    if (!this.currentPatch) return;
    
    const freq = Number(rawFreq);
    if (!Number.isFinite(freq)) return;

    // --- Audio Node Graph ---
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const env = this.ctx.createGain();
    const panner = this.ctx.createStereoPanner();

    // Configuration
    const oscType = (this.currentPatch.oscillator.type || 'sine').toLowerCase() as OscillatorType;
    const detune = Number(this.currentPatch.oscillator.detune) || 0;
    const fmAmount = Number(this.currentPatch.oscillator.fmAmount) || 0;
    
    // OSC 1 (Carrier)
    osc.type = oscType;
    osc.frequency.value = freq;
    
    // OSC 2 (Modulator or Layer)
    osc2.type = type === 'bass' ? 'sine' : oscType;
    osc2.detune.value = detune;
    
    // Filter
    filter.type = (this.currentPatch.filter.type || 'lowpass').toLowerCase() as BiquadFilterType;
    filter.frequency.value = Number(this.currentPatch.filter.frequency) || 1000;
    filter.Q.value = Number(this.currentPatch.filter.q) || 1;
    const cutoff = filter.frequency.value;
    const sweep = Number(this.currentPatch.filter.envAmount) || 0;
    
    // Envelope
    const { attack, decay, sustain, release } = this.currentPatch.envelope;
    // Tweak attack for snappier transients if requested by AI
    const effectiveAttack = Math.max(0.005, attack);

    // --- Routing Logic ---
    if (type === 'melody' && fmAmount > 0) {
        // True FM Synthesis
        // Osc2 modulates Osc1 frequency
        osc2.frequency.value = freq * (Number(this.currentPatch.oscillator.fmRatio) || 2.0);
        if (this.currentPatch.oscillator.fmWave) osc2.type = this.currentPatch.oscillator.fmWave;
        
        const modGain = this.ctx.createGain();
        // FM Depth formula: modulationIndex * modulatorFrequency
        // We use fmAmount as a rough scalar for intensity
        modGain.gain.value = fmAmount * 20; 
        
        osc2.connect(modGain);
        modGain.connect(osc.frequency);
        
        // Only carrier goes to output
        osc.connect(filter);
        
        // Start modulator with carrier
        osc2.start(time);
        osc2.stop(time + (durationSteps * 0.25 * (60/this.currentPatch.bpm)) + release + 0.1);
        
        // Cleanup modulation chain later
        setTimeout(() => { 
            modGain.disconnect(); 
            osc2.disconnect();
        }, 5000);
        
    } else {
        // Standard Subtractive / Layering
        // Bass usually wants a solid sub-oscillator
        // An octave-down sub only when it lands above ~40 Hz; lower it is a rumble, not a note.
        const ratio = type === 'bass' && freq * 0.5 >= SUB_MIN_HZ ? 0.5 : 1.0;
        osc2.frequency.value = freq * ratio;
        
        // If FM amount is present on bass, add grit via detuned layer or subtle modulation
        // For now, let's keep it as a thick layer
        osc.connect(filter);
        osc2.connect(filter);
        
        osc2.start(time);
        osc2.stop(time + (durationSteps * 0.25 * (60/this.currentPatch.bpm)) + release + 0.1);
        
         setTimeout(() => { 
            osc2.disconnect();
        }, 5000);
    }

    // Panning & Output
    const spread = type === 'bass' ? 0.1 : 0.6;
    panner.pan.value = (Math.random() * spread * 2) - spread;

    const secondsPerBeat = 60.0 / (Number(this.currentPatch.bpm) || 120);
    const duration = durationSteps * 0.25 * secondsPerBeat;
    
    // Gain Envelope
    const peakGain = 0.5 * Math.min(1, Math.max(0.1, Number(velocity) || 1));
    scheduleEnvelope(env.gain, time, duration, { attack: effectiveAttack, decay, sustain, release }, peakGain);

    // Filter envelope: each note's cutoff starts `envAmount` octaves away and glides back to the set cutoff.
    if (sweep !== 0) {
      const from = Math.min(20000, Math.max(20, cutoff * Math.pow(2, sweep)));
      filter.frequency.setValueAtTime(from, time);
      filter.frequency.exponentialRampToValueAtTime(cutoff, time + effectiveAttack + Math.max(0.05, decay));
    }

    const end = time + duration + release + 0.1;
    const extras: AudioNode[] = [];

    // A second oscillator under the note, blended in by `mix`.
    const layer = this.currentPatch.oscillator.layer;
    if (layer && layer.mix > 0) {
        const layerFreq = freq * Math.pow(2, Math.round(clamp(Number(layer.octave) || 0, -2, 2)));
        if (layerFreq >= SUB_MIN_HZ && layerFreq < 12000) {
            const layerOsc = this.ctx.createOscillator();
            const layerGain = this.ctx.createGain();
            layerOsc.type = layer.type;
            layerOsc.frequency.value = layerFreq;
            layerOsc.detune.value = Number(layer.detune) || 0;
            layerGain.gain.value = clamp(Number(layer.mix), 0, 1) * 0.8;
            layerOsc.connect(layerGain);
            layerGain.connect(filter);
            layerOsc.start(time);
            layerOsc.stop(end);
            extras.push(layerOsc, layerGain);
        }
    }

    // A slow wobble that restarts with each note: on the cutoff, on the pitch, or on the level.
    let tail: AudioNode = env;
    const lfo = this.currentPatch.lfo;
    if (lfo && lfo.depth > 0) {
        const lfoOsc = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        const depth = clamp(Number(lfo.depth), 0, 1);
        lfoOsc.frequency.value = clamp(Number(lfo.rate) || 1, 0.05, 20);
        if (lfo.target === 'filter') {
            lfoGain.gain.value = depth * 1200; // cents: up to an octave either way
            lfoGain.connect(filter.detune);
        } else if (lfo.target === 'pitch') {
            lfoGain.gain.value = depth * 100; // cents: up to a semitone either way
            lfoGain.connect(osc.detune);
        } else {
            const tremolo = this.ctx.createGain();
            tremolo.gain.value = 1 - depth / 2;
            lfoGain.gain.value = depth / 2;
            lfoGain.connect(tremolo.gain);
            env.connect(tremolo);
            tail = tremolo;
            extras.push(tremolo);
        }
        lfoOsc.connect(lfoGain);
        lfoOsc.start(time);
        lfoOsc.stop(end);
        extras.push(lfoOsc, lfoGain);
    }

    filter.connect(env);
    tail.connect(panner);
    panner.connect(this.voiceOutput);

    osc.start(time);
    osc.stop(end);
    
    setTimeout(() => {
        osc.disconnect();
        filter.disconnect();
        env.disconnect();
        panner.disconnect();
        extras.forEach(node => node.disconnect());
    }, (duration + release + 2) * 1000);
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
