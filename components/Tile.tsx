
import React from 'react';
import { useCanvas } from '../hooks/useCanvas';
import { SimulationDef, AudioFeatures } from '../types';

interface TileProps {
  sim: SimulationDef;
  audioDataRef: React.MutableRefObject<AudioFeatures>;
  shouldTimeAdvance: boolean;
  resetTrigger?: any;
}

export const Tile: React.FC<TileProps> = ({ sim, audioDataRef, shouldTimeAdvance, resetTrigger }) => {
  const { canvasRef, handleMouseMove, handleMouseEnter, handleMouseLeave } = useCanvas(sim.draw, audioDataRef, shouldTimeAdvance, resetTrigger);

  return (
    <div className="relative group w-full h-full aspect-square bg-[#09090b] border border-zinc-800 overflow-hidden">
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="w-full h-full block cursor-crosshair opacity-80 group-hover:opacity-100 transition-opacity duration-500"
      />
      
      {/* Info Overlay (Replaces ID, Top Left) */}
      <div className="absolute top-4 left-4 z-20 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
         <div className="text-left">
             <p className="font-display text-xl font-bold text-white tracking-tight drop-shadow-md">{sim.title}</p>
             <p className="text-[10px] text-zinc-300 uppercase tracking-widest mt-0.5 drop-shadow-md">{sim.description}</p>
         </div>
      </div>
    </div>
  );
};
