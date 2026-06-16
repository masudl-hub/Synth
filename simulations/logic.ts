
import { SimulationDef, SimulationContext } from '../types';
import { dist, map, project, noise, Point3D, rotateY, rotateX, lerp } from '../utils/math';

const COLOR_BG = '#09090b';
const COLOR_STROKE = '#e4e4e7';

// --- HUD Helper ---
const drawEquationOverlay = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  equation: string,
  vars: Record<string, string | number>
) => {
  const barHeight = 24;
  const padding = 12;
  
  // Background
  ctx.fillStyle = 'rgba(9, 9, 11, 0.85)';
  ctx.fillRect(0, height - barHeight, width, barHeight);
  
  // Border Top
  ctx.strokeStyle = '#27272a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, height - barHeight);
  ctx.lineTo(width, height - barHeight);
  ctx.stroke();
  
  // Text Config
  ctx.font = '10px "Space Grotesk", monospace';
  ctx.textBaseline = 'middle';
  
  // Draw Equation (Left)
  ctx.textAlign = 'left';
  ctx.fillStyle = '#71717a'; // Zinc-500
  ctx.fillText(equation, padding, height - barHeight / 2);
  
  // Draw Vars (Right)
  ctx.textAlign = 'right';
  ctx.fillStyle = '#e4e4e7'; // Zinc-200 (Brighter for values)
  
  const varString = Object.entries(vars)
    .map(([k, v]) => {
        const valStr = typeof v === 'number' ? v.toFixed(2) : v;
        return `${k}=${valStr}`;
    })
    .join('   ');
    
  ctx.fillText(varString, width - padding, height - barHeight / 2);
};


/* --- 1. Ridge Lines (3D Waterfall Spectrogram) --- */
interface RidgeState {
    history: Uint8Array[];
    initialized: boolean;
}

const ridgeState: RidgeState = {
    history: [],
    initialized: false
};

const drawRidges = ({ ctx, width, height, time, mouse, audio }: SimulationContext) => {
  // CONFIG
  const rows = 45; // Depth history
  const sampleRes = 1; // Skip pixels for performance
  
  // INIT HISTORY
  if (!ridgeState.initialized) {
      for(let i=0; i<rows; i++) {
          ridgeState.history.push(new Uint8Array(audio.fft.length).fill(0));
      }
      ridgeState.initialized = true;
  }

  // UPDATE HISTORY (Waterfall scroll)
  const currentFrame = new Uint8Array(audio.fft);
  ridgeState.history.pop();
  ridgeState.history.unshift(currentFrame);

  ctx.lineJoin = 'round';

  // DRAW
  for (let r = rows - 1; r >= 0; r--) {
    const frameData = ridgeState.history[r];
    const normalizedDepth = r / rows; 
    const baseY = height * 0.9 - (normalizedDepth * height * 0.6);
    const margin = width * 0.1 + (normalizedDepth * width * 0.2);
    const rowWidth = width - (margin * 2);
    const startX = margin;

    ctx.beginPath();
    
    let frameVol = 0;
    for(let i=0; i<frameData.length; i++) frameVol += frameData[i];
    frameVol /= frameData.length;
    
    const baseWidth = (1.0 - normalizedDepth) * 2; 
    ctx.lineWidth = Math.max(0.5, baseWidth + (frameVol * 0.05));
    
    const alpha = map(normalizedDepth, 0, 1, 1, 0.2);
    ctx.strokeStyle = `rgba(228, 228, 231, ${alpha})`;

    for (let i = 0; i < frameData.length; i += sampleRes) {
        const xPercent = i / (frameData.length * 0.7);
        if (xPercent > 1) break;
        
        let x = startX + xPercent * rowWidth;
        const val = frameData[i] / 255.0;
        let amp = val * 150 * (1 - normalizedDepth); 
        amp += audio.flux * 10 * (1 - normalizedDepth);

        const d = dist(x, baseY - amp, mouse.x, mouse.y);
        const mouseRange = 150;
        let xOffset = 0;
        let yOffset = 0;
        if (d < mouseRange) {
             const force = (mouseRange - d) / mouseRange;
             const dx = x - mouse.x;
             xOffset = dx * force * 0.5;
             yOffset = force * 50; 
        }

        const y = baseY - amp + yOffset;
        if (i === 0) ctx.moveTo(x + xOffset, y);
        else ctx.lineTo(x + xOffset, y);
    }
    ctx.stroke();
  }
  
  drawEquationOverlay(ctx, width, height, "y = A(f, t)", {
      A: audio.volume,
      t: time
  });
};

