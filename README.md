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

[![Runtime](https://img.shields.io/badge/Runtime-Node.js%2018%2B-blue?style=flat-square&logo=node.js)](#)
[![Framework](https://img.shields.io/badge/Framework-React%2018-cyan?style=flat-square&logo=react)](#)
[![Builder](https://img.shields.io/badge/Builder-Vite%20&%20Esbuild-9c60ff?style=flat-square&logo=vite)](#)
[![AI-Core](https://img.shields.io/badge/AI%20Core-Gemini%203.5%20Flash-red?style=flat-square&logo=google-gemini)](#)
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

### 3. Server-Proxy Gemini 3.5 Core
* **Contextual Refinement Network**: Modifies active patch parameters iteratively without losing the core rhythm.
* **Multimodal Visual Sound Synthesis**: Converts uploaded context images directly into sound, analyzing mood, textures, and lines.
* **Error Containment Layout**: Highlights and parses standard workspace error triggers (API keys, quotas, parsing, safety flags) into readable steps with dismissal gates.

---

## 🕹️ System Architecture

```text
 ┌───────────────────────┐         ┌────────────────────────┐
 │   React Front-End     │         │    Express Backend     │
 │ ───────────────────── │         │ ────────────────────── │
 │ • Web Audio Context   │         │ • Secure API Endpoint  │
 │ • Canvas Renderers    │ ──────> │ • Gemini 3.5 model     │
 │ • File System Uploads │ <────── │ • Structured Mapping   │
 └───────────────────────┘         └────────────────────────┘
```

---

## ⚙️ Prerequisites & Setup

### 1. Expose the Secret Keys
Audio Physics executes Gemini queries entirely from the server interface. To activate synthesis, you must declare your API key:

Create a `.env` or fill the workspace settings panel with:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 2. Install the Stack Dependencies
```bash
npm install
```

### 3. Build & Serve locally
```bash
# Build the application bundle and backend server
npm run build

# Start the optimized Node service on port 3000
npm run start
```

---

## 🎛️ Tech Specifications

* **Audio Physics Engine**: Standardized on Web Audio API Nodes natively mapped to Canvas requestAnimationFrame grids.
* **Server Middleware**: Custom Express core compiling `.ts` entries to standalone `dist/server.cjs` modules for maximized bundle loading speeds and ESM bypass.
* **Physical UI**: Engineered with custom Tailwind CSS properties and motion curves representing raw steel dials and analog-grade laboratory equipment.
