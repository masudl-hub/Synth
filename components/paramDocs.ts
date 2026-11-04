export const PARAM_DOCS = [
    { 
        section: "Global Settings", 
        items: [
            { key: "bpm", desc: "Tempo (Beats Per Minute). 60 is slow/chill, 120 is standard, 140+ is energetic." },
            { key: "totalSteps", desc: "Total length of the loop in 16th notes. Standard is 32 (2 bars). Use 64 or 128 for longer, evolving chord progressions." }
        ]
    },
    { 
        section: "Tone (Oscillator)", 
        items: [
            { key: "type", desc: "The character of the sound. Options: 'sine' (smooth/pure), 'triangle' (soft/hollow), 'square' (retro/gameboy), 'sawtooth' (sharp/buzzy)." },
            { key: "fmAmount", desc: "0 to 100. Frequency Modulation depth. 0 is clean. High values (50+) add metallic grit, bell-like tones, or noise." },
            { key: "fmRatio", desc: "0.25 to 8. Modulator pitch as a multiple of the note. Whole numbers (1, 2, 3) are harmonic; 1.4 or 3.5 are bell-like and metallic; under 1 is hollow. Default 2." },
            { key: "detune", desc: "-50 to 50. Fine pitch offset in cents. Small amounts (5-10) make the sound thicker and warmer (analog feel)." }
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
            { key: "envAmount", desc: "-4 to 4 octaves. Each note's cutoff starts this far from 'frequency' and glides back over the attack and decay. Positive plucks or 'wows', negative opens up from dark, 0 is steady." },
            { key: "type", desc: "'lowpass' (cuts highs), 'highpass' (cuts lows), 'bandpass' (isolates middle)." }
        ]
    },
    { 
        section: "Space (Effects)", 
        items: [
            { key: "delay", desc: "Echo effect. 'time' is seconds between repeats. 'feedback' (0-0.9) is how many repeats. 'mix' (0-1) is volume." },
            { key: "reverb", desc: "Room simulation. 'decay' is room size (seconds). 'mix' (0-1) is wetness." }
        ]
    },
    { 
        section: "Composition", 
        items: [
            { key: "melody / bassline", desc: "Arrays of notes to play." },
            { key: "freq", desc: "Pitch in Hz. A4=440, C4=261.6, Low Bass=55 or 110." },
            { key: "startStep", desc: "When the note starts (0 to totalSteps-1)." },
            { key: "velocity", desc: "0.1 to 1. How hard the note is played. 1 (default) is full level; accents near 1, ghost notes near 0.3." },
            { key: "durationSteps", desc: "How long the note holds in steps." }
        ]
    }
];
