import React, { useEffect, useRef } from 'react';

export const SwarmLoader: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      // Handle High DPI Scaling
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
      }

      ctx.resetTransform();
      ctx.scale(dpr, dpr);
      const width = rect.width;
      const height = rect.height;

      // Clear Canvas
      ctx.clearRect(0, 0, width, height);
      
      // Update Physics Time
      timeRef.current += 0.015;
      const t = timeRef.current;

      // Swarm Configuration
      const count = 150;
      const cx = width / 2;
      const cy = height / 2;
      const baseRadius = Math.min(width, height) * 0.35;

      // "Breathing" animation
      const breathe = Math.sin(t * 2) * 0.1 + 0.9; 

      ctx.fillStyle = '#000000'; // Black Ink

      for (let i = 0; i < count; i++) {
        const phase = i * 0.1;
        
        // Lissajous Frequencies (3:2 ratio creates a knot/atom shape)
        const f1 = 2.0;
        const f2 = 3.0;

        // Calculate Base Position
        // Added secondary sine waves to x/y to create organic "writhing"
        let x = cx + (baseRadius * breathe) * Math.sin(f1 * t + phase);
        let y = cy + (baseRadius * breathe) * Math.sin(f2 * t + phase);

        // Interaction: Repel from mouse
        const dx = x - mouseRef.current.x;
        const dy = y - mouseRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const repelRadius = 150;

        if (dist < repelRadius) {
            const force = (repelRadius - dist) / repelRadius;
            const angle = Math.atan2(dy, dx);
            // Push away nicely
            x += Math.cos(angle) * force * 60;
            y += Math.sin(angle) * force * 60;
        }

        // Draw Particle
        // Dynamic sizing for depth effect (twinkle)
        const size = 1.5 + Math.sin(i + t * 5) * 0.5; 
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.5, size), 0, Math.PI * 2);
        ctx.fill();
      }

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
      className="w-full h-full block cursor-pointer"
      style={{ touchAction: 'none' }}
    />
  );
};

export default SwarmLoader;