/* --- 2. Holo Sphere (Voice Coil Physics) --- */
const drawHoloSphere = ({ ctx, width, height, time, mouse, audio }: SimulationContext) => {
  const baseRadius = Math.min(width, height) * 0.28;
  const cx = width / 2;
  const cy = height / 2;

  const rotSpeed = 0.002 + audio.centroid * 0.02;
  const rotX = (mouse.y - cy) * 0.002 + time * 0.2;
  const rotY = (mouse.x - cx) * 0.002 + time * (0.3 + audio.centroid);

  const lats = 24;
  const longs = 32;

  // Track the effective mode for display
  const mode = 2 + Math.floor(audio.centroid * 4);

  ctx.lineCap = 'round';
  
  const getPoint = (lat: number, long: number) => {
      const harmonic = Math.sin(lat * mode) * Math.cos(long * mode);
      
      let angleNorm = long / (Math.PI * 2);
      // Triangle mapping for seamless wrap
      if (angleNorm > 0.5) angleNorm = 1.0 - angleNorm;
      angleNorm *= 2.0; 
      
      const waveIdx = Math.floor(angleNorm * (audio.waveform.length - 1));
      const safeIdx = Math.max(0, Math.min(audio.waveform.length - 1, waveIdx));
      const waveVal = (audio.waveform[safeIdx] / 128.0 - 1.0);

      const displacement = (harmonic * 20 * audio.bass) + (waveVal * 30 * audio.mid);
      const r = baseRadius + displacement + (audio.flux * 20);

      const x = Math.cos(lat) * Math.cos(long) * r;
      const y = Math.sin(lat) * r;
      const z = Math.cos(lat) * Math.sin(long) * r;
      return { x, y, z };
  };

  const drawSegment = (p1: Point3D, p2: Point3D) => {
    let rp1 = rotateX(p1, rotX); rp1 = rotateY(rp1, rotY);
    let rp2 = rotateX(p2, rotX); rp2 = rotateY(rp2, rotY);
    const proj1 = project(rp1.x, rp1.y, rp1.z, width, height, 400);
    const proj2 = project(rp2.x, rp2.y, rp2.z, width, height, 400);
    
    const avgZ = (rp1.z + rp2.z) / 2;
    const alpha = map(avgZ, -baseRadius, baseRadius, 1, 0.1);
    const clampedAlpha = Math.max(0.1, Math.min(1, alpha));
    
    ctx.strokeStyle = `rgba(228, 228, 231, ${Math.min(1, clampedAlpha + audio.flux)})`;
    ctx.lineWidth = 1 + audio.bass * 2;
    
    ctx.beginPath();
    ctx.moveTo(proj1.x, proj1.y);
    ctx.lineTo(proj2.x, proj2.y);
    ctx.stroke();
    
    if (avgZ < 0 && audio.flux > 0.2 && Math.random() > 0.9) {
        ctx.fillStyle = `rgba(255, 255, 255, ${clampedAlpha})`;
        const dotSize = 2 + audio.treble * 4;
        ctx.beginPath();
        ctx.arc(proj1.x, proj1.y, dotSize, 0, Math.PI * 2);
        ctx.fill();
    }
  };

  for (let i = 0; i < lats; i++) {
    const lat1 = map(i, 0, lats, -Math.PI / 2, Math.PI / 2);
    const lat2 = map(i + 1, 0, lats, -Math.PI / 2, Math.PI / 2);
    for (let j = 0; j < longs; j++) {
        const long1 = map(j, 0, longs, 0, Math.PI * 2);
        const long2 = map(j + 1, 0, longs, 0, Math.PI * 2);
        const p1 = getPoint(lat1, long1);
        const p2 = getPoint(lat1, long2);
        const p3 = getPoint(lat2, long1);
        drawSegment(p1, p2);
        drawSegment(p1, p3);
    }
  }

  drawEquationOverlay(ctx, width, height, "r = R + A * Y(n, m)", {
      n: mode,
      A: audio.mid
  });
};

