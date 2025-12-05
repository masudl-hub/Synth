
import { AudioFeatures, SynthPatch } from '../types';

export class SynthEngine {
  private ctx: AudioContext;
  private analyser: AnalyserNode;
  private masterGain: GainNode;
  private voiceOutput: GainNode;
  
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
  private rafId: number | undefined;
  private prevFFT: Uint8Array;
  public audioData: AudioFeatures;

  constructor() {
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.7; 
    
    // Graph: Voices -> VoiceOutput -> MasterFilter -> (Sends + Dry) -> MasterGain -> Analyser -> Dest
    
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.masterVolumeLevel;
    
    this.voiceOutput = this.ctx.createGain(); 
    
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
    
    // Connect Chain
    this.voiceOutput.connect(this.masterFilter);
    
    // Split from Filter
    this.masterFilter.connect(this.masterGain); // Dry signal
    this.masterFilter.connect(this.delayNode);  // Send to delay
    this.masterFilter.connect(this.convolver);  // Send to reverb
    
    // Connect Master to Output
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    this.prevFFT = new Uint8Array(this.analyser.frequencyBinCount);
    this.audioData = {
      volume: 0,
      bass: 0,
      mid: 0,
      treble: 0,
      fft: new Uint8Array(this.analyser.frequencyBinCount),
      waveform: new Uint8Array(this.analyser.frequencyBinCount),
      centroid: 0,
      flux: 0
    };
    
    this.loopAnalysis();
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
        const impulse = this.generateImpulse(2.0, patch.reverb.decay);
        this.convolver.buffer = impulse;
    } else {
        this.reverbWet.gain.setTargetAtTime(0, now, 0.1);
    }
  }

  private generateImpulse(duration: number, decay: number) {
      const sampleRate = this.ctx.sampleRate;
      const length = sampleRate * duration;
      const impulse = this.ctx.createBuffer(2, length, sampleRate);
      const left = impulse.getChannelData(0);
      const right = impulse.getChannelData(1);
      
      for (let i = 0; i < length; i++) {
          const n = (Math.random() * 2 - 1);
          const e = Math.pow(1 - i / length, decay);
          left[i] = n * e;
          right[i] = n * e;
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
        this.triggerVoice(note.freq, time, note.durationSteps, 'melody');
      }
    });

    const bassline = this.currentPatch.bassline || [];
    bassline.forEach(note => {
      if (Math.floor(note.startStep) === step) {
        this.triggerVoice(note.freq, time, note.durationSteps, 'bass');
      }
    });
  }

  private triggerVoice(rawFreq: number, time: number, durationSteps: number, type: 'melody' | 'bass') {
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
    
    // Envelope
    const { attack, decay, sustain, release } = this.currentPatch.envelope;
    // Tweak attack for snappier transients if requested by AI
    const effectiveAttack = Math.max(0.005, attack);

    // --- Routing Logic ---
    if (type === 'melody' && fmAmount > 0) {
        // True FM Synthesis
        // Osc2 modulates Osc1 frequency
        osc2.frequency.value = freq * 2.0; // Harmonic ratio (can be varied)
        
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
        const ratio = type === 'bass' ? 0.5 : 1.0; 
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
    const peakGain = 0.5; 
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(peakGain, time + effectiveAttack);
    env.gain.exponentialRampToValueAtTime(Math.max(0.001, sustain * peakGain), time + effectiveAttack + decay);
    env.gain.setValueAtTime(Math.max(0.001, sustain * peakGain), time + duration);
    env.gain.exponentialRampToValueAtTime(0.001, time + duration + release);

    filter.connect(env);
    env.connect(panner);
    panner.connect(this.voiceOutput);

    osc.start(time);
    osc.stop(time + duration + release + 0.1);
    
    setTimeout(() => {
        osc.disconnect();
        filter.disconnect();
        env.disconnect();
        panner.disconnect();
    }, (duration + release + 2) * 1000);
  }

  private loopAnalysis = () => {
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const waveformArray = new Uint8Array(bufferLength);

    this.analyser.getByteFrequencyData(dataArray);
    this.analyser.getByteTimeDomainData(waveformArray);

    let bassSum = 0, midSum = 0, trebleSum = 0;
    let totalMag = 0, weightedSum = 0;
    let fluxSum = 0;

    for (let i = 0; i < bufferLength; i++) {
        const val = dataArray[i] / 255;
        
        if (i < 5) bassSum += val;
        else if (i < 30) midSum += val;
        else trebleSum += val;
        
        totalMag += val;
        weightedSum += val * i;
        
        const prevVal = this.prevFFT[i] / 255;
        const diff = val - prevVal;
        if (diff > 0) fluxSum += diff;
    }
    
    this.prevFFT.set(dataArray);

    const bass = Math.min(1, bassSum / 5);
    const mid = Math.min(1, midSum / 25);
    const treble = Math.min(1, trebleSum / 98);
    const volume = (bass + mid + treble) / 3;
    
    let centroid = 0;
    if (totalMag > 0) {
        centroid = (weightedSum / totalMag) / (bufferLength / 2);
    }
    
    const flux = Math.min(1, fluxSum / 8);

    this.audioData = {
        volume, bass, mid, treble, 
        fft: dataArray, 
        waveform: waveformArray, 
        centroid: Math.min(1, centroid), 
        flux
    };

    this.rafId = requestAnimationFrame(this.loopAnalysis);
  }
}
