import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export const ArrayLoader: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const particlesRef = useRef<Particle[]>([]);
  const initRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      // Handle Resize logic inside the loop to catch window changes
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        initRef.current = false;
      }

      ctx.resetTransform();
      ctx.scale(dpr, dpr);
      const width = rect.width;
      const height = rect.height;

      // Initialize Particles
      if (!initRef.current) {
          particlesRef.current = [];
          const count = 800; // Particle Density
          for(let i=0; i<count; i++) {
              particlesRef.current.push({
                  x: Math.random() * width,
                  y: Math.random() * height,
                  vx: 0,
                  vy: 0
              });
          }
          initRef.current = true;
      }

      ctx.clearRect(0, 0, width, height);
      time += 0.01;
      
      // Math: Chladni / Flow Field 
      // Slowly rotate the "mode" parameters (n, m) so the grid shifts shape
      const n = 3 + Math.sin(time * 0.5);
      const m = 4 + Math.cos(time * 0.3);

      // Calculates the vibration/height at a specific point
      const getVibration = (x: number, y: number) => {
          const nx = (x / width) * 2 - 1;
          const ny = (y / height) * 2 - 1;
          return Math.cos(n * Math.PI * nx) * Math.cos(m * Math.PI * ny) - 
                 Math.cos(m * Math.PI * nx) * Math.cos(n * Math.PI * ny);
      };

      ctx.fillStyle = '#000000'; // Black Ink

      particlesRef.current.forEach(p => {
          // Calculate Gradient/Slope to determine flow direction
          const step = 2;
          const vLeft = getVibration(p.x - step, p.y);
          const vRight = getVibration(p.x + step, p.y);
          const vUp = getVibration(p.x, p.y - step);
          const vDown = getVibration(p.x, p.y + step);

          const forceX = (vLeft - vRight);
          const forceY = (vUp - vDown);

          // Apply forces
          p.vx += forceX * 0.5;
          p.vy += forceY * 0.5;

          // Interaction: Scatter when mouse is near
          const dx = p.x - mouseRef.current.x;
          const dy = p.y - mouseRef.current.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          
          if (dist < 100) {
              const push = (100 - dist) / 100;
              const angle = Math.atan2(dy, dx);
              p.vx += Math.cos(angle) * push * 5;
              p.vy += Math.sin(angle) * push * 5;
          }

          // Physics update
          p.x += p.vx;
          p.y += p.vy;
          
          // Friction
          p.vx *= 0.9;
          p.vy *= 0.9;

          // Wrap around screen edges
          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;

          // Draw
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2);
          ctx.fill();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    mouseRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleMouseLeave = () => {
    mouseRef.current = { x: -1000, y: -1000 };
  };

  return (
    <canvas
      ref={canvasRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="w-full h-full block cursor-crosshair"
      style={{ touchAction: 'none' }}
    />
  );
};

export default ArrayLoader;
