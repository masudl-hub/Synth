
import React, { useEffect, useRef, useState } from 'react';
import { DrawFunction, Point, AudioFeatures } from '../types';

export const useCanvas = (
  draw: DrawFunction,
  audioDataRef: React.MutableRefObject<AudioFeatures>,
  shouldTimeAdvance: boolean = true,
  resetTrigger?: any
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
  useEffect(() => {
    physicsTimeRef.current = 0;
  }, [resetTrigger]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    mouseRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const animate = (timestamp: number) => {
    if (!canvasRef.current) return;
    
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
    if (!ctx) return;

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    }
    
    ctx.resetTransform();
    ctx.scale(dpr, dpr);
    
    const width = rect.width;
    const height = rect.height;

    // Smooth mouse interpolation
    const lerpFactor = 0.1;
    smoothMouseRef.current.x += (mouseRef.current.x - smoothMouseRef.current.x) * lerpFactor;
    smoothMouseRef.current.y += (mouseRef.current.y - smoothMouseRef.current.y) * lerpFactor;
    
    if (!isHovered) {
        const cx = width / 2;
        const cy = height / 2;
        mouseRef.current.x += (cx - mouseRef.current.x) * 0.05;
        mouseRef.current.y += (cy - mouseRef.current.y) * 0.05;
    }

    ctx.clearRect(0, 0, width, height);

    draw({
      ctx,
      width,
      height,
      time: physicsTimeRef.current, // Use our accumulated physics time
      mouse: smoothMouseRef.current,
      isHovered,
      audio: audioDataRef.current
    });

    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draw, isHovered, shouldTimeAdvance]); // Re-bind if playback state changes

  return {
    canvasRef,
    handleMouseMove,
    handleMouseEnter,
    handleMouseLeave
  };
};