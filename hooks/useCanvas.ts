import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import type { AudioFeatures, DrawFunction, Point } from '../types.ts';

/** Sizes the backing store for high-DPI displays and returns the canvas's size in CSS pixels. */
const fitBackingStore = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
  // Handle high DPI displays
  const dpr = globalThis.devicePixelRatio || 1;
  // Layout size, so a CSS scale on an ancestor doesn't resize the backing store every frame.
  const rect = { width: canvas.clientWidth, height: canvas.clientHeight };

  if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
  }

  ctx.resetTransform();
  ctx.scale(dpr, dpr);

  return rect;
};

/** The drawn pointer trails the real one; with no hover, the real one drifts to `home`. */
const easePointer = (mouse: Point, smooth: Point, home: Point | null) => {
  // Smooth mouse interpolation
  const lerpFactor = 0.1;
  smooth.x += (mouse.x - smooth.x) * lerpFactor;
  smooth.y += (mouse.y - smooth.y) * lerpFactor;

  if (home) {
    mouse.x += (home.x - mouse.x) * 0.05;
    mouse.y += (home.y - mouse.y) * 0.05;
  }
};

export const useCanvas = (
  draw: DrawFunction,
  audioDataRef: React.RefObject<AudioFeatures>,
  shouldTimeAdvance = true,
  resetTrigger?: unknown,
) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Mutable state
  const mouseRef = useRef<Point>({ x: 0, y: 0 });
  const smoothMouseRef = useRef<Point>({ x: 0, y: 0 });

  // Time management
  const physicsTimeRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);

  // Reset physics time when trigger changes (e.g., new patch loaded)
  const resetTriggerRef = useRef(resetTrigger);
  useEffect(() => {
    if (!Object.is(resetTriggerRef.current, resetTrigger)) {
      resetTriggerRef.current = resetTrigger;
      physicsTimeRef.current = 0;
    }
  }, [resetTrigger]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current) {
      return;
    }
    const rect = canvasRef.current.getBoundingClientRect();
    // Side tiles are drawn scaled down by CSS; map the pointer back to the canvas's own pixels.
    const sx = rect.width ? canvasRef.current.offsetWidth / rect.width : 1;
    const sy = rect.height ? canvasRef.current.offsetHeight / rect.height : 1;
    mouseRef.current = {
      x: (e.clientX - rect.left) * sx,
      y: (e.clientY - rect.top) * sy,
    };
  };

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  // The loop is rebuilt when playback or hover state changes, so each frame reads them without refs.
  useEffect(() => {
    const animate = (timestamp: number) => {
      if (!canvasRef.current) {
        return;
      }

      // Calculate Delta Time
      if (lastFrameTimeRef.current === 0) {
        lastFrameTimeRef.current = timestamp;
      }
      const dt = (timestamp - lastFrameTimeRef.current) * 0.001; // seconds
      lastFrameTimeRef.current = timestamp;

      // Only advance physics time if allowed (Playing or Mic mode)
      // We cap dt at 0.1s to prevent huge jumps if tab was inactive
      if (shouldTimeAdvance) {
        physicsTimeRef.current += Math.min(dt, 0.1);
      }

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return;
      }

      const { width, height } = fitBackingStore(canvas, ctx);
      easePointer(mouseRef.current, smoothMouseRef.current, isHovered ? null : { x: width / 2, y: height / 2 });

      ctx.clearRect(0, 0, width, height);

      draw({
        ctx,
        width,
        height,
        time: physicsTimeRef.current, // Use our accumulated physics time
        mouse: smoothMouseRef.current,
        isHovered,
        audio: audioDataRef.current,
      });

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [draw, isHovered, shouldTimeAdvance, audioDataRef]);

  return {
    canvasRef,
    handleMouseMove,
    handleMouseEnter,
    handleMouseLeave,
  };
};
