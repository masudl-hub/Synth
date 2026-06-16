
import { useEffect, useRef } from 'react';
import { AudioFeatures } from '../types';

export const useDynamicFavicon = (audioDataRef: React.MutableRefObject<AudioFeatures>) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const linkRef = useRef<HTMLLinkElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    // Setup Canvas
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    canvasRef.current = canvas;

    // Find or Create Link
    let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    linkRef.current = link;

    const updateFavicon = (timestamp: number) => {
      // Throttle to 10fps (100ms)
      if (timestamp - lastUpdateRef.current < 100) {
        rafRef.current = requestAnimationFrame(updateFavicon);
        return;
      }
      lastUpdateRef.current = timestamp;

      const ctx = canvas.getContext('2d');
      if (!ctx || !audioDataRef.current) return;

      const { waveform } = audioDataRef.current;
      
      // Clear (Black)
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, 32, 32);

      // Draw Waveform (White)
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath();

      const sliceWidth = 32 / waveform.length;
      let x = 0;

      for(let i = 0; i < waveform.length; i++) {
        const v = waveform[i] / 128.0; 
        const y = (v * 32) / 2;

        if(i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);

        x += sliceWidth;
      }
      
      ctx.stroke();

      // Set Href
      if (linkRef.current) {
        linkRef.current.href = canvas.toDataURL('image/png');
      }
      
      rafRef.current = requestAnimationFrame(updateFavicon);
    };

    rafRef.current = requestAnimationFrame(updateFavicon);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [audioDataRef]);
};
