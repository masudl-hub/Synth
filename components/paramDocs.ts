export const PARAM_DOCS = [
    { 
        section: "Global Settings", 
        items: [
            { key: "bpm", desc: "Tempo (Beats Per Minute). 60 is slow/chill, 120 is standard, 140+ is energetic." },
            { key: "totalSteps", desc: "Total length of the loop in 16th notes. Standard is 32 (2 bars). Use 64, 128, 256 or 512 for longer, evolving pieces." },
            { key: "swing", desc: "0 to 0.5. How late each off-beat sixteenth lands, as a share of a step. 0.1-0.2 is a light shuffle, 0.33 is triplet swing. Omit for straight time." },
            { key: "drive", desc: "0 to 1. Soft clipping (tanh) on the synth voices, not the drums. 0.1-0.3 warms, 0.5+ distorts. Omit for clean." }
        ]
    },
    {
        section: "Parts (lead and bass)",
        items: [
            { key: "lead / bass", desc: "Two instruments: 'lead' plays the melody, 'bass' the bassline. Each has its own oscillator, filter, envelope and lfo, so every key below sits inside one of them. The Wave and Filter controls act on the lead, or on the bass when there is no melody." },
            { key: "sub", desc: "0 to 1. A sine an octave below each note, for weight (left out where it would fall under 40 Hz). Omit for none." },
            { key: "level", desc: "0 to 1. The part's level in the mix. Default 1." },
            { key: "glide", desc: "Seconds a 'slide' note takes to bend to its pitch. Default 0.06; 0.03-0.1 suits acid lines, more gives swoops." }
        ]
    },
    { 
        section: "Tone (Oscillator)", 
        items: [
            { key: "type", desc: "The character of the sound. Options: 'sine' (smooth/pure), 'triangle' (soft/hollow), 'square' (retro/gameboy), 'sawtooth' (sharp/buzzy), 'pulse' (thin, nasal), 'organ' (full, reedy), 'bell' (glassy, ringing)." },
            { key: "fmAmount", desc: "0 to 100. Frequency Modulation depth, for melody and bass alike; the timbre stays the same up and down the range. 0 is clean. High values (50+) add metallic grit, bell-like tones, or noise." },
            { key: "fmRatio", desc: "0.25 to 8. Modulator pitch as a multiple of the note. Whole numbers keep it harmonic: with sine waves 1 is full and bright, 2 hollow like a clarinet (odd harmonics only). Halves such as 0.5 or 3.5 stay harmonic, but on a fundamental an octave below the note, so the pitch can drop an octave. Ratios that are not simple fractions, such as 1.41 or 5.19, are inharmonic: bells and metal. Default 2." },
            { key: "fmDecay", desc: "Seconds for the FM brightness to fall to a tenth within each note, as a struck sound's does. 0.2-1 gives bells and electric pianos. Omit to hold it steady." },
            { key: "fmWave", desc: "Shape of the FM modulator: 'sine' is clean and bell-like; omit it to follow the carrier's shape, which is grittier." },
            { key: "layer", desc: "A second oscillator under every note: { type, octave (-2 to 2), detune, mix (0-1) }. A sine at octave -1 adds weight, a detuned saw adds thickness." },
            { key: "detune", desc: "-100 to 100. A nonzero detune adds a second oscillator this many cents off the first. Small amounts (5-10) make them beat, so the sound is thicker and warmer (analog feel)." }
        ]
    },
    { 
        section: "Shape (Envelope)", 
        items: [
            { key: "attack", desc: "Fade-in time (seconds). 0.01 is instant (percussive/plucky). 1.0+ is a slow swell (pads/strings)." },
            { key: "decay", desc: "Time (seconds) to drop from max volume to the Sustain level." },
            { key: "sustain", desc: "0.0 to 1.0. The volume level held while the note is playing. 1.0 is full volume, 0.0 is silence." },
            { key: "release", desc: "Fade-out time (seconds) after the note ends. Long release = dreamy atmosphere." }
        ]
    },
    { 
        section: "Color (Filter)", 
        items: [
            { key: "frequency", desc: "Cutoff (Hz). Controls brightness. Low (500) is muffled/dark, High (10000) is clear/sharp." },
            { key: "q", desc: "Resonance (0-20). Adds emphasis at the cutoff point. High values make it 'whistle' or sound squelchy (like a 303 bass)." },
            { key: "slope", desc: "12 or 24 dB per octave. 24 stacks a flat stage before the resonant one, so everything past the cutoff falls away twice as fast: darker and rounder, like a 303 or a Moog. Default 12." },
            { key: "accent", desc: "0 to 1. How much velocity scales the filter sweep. At 1 a soft note barely sweeps and a hard one sweeps fully, as a 303's accent does. Default 0: every note sweeps fully." },
            { key: "envAmount", desc: "-4 to 4 octaves. Each note's cutoff starts this far from 'frequency' and glides back over the attack and decay. Positive plucks or 'wows', negative opens up from dark, 0 is steady." },
            { key: "type", desc: "'lowpass' (cuts highs), 'highpass' (cuts lows), 'bandpass' (isolates middle)." }
        ]
    },
    { 
        section: "Movement (LFO and Drums)",
        items: [
            { key: "lfo", desc: "A slow wobble on every note: { target: 'filter' | 'pitch' | 'amp', rate (0.05-20 Hz), depth (0-1) }. Filter sweeps, pitch is vibrato, amp is tremolo." },
            { key: "drums", desc: "Percussion hits: { type: 'kick' | 'snare' | 'hat' | 'clap', startStep, velocity }. They share the same sixteenth-note grid as the notes." }
        ]
    },
    {
        section: "Space (Effects)", 
        items: [
            { key: "delay", desc: "Echo effect. 'time' is seconds between repeats. 'feedback' (0-0.9) is how many repeats. 'mix' (0-1) is volume." },
            { key: "reverb", desc: "Room simulation. 'decay' is how long the tail takes to fade away, in seconds (0.3 to 6). 'mix' (0-1) is wetness. 'tone' (0-1) is how bright the room is: 0 is dark and soft, 1 is a bright plate." }
        ]
    },
    { 
        section: "Composition", 
        items: [
            { key: "melody / bassline", desc: "Arrays of notes to play. A step is a sixteenth note: 4 make a beat, 16 a bar. The melody may be empty." },
            { key: "freq", desc: "Pitch in Hz. A4=440, C4=261.6, Low Bass=55 or 110." },
            { key: "startStep", desc: "When the note starts (0 to totalSteps-1)." },
            { key: "velocity", desc: "0.1 to 1. How hard the note is played. 1 (default) is full level; accents near 1, ghost notes near 0.3." },
            { key: "durationSteps", desc: "1 to 32. How long the note holds, in sixteenth-note steps: 16 is a bar, 32 two bars." },
            { key: "slide", desc: "true bends into the note from the part's previous one over 'glide'. If that note is still held when this one starts, they join legato: no new attack, no new filter sweep, and the first note's level carries on." }
        ]
    }
];