/* --- 3. Warp Grid (True Chladni Plate) --- */
const drawWarpedGrid = ({ ctx, width, height, time, mouse, audio }: SimulationContext) => {
  const cols = 40;
  const rows = 40;
  const stepX = width / cols;
  const stepY = height / rows;

  ctx.strokeStyle = COLOR_STROKE;
  ctx.lineWidth = 1;

  const modeParam = 2 + Math.floor(audio.centroid * 6);
  const n = modeParam;
  const m = modeParam + 1; 

  const chladni = (x: number, y: number) => {
      const nx = (x / width) * 2 - 1;
      const ny = (y / height) * 2 - 1;
      return Math.cos(n * Math.PI * nx) * Math.cos(m * Math.PI * ny) - 
             Math.cos(m * Math.PI * nx) * Math.cos(n * Math.PI * ny);
  };

  const drawLines = (isVertical: boolean) => {
    const outerLoop = isVertical ? cols : rows;
    const innerLoop = isVertical ? rows : cols;

    for (let i = 0; i <= outerLoop; i++) {
      ctx.beginPath();
      for (let j = 0; j <= innerLoop; j++) {
        let x = isVertical ? i * stepX : j * stepX;
        let y = isVertical ? j * stepY : i * stepY;
        const vibration = chladni(x, y);
        const amp = 40 * audio.volume;
        const zOff = vibration * amp;
        if (isVertical) x += zOff;
        else y += zOff;

        const d = dist(x, y, mouse.x, mouse.y);
        if (d < 120) {
            const damp = d / 120;
            if (isVertical) x = lerp(x, i * stepX, 1-damp);
            else y = lerp(y, j * stepY, 1-damp);
        }

        if (j === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  };

  drawLines(true);
  drawLines(false);

  drawEquationOverlay(ctx, width, height, "z = cos(nπx)cos(mπy) - cos(mπx)cos(nπy)", {
      n: n,
      m: m,
      Amp: audio.volume
  });
};

/* --- 4. Strata (Waveform Terrain) --- */
const drawTopo = ({ ctx, width, height, time, mouse, audio }: SimulationContext) => {
  const lines = 40;
  ctx.strokeStyle = COLOR_STROKE;
  ctx.lineWidth = 1.5;

  for (let i = 0; i < lines; i++) {
    ctx.beginPath();
    const normalizedY = i / lines;
    const basePath = height * normalizedY;
    
    for (let x = 0; x < width; x += 5) {
      let y = basePath;
      
      const waveIndex = Math.floor(map(x, 0, width, 0, audio.waveform.length));
      // Raw signal drives the wave
      const waveAmp = (audio.waveform[waveIndex] / 128.0) - 1.0; 
      const depthDecay = map(i, 0, lines, 0.2, 2.0);
      
      // Removed Perlin noise. 
      // Replaced with Treble-driven harmonic detail
      // Using sin/cos of the harmonic series to create texture
      const detailFreq = 0.2 + (audio.treble * 2.0);
      const detailAmp = audio.treble * 20;
      const detail = Math.sin(x * detailFreq + time * 5) * Math.cos(x * 0.05) * detailAmp;
      
      y += waveAmp * 80 * depthDecay * audio.volume;
      y += detail;

      const d = dist(x, y, mouse.x, mouse.y);
      const pull = Math.exp(-d * 0.01) * 60;
      y += pull;

      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.globalAlpha = map(i, 0, lines, 0.2, 1);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  drawEquationOverlay(ctx, width, height, "y = A * Wave(t) + N(x)", {
      A: audio.volume,
      t: time
  });
};

/* --- 5. Array (Cymatic Sand) --- */
interface SandParticle {
    x: number;
    y: number;
    vx: number;
    vy: number;
}
interface ArrayState {
    particles: SandParticle[];
    initialized: boolean;
}
const arrayState: ArrayState = {
    particles: [],
    initialized: false
};

const drawFluidArrays = ({ ctx, width, height, time, mouse, audio }: SimulationContext) => {
  const numParticles = 1200;
  
  if (!arrayState.initialized || arrayState.particles.length === 0) {
      arrayState.particles = [];
      for(let i=0; i<numParticles; i++) {
          arrayState.particles.push({
              x: Math.random() * width,
              y: Math.random() * height,
              vx: 0, 
              vy: 0
          });
      }
      arrayState.initialized = true;
  }

  const modeBase = 2 + Math.floor(audio.centroid * 4); 
  const n = modeBase;
  const m = modeBase + 1;

  const getVibration = (x: number, y: number) => {
      const nx = (x / width) * 2 - 1;
      const ny = (y / height) * 2 - 1;
      return Math.abs(Math.cos(n * Math.PI * nx) * Math.cos(m * Math.PI * ny) - 
                      Math.cos(m * Math.PI * nx) * Math.cos(n * Math.PI * ny));
  };

  ctx.fillStyle = COLOR_STROKE;
  
  arrayState.particles.forEach(p => {
      const step = 4;
      const vibNow = getVibration(p.x, p.y);
      const vibL = getVibration(p.x - step, p.y);
      const vibR = getVibration(p.x + step, p.y);
      const vibU = getVibration(p.x, p.y - step);
      const vibD = getVibration(p.x, p.y + step);
      
      let fx = (vibL - vibR) * 2.0; 
      let fy = (vibU - vibD) * 2.0;
      
      const energy = audio.volume;
      const active = energy > 0.05;
      
      if (active) {
          p.vx += fx * energy * 2;
          p.vy += fy * energy * 2;
          // Brownian motion derived from treble instead of pure random
          // Use waveform phase to jitter
          const jitter = (audio.waveform[Math.floor(p.x) % 128] / 128 - 1.0) * audio.treble * 2;
          p.vx += jitter;
          p.vy += jitter;
      }
      
      if (audio.flux > 0.3) {
          // Scatter based on transient strength
          const scatter = audio.flux * 10;
          p.vx += (Math.random() - 0.5) * scatter;
          p.vy += (Math.random() - 0.5) * scatter;
      }

      const d = dist(p.x, p.y, mouse.x, mouse.y);
      if (d < 80) {
          const push = (80 - d) / 80;
          const ang = Math.atan2(p.y - mouse.y, p.x - mouse.x);
          p.vx += Math.cos(ang) * push * 3;
          p.vy += Math.sin(ang) * push * 3;
      }
      
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.85;
      p.vy *= 0.85;
      
      if (p.x < 0) p.x = width;
      if (p.x > width) p.x = 0;
      if (p.y < 0) p.y = height;
      if (p.y > height) p.y = 0;
      
      ctx.beginPath();
      const size = 1 + vibNow * 1.5;
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();
  });

  drawEquationOverlay(ctx, width, height, "F = -∇(Ψ)", {
      E: audio.volume,
      n: n
  });
};

/* --- 6. Twist (Standing Waves / Melde's Experiment) --- */
const drawTwist = ({ ctx, width, height, time, mouse, audio }: SimulationContext) => {
  const strands = 50; 
  ctx.strokeStyle = COLOR_STROKE;
  ctx.lineWidth = 1;

  const baseMode = 1 + Math.floor(audio.centroid * 8);

  for (let i = 0; i < strands; i++) {
    ctx.beginPath();
    const xBase = map(i, 0, strands - 1, width * 0.1, width * 0.9);
    const strandPhase = i * 0.1;
    
    for (let y = 0; y < height; y += 5) {
        const ny = y / height;
        const mode = baseMode;
        const A = 40 * audio.volume; 
        const standing = Math.sin(mode * Math.PI * ny);
        const oscillation = Math.cos(time * 5 + strandPhase);
        let xOff = standing * oscillation * A;
        
        const waveIdx = Math.floor(ny * audio.waveform.length);
        const raw = (audio.waveform[waveIdx] / 128 - 1) * 20 * audio.treble;
        xOff += raw;
        
        let x = xBase + xOff;
        const d = dist(xBase, y, mouse.x, mouse.y);
        if (d < 100) {
            const pull = (100 - d) / 100;
            x += (mouse.x - xBase) * pull * 0.5;
        }

        if (y === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    
    const centerDist = Math.abs(i - strands/2) / (strands/2);
    ctx.globalAlpha = 1.0 - (centerDist * 0.8);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  drawEquationOverlay(ctx, width, height, "y = 2A sin(kx) cos(ωt)", {
      k: baseMode,
      A: (40 * audio.volume).toFixed(1)
  });
};

/* --- 7. Swarm (Lissajous Harmonograph) --- */
const drawParticles = ({ ctx, width, height, time, mouse, audio }: SimulationContext) => {
  const count = 200;
  ctx.fillStyle = COLOR_STROKE;
  const cx = width / 2;
  const cy = height / 2;

  const f1 = 1.0; 
  const overtoneMap = [1.0, 1.5, 2.0, 3.0, 4.0]; 
  const mapIdx = Math.min(overtoneMap.length - 1, Math.floor(audio.centroid * overtoneMap.length));
  const f2 = overtoneMap[mapIdx];
  
  for (let i = 0; i < count; i++) {
    const phase = i * 0.05; 
    const baseAmp = Math.min(width, height) * 0.35;
    const Amp = baseAmp * (0.5 + audio.volume * 0.8);
    
    let x = cx + Amp * Math.sin(f1 * (time + phase) + phase);
    let y = cy + Amp * Math.sin(f2 * (time + phase));
    
    // Removed random explosion.
    // Replaced with Waveform-driven displacement
    // Use the actual waveform value at this particle's index
    const waveIdx = Math.floor(map(i, 0, count, 0, audio.waveform.length));
    const waveVal = (audio.waveform[waveIdx] / 128.0 - 1.0); // -1 to 1
    
    // Scatter outward based on the wave amplitude at that moment
    const displacement = waveVal * audio.flux * 300;
    
    const ang = Math.atan2(y - cy, x - cx);
    x += Math.cos(ang) * displacement;
    y += Math.sin(ang) * displacement;

    const d = dist(x, y, mouse.x, mouse.y);
    if (d < 100) {
      const force = (100 - d) / 100;
      const angM = Math.atan2(y - mouse.y, x - mouse.x);
      x += Math.cos(angM) * force * 50;
      y += Math.sin(angM) * force * 50;
    }

    const size = 1.5 + audio.mid * 3;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  drawEquationOverlay(ctx, width, height, "x = sin(at), y = sin(bt)", {
      a: 1.0,
      b: f2.toFixed(1)
  });
};

/* --- 8. Hive (Phononic Lattice) --- */
const drawHex = ({ ctx, width, height, time, mouse, audio }: SimulationContext) => {
  const r = 20;
  const w = r * 2 * 0.866;
  const h = r * 1.5;
  const cols = Math.ceil(width / w) + 1;
  const rows = Math.ceil(height / h) + 1;
  const cx = width / 2;
  const cy = height / 2;

  ctx.strokeStyle = COLOR_STROKE;

  const k = 0.1; // Wave number
  const omega = 5 + audio.centroid * 10; 

  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      let x = i * w;
      let y = j * h;
      if (j % 2 === 1) x += w / 2;

      const dCenter = dist(x, y, cx, cy);
      const wave = Math.cos(k * dCenter - time * omega);
      const decay = Math.max(0, 1 - dCenter / (width * 0.6));
      const amp = audio.volume * decay * 1.5; 
      const scale = 0.5 + (wave * 0.5 * amp) + 0.3; 
      const dMouse = dist(x, y, mouse.x, mouse.y);
      const mouseInt = Math.max(0, 150 - dMouse) / 150;
      const finalScale = Math.min(1.2, scale + mouseInt * 0.5);

      ctx.lineWidth = 1 + finalScale;
      ctx.globalAlpha = 0.2 + finalScale * 0.6; 

      const hr = r * finalScale;

      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const angle = Math.PI / 3 * k;
        const hx = x + Math.cos(angle) * hr;
        const hy = y + Math.sin(angle) * hr;
        if (k === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  drawEquationOverlay(ctx, width, height, "u = A cos(kr - ωt)", {
      ω: omega.toFixed(1),
      A: audio.volume
  });
};

/* --- 9. Static -> Phase (Phase Portrait) --- */
const drawPhaseSpace = ({ ctx, width, height, time, mouse, audio }: SimulationContext) => {
  const cx = width / 2;
  const cy = height / 2;
  
  // Phase Plot: x(t) vs x(t-k)
  // This visualizes the system's "Attractor"
  const scale = Math.min(width, height) * 0.4;
  
  ctx.strokeStyle = COLOR_STROKE;
  ctx.lineJoin = 'round';
  
  // Delay amount (embedding dimension lag)
  // Higher pitch (centroid) -> smaller delay needed to see structure
  const delay = Math.max(1, Math.floor(5 - audio.centroid * 4)); 
  
  ctx.beginPath();
  
  const len = audio.waveform.length;
  // Dynamic line width based on energy
  ctx.lineWidth = 0.5 + audio.volume * 2;
  
  for(let i=0; i < len - delay; i++) {
      // Map 0-255 to -1 to 1
      const xVal = (audio.waveform[i] / 128.0) - 1.0;
      const yVal = (audio.waveform[i + delay] / 128.0) - 1.0;
      
      let px = cx + xVal * scale;
      let py = cy + yVal * scale;
      
      // Mouse interaction: Perturb the attractor
      const d = dist(px, py, mouse.x, mouse.y);
      if (d < 100) {
          const push = (100 - d) / 100;
          const ang = Math.atan2(py - mouse.y, px - mouse.x);
          px += Math.cos(ang) * push * 30;
          py += Math.sin(ang) * push * 30;
      }

      if (i===0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
  }
  
  // Close the loop visually if it's a periodic signal
  ctx.stroke();

  drawEquationOverlay(ctx, width, height, "x[n] vs x[n-k]", {
      k: delay,
      RMS: audio.volume
  });
};

/* --- 10. Fluid (Sonic Wind) --- */
interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    age: number;
}
interface FluidState {
    initialized: boolean;
    cols: number;
    rows: number;
    res: number;
    velX: Float32Array;
    velY: Float32Array;
    particles: Particle[];
    prevMouse: { x: number; y: number };
}
let fluid: FluidState = {
    initialized: false,
    cols: 0,
    rows: 0,
    res: 20, 
    velX: new Float32Array(0),
    velY: new Float32Array(0),
    particles: [],
    prevMouse: { x: 0, y: 0 }
};

const drawFluid = ({ ctx, width, height, time, mouse, audio }: SimulationContext) => {
    const cols = Math.ceil(width / fluid.res);
    const rows = Math.ceil(height / fluid.res);
    
    if (!fluid.initialized || fluid.cols !== cols || fluid.rows !== rows) {
        fluid.cols = cols;
        fluid.rows = rows;
        fluid.velX = new Float32Array(cols * rows).fill(0);
        fluid.velY = new Float32Array(cols * rows).fill(0);
        fluid.particles = [];
        for(let i=0; i<3000; i++) {
            fluid.particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: 0,
                vy: 0,
                age: Math.random() * 100
            });
        }
        fluid.initialized = true;
    }

    const mx = Math.floor(mouse.x / fluid.res);
    const my = Math.floor(mouse.y / fluid.res);
    const mvx = mouse.x - fluid.prevMouse.x;
    const mvy = mouse.y - fluid.prevMouse.y;
    
    if (mx >= 0 && mx < cols && my >= 0 && my < rows) {
        const index = mx + my * cols;
        fluid.velX[index] += mvx * 1.5;
        fluid.velY[index] += mvy * 1.5;
    }
    fluid.prevMouse = { x: mouse.x, y: mouse.y };
    
    if (audio.flux > 0.25) {
        const cx = Math.floor(cols/2);
        const cy = Math.floor(rows/2);
        const boomRadius = 8;
        for(let y = cy - boomRadius; y <= cy + boomRadius; y++) {
            for(let x = cx - boomRadius; x <= cx + boomRadius; x++) {
                 if (x>=0 && x<cols && y>=0 && y<rows) {
                     const idx = x + y*cols;
                     const dx = x - cx;
                     const dy = y - cy;
                     const ang = Math.atan2(dy, dx);
                     const force = audio.flux * 30;
                     fluid.velX[idx] += Math.cos(ang) * force;
                     fluid.velY[idx] += Math.sin(ang) * force;
                 }
            }
        }
    }

    for (let i = 0; i < fluid.velX.length; i++) {
        fluid.velX[i] *= 0.94; 
        fluid.velY[i] *= 0.94;
        const x = i % cols;
        const y = Math.floor(i / cols);
        if (x > 0 && x < cols - 1 && y > 0 && y < rows - 1) {
            const up = i - cols;
            const down = i + cols;
            const left = i - 1;
            const right = i + 1;
            const avgX = (fluid.velX[up] + fluid.velX[down] + fluid.velX[left] + fluid.velX[right]) * 0.25;
            const avgY = (fluid.velY[up] + fluid.velY[down] + fluid.velY[left] + fluid.velY[right]) * 0.25;
            fluid.velX[i] += (avgX - fluid.velX[i]) * 0.2;
            fluid.velY[i] += (avgY - fluid.velY[i]) * 0.2;
        }
        
        // Removed Perlin Noise
        // Use Audio Centroid to create turbulence patterns
        const turbScale = 0.05 + audio.centroid * 0.2;
        const turbForce = audio.treble * 5;
        // Simple procedural turbulence based on position and time
        const flow = Math.sin(x * turbScale + time) + Math.cos(y * turbScale + time);
        
        fluid.velX[i] += Math.cos(flow * Math.PI) * turbForce;
        fluid.velY[i] += Math.sin(flow * Math.PI) * turbForce;
    }

    ctx.fillStyle = COLOR_STROKE;
    
    for (let p of fluid.particles) {
        const gx = Math.floor(p.x / fluid.res);
        const gy = Math.floor(p.y / fluid.res);
        if (gx >= 0 && gx < cols && gy >= 0 && gy < rows) {
            const index = gx + gy * cols;
            p.vx += fluid.velX[index] * 0.2;
            p.vy += fluid.velY[index] * 0.2;
        }
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.95; 
        p.vy *= 0.95;
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;
        const speed = Math.sqrt(p.vx*p.vx + p.vy*p.vy);
        const waveIdx = Math.floor(map(p.x, 0, width, 0, audio.waveform.length));
        const waveVal = Math.abs(audio.waveform[waveIdx] / 128 - 1);
        const size = Math.min(3, Math.max(0.5, speed * 0.5)) + waveVal * 4;
        const alpha = Math.min(1, speed * 0.2 + 0.1 + audio.volume * 0.5);
        ctx.globalAlpha = alpha;
        ctx.fillRect(p.x, p.y, size, size);
    }
    ctx.globalAlpha = 1;

    drawEquationOverlay(ctx, width, height, "v += F_flux", {
        F: audio.flux
    });
};

/* --- 11. Vector (Polar FFT) --- */
const drawPolarSpectrum = ({ ctx, width, height, time, mouse, audio }: SimulationContext) => {
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) * 0.35;
    
    ctx.strokeStyle = COLOR_STROKE;
    ctx.lineWidth = 1.5;
    
    // Polar Transformation: (Freq Magnitude, Freq Bin) -> (r, theta)
    // r = BaseRadius + Magnitude[f]
    // theta = f * 2PI
    
    ctx.beginPath();
    const len = audio.fft.length;
    // We mirror the spectrum to close the loop smoothly
    
    for (let i = 0; i <= len * 2; i++) {
        // Wrap index around 0-len-0 (Triangle wave indexing)
        let idx = i % (len * 2);
        if (idx >= len) idx = (len * 2) - idx - 1;
        
        const angle = map(i, 0, len * 2, 0, Math.PI * 2);
        const mag = audio.fft[idx] / 255.0; // 0 to 1
        
        // Apply Flux to expand the ring
        const r = radius + (mag * 100 * audio.volume) + (audio.flux * 20);
        
        const x = cx + Math.cos(angle + time * 0.5) * r;
        const y = cy + Math.sin(angle + time * 0.5) * r;
        
        // Mouse warp
        const d = dist(x, y, mouse.x, mouse.y);
        let mx = x, my = y;
        if (d < 100) {
            const pull = (100 - d) / 100;
            mx += (mouse.x - x) * pull;
            my += (mouse.y - y) * pull;
        }

        if (i === 0) ctx.moveTo(mx, my);
        else ctx.lineTo(mx, my);
    }
    ctx.closePath();
    ctx.stroke();
    
    // Draw Center "Singularity" driven by Bass
    const core = audio.bass * 20;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx, cy, core, 0, Math.PI*2);
    ctx.fill();

    drawEquationOverlay(ctx, width, height, "r = R + |X(f)|", {
        f: "0-20kHz",
        R: radius.toFixed(0)
    });
};

/* --- 12. Lattice (Tonnetz/Harmonic Grid) --- */
const getChroma = (fft: Uint8Array): number[] => {
    // Map FFT bins to 12 pitch classes
    const chroma = new Array(12).fill(0);
    // Rough mapping: start at bin 5 (~86Hz) up to bin 60 (~1000Hz)
    // f = i * 44100 / 256
    for (let i = 2; i < 64; i++) {
        const freq = i * 44100 / 256;
        if (freq < 50) continue;
        // MIDI note number: 69 + 12 * log2(f/440)
        const midi = Math.round(69 + 12 * Math.log2(freq / 440));
        const pitchClass = midi % 12;
        if (pitchClass >= 0) {
            chroma[pitchClass] += fft[i] / 255;
        }
    }
    return chroma;
};

const drawTonnetz = ({ ctx, width, height, time, mouse, audio }: SimulationContext) => {
    // Euler's Tonnetz: Triangular grid
    // Axis 1: Perfect 5ths (7 semitones)
    // Axis 2: Major 3rds (4 semitones)
    
    const chroma = getChroma(audio.fft);
    // Normalize chroma
    const maxVal = Math.max(...chroma, 0.001);
    const normalizedChroma = chroma.map(v => v / maxVal);
    
    const size = 40;
    const cx = width / 2;
    const cy = height / 2;
    
    const gridW = 5;
    const gridH = 5;
    
    // Notes on the grid (Centered at C=0)
    // We generate a grid of notes (x,y) -> Note Index
    // Note = (x * 7 + y * 4) % 12
    
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '10px "Space Grotesk"';
    
    const drawNode = (i: number, j: number) => {
        // Hexagonal coordinates
        const x = (i + j * 0.5) * size;
        const y = j * size * 0.866;
        
        const screenX = cx + (x - (gridW * size)/2);
        const screenY = cy + (y - (gridH * size * 0.866)/2);
        
        // Calculate Pitch Class
        let noteIdx = ((i * 7) + (j * 4)) % 12;
        if (noteIdx < 0) noteIdx += 12;
        
        const intensity = normalizedChroma[noteIdx];
        
        // Draw connection lines
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        // Right
        ctx.moveTo(screenX, screenY);
        ctx.lineTo(screenX + size, screenY);
        // Down-Right
        ctx.moveTo(screenX, screenY);
        ctx.lineTo(screenX + size * 0.5, screenY + size * 0.866);
        // Up-Right
        ctx.moveTo(screenX, screenY);
        ctx.lineTo(screenX + size * 0.5, screenY - size * 0.866);
        ctx.stroke();

        // Draw Node
        const radius = 2 + intensity * 15 * audio.volume;
        
        // Mouse Interaction
        const d = dist(screenX, screenY, mouse.x, mouse.y);
        const hover = d < 40 ? (40-d)/40 : 0;
        
        ctx.fillStyle = `rgba(255, 255, 255, ${0.2 + intensity + hover})`;
        ctx.beginPath();
        ctx.arc(screenX, screenY, radius + hover * 5, 0, Math.PI * 2);
        ctx.fill();
        
        // Note Label (Optional, maybe clutter)
        /*
        if (intensity > 0.5 || hover > 0.5) {
             const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
             ctx.fillStyle = '#000';
             ctx.fillText(names[noteIdx], screenX, screenY);
        }
        */
    };
    
    for(let j = -gridH; j <= gridH; j++) {
        for(let i = -gridW; i <= gridW; i++) {
            drawNode(i, j);
        }
    }

    drawEquationOverlay(ctx, width, height, "Note = (i*7 + j*4) % 12", {
        Consonance: audio.centroid.toFixed(2),
        Root: "C" // Simplified
    });
};

/* --- 13. Attractor (Lorenz System / Chaos) --- */
interface AttractorState {
    x: number;
    y: number;
    z: number;
    points: Point3D[];
}
const attractorState: AttractorState = {
    x: 0.1, y: 0, z: 0,
    points: []
};

const drawLorenz = ({ ctx, width, height, time, mouse, audio }: SimulationContext) => {
    // Lorenz Constants
    // sigma = 10, beta = 8/3, rho = 28 (Standard Chaos)
    // We modulate rho (Rayleigh number) with Bass to push it into higher energy states
    const sigma = 10;
    const beta = 8/3;
    const rho = 28 + (audio.bass * 20); 
    
    const dt = 0.01 + (audio.treble * 0.01); // Speed driven by treble
    
    // Integration step (Euler)
    const dx = sigma * (attractorState.y - attractorState.x) * dt;
    const dy = (attractorState.x * (rho - attractorState.z) - attractorState.y) * dt;
    const dz = (attractorState.x * attractorState.y - beta * attractorState.z) * dt;
    
    attractorState.x += dx;
    attractorState.y += dy;
    attractorState.z += dz;
    
    attractorState.points.push({ x: attractorState.x, y: attractorState.y, z: attractorState.z });
    if (attractorState.points.length > 500) attractorState.points.shift();
    
    // Projection
    ctx.strokeStyle = COLOR_STROKE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    // Rotate the entire cloud
    const rX = time * 0.2;
    const rY = time * 0.3;
    
    for (let i = 0; i < attractorState.points.length; i++) {
        const p = attractorState.points[i];
        
        // Scale and Center
        // Lorenz z is usually 0-50, x/y are -20 to 20
        let centeredX = p.x * 5;
        let centeredY = (p.y) * 5;
        let centeredZ = (p.z - 25) * 5;
        
        // 3D Rotation
        let pt: Point3D = {x: centeredX, y: centeredY, z: centeredZ};
        pt = rotateY(pt, rY);
        pt = rotateX(pt, rX);
        
        // Project
        const proj = project(pt.x, pt.y, pt.z, width, height, 500);
        
        // Interaction
        let sx = proj.x;
        let sy = proj.y;
        const d = dist(sx, sy, mouse.x, mouse.y);
        if (d < 100) {
            const pull = (100-d)/100;
            sx += (mouse.x - sx) * pull * 0.2;
            sy += (mouse.y - sy) * pull * 0.2;
        }
        
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
    }
    ctx.stroke();

    drawEquationOverlay(ctx, width, height, "dx = σ(y-x)dt", {
        ρ: rho.toFixed(1),
        σ: sigma
    });
};


export const simulations: SimulationDef[] = [
  { id: 1, title: "Ridge", description: "3D Spectrogram", draw: drawRidges },
  { id: 2, title: "Holo", description: "Voice Coil", draw: drawHoloSphere },
  { id: 3, title: "Warp", description: "Chladni Plate", draw: drawWarpedGrid },
  { id: 4, title: "Strata", description: "Waveform Terrain", draw: drawTopo },
  { id: 5, title: "Array", description: "Cymatic Sand", draw: drawFluidArrays },
  { id: 6, title: "Twist", description: "Standing Wave", draw: drawTwist },
  { id: 7, title: "Swarm", description: "Harmonograph", draw: drawParticles },
  { id: 8, title: "Hive", description: "Phononic Lattice", draw: drawHex },
  { id: 9, title: "Phase", description: "Attractor", draw: drawPhaseSpace },
  { id: 10, title: "Fluid", description: "Sonic Wind", draw: drawFluid },
  { id: 11, title: "Vector", description: "Polar Spectrum", draw: drawPolarSpectrum },
  { id: 12, title: "Lattice", description: "Euler Tonnetz", draw: drawTonnetz },
  { id: 13, title: "Chaos", description: "Lorenz System", draw: drawLorenz },
];
