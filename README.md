# Audio Physics

```text
╔══════════════════════════════════════════════════════════════════════════════════════════════════════════╗
║ ╔══════════════════════════════════════════════════════════════════════════════════════════════════════╗ ║
║ ║  AUDIO PHYSICS // PATCH LAB PCB V4.1                                                                 ║ ║
║ ╠══════════════════════════════════════════════════════════════════════════════════════════════════════╣ ║
║ ║                                                                                                      ║ ║
║ ║   [A]             [U]             [D]             [I]             [O]                                ║ ║
║ ║  ▄███▄           █   █           █████            ███            █████                               ║ ║
║ ║ ╔╝ █ ╚╗         ╔╩═══╩╗         ╔╝   ╚╗         ═══█═══         ╔╝   ╚╗                              ║ ║
║ ║ ║ ▄█▄ ║         ║  █  ║         ║ ███ ║          ║█║          ║ ███ ║                              ║ ║
║ ║ ╠═███═╣         ║  █  ║         ║  █  ║          ║█║          ║ █ █ ║                              ║ ║
║ ║ ║ █ █ ║         ╚╗ █ ╔╝         ╚╗   ╔╝         ═══█═══         ╚╗   ╔╝                              ║ ║
║ ║ ╚═╩═╩═╝          ╚███╝           █████            ███            █████                               ║ ║
║ ║                                                                                                      ║ ║
║ ║   [P]      [H]      [Y]      [S]      [I]      [C]      [S]                                          ║ ║
║ ║  █████    █   █    █   █    █████     ███     █████    █████                                         ║ ║
║ ║ ╔╝   ╚╗  ╔╝   ╚╗  ╔╝   ╚╗  ╔╝══════   ═══█═══  ╔╝══════  ╔╝══════                                      ║ ║
║ ║ ║ ███ ║  ║ ███ ║  ╚╗▄█▄╔╝  ╚█████▄     ║█║    ║         ╚█████▄                                      ║ ║
║ ║ ╠═███═╝  ╠═███═╣   ║ █ ║    ═════╚╗    ║█║    ║          ═════╚╗                                     ║ ║
║ ║ ║  █     ║ █ █ ║   ╚╗█╔╝   ╔══════╝   ═══█═══  ╚╗▄▄▄▄▄   ╔══════╝                                      ║ ║
║ ║ ╚══╩═══  ╚═╩═╩═╝    ╚█╝    ╚█████▀     ███      █████▀   ╚█████▀                                      ║ ║
║ ║                                                                                                      ║ ║
║ ╠══════════════════════════════════════════════════════════════════════════════════════════════════════╣ ║
║ ║  ANALOG CONTROLS:                                                                                    ║ ║
║ ║  [MASTER VOL: 84%]  [RESONANCE: 6.2]  [FM DEPTH: 72]             PATENTS PENDING // CYMATIC CORE     ║ ║
║ ║  [■■■■■■■■■■■■■□□]  [■■■■■■■■■□□□□□□]  [■■■■■■■■■■■□□□□]          (●) TRIG   (●) SENS   (●) FLUX     ║ ║
║ ╚══════════════════════════════════════════════════════════════════════════════════════════════════════╝ ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════════════╝
```

[![Runtime](https://img.shields.io/badge/Runtime-Cloudflare%20Pages-orange?style=flat-square&logo=cloudflare)](#)
[![Framework](https://img.shields.io/badge/Framework-React%2019-cyan?style=flat-square&logo=react)](#)
[![Builder](https://img.shields.io/badge/Builder-Vite-9c60ff?style=flat-square&logo=vite)](#)
[![AI-Core](https://img.shields.io/badge/AI%20Core-Theorem%20%C2%B7%20Gemini%203.5%20Flash--Lite-red?style=flat-square&logo=google-gemini)](#)
[![Styles](https://img.shields.io/badge/Styles-Tailwind%20CSS%20v4-38bdf8?style=flat-square&logo=tailwind-css)](#)

---

## ✦ Conceptual Overview

**Audio Physics** is an interactive, full-stack, AI-collaborative audio laboratory and visual sandbox. It brings together tactile physics simulations and real-time generative synthesizer patch programming powered by the **Gemini 3.5 API**. 

The engine converts visual structures, physical boundaries, and raw text descriptions into rich multi-part musical loops. Simultaneously, the sound's frequency and time domains drive **9 responsive, mathematical shape simulations** which react dynamically to physical mouse coordinates and spectral onset signals.

---

## ⚡ Key Architectural Features

### 1. Tactile Analog Control Grid & Sequence
* **Dual Sequence Tracks**: Separate dynamic arrays for melody and bassline.
* **Granular ADSR & DSP Elements**: Full control of physical synthesizer envelopes, oscillator types (Sine, Square, Sawtooth, Triangle), FM amount/detuning, state-variable filters (Lowpass, Highpass, Bandpass), feedback delay, and convolution-style reverb.
* **Option 5 Toggle**: A physical, tactile weighted keyswitch play toggle equipped with micro-LED state signals and structural click damping.

### 2. Physical & Spectral Cymatic Matrices
* **9 Mathematical Canvas Modes**: Ranging from orbital motion fields, complex attractor models, and particle flows to dynamic multi-point wireframes.
* **Real-time Spectral Extraction**: Extracts live **FFT**, **Waveform**, **Spectral Centroid**, and **Spectral Flux** metrics to control canvas inertia and shape dispersion.

### 3. Theorem-Served Gemini Core
* **Contextual Refinement Network**: Modifies active patch parameters iteratively without losing the core rhythm.
* **Multimodal Visual Sound Synthesis**: Converts uploaded context images directly into sound, analyzing mood, textures, and lines.
* **Error Containment Layout**: Highlights and parses standard workspace error triggers (API keys, quotas, parsing, safety flags) into readable steps with dismissal gates.

---

## 🕹️ System Architecture

```text
 ┌───────────────────────┐         ┌────────────────────────┐
 │   React Front-End     │         │  Cloudflare Pages Fn   │
 │ ───────────────────── │         │ ────────────────────── │
 │ • Web Audio Context   │         │ • Theorem handler      │
 │ • Canvas Renderers    │ ──────> │ • Gemini 3.5 Flash-Lite│
 │ • File System Uploads │ <────── │ • Structured Mapping   │
 └───────────────────────┘         └────────────────────────┘
```

---

## ⚙️ Prerequisites & Setup

### 1. Expose the Secret Keys
Audio Physics runs Gemini through a Theorem profile served from a Cloudflare Pages Function. For local dev, put the key in `.dev.vars` (gitignored):
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 2. Install the Stack Dependencies
```bash
npm install
```

### 3. Run & deploy
```bash
# Local: wrangler serves the function and proxies Vite
npm run dev

# Deploy to Cloudflare Pages (set the GEMINI_API_KEY secret on the project first)
npm run deploy
```

---

## 🎛️ Tech Specifications

* **Audio Physics Engine**: Standardized on Web Audio API Nodes natively mapped to Canvas requestAnimationFrame grids.
* **Server**: A Theorem profile (`theorem/profile.ts`) served by `@theoremjs/web` from a Cloudflare Pages Function (`functions/api/theorem/[[path]].ts`).
* **Physical UI**: Engineered with custom Tailwind CSS properties and motion curves representing raw steel dials and analog-grade laboratory equipment.
