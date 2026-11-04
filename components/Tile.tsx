import React from 'react';
import { Text } from '@astryxdesign/core/Text';
import { useCanvas } from '../hooks/useCanvas';
import { SimulationDef, AudioFeatures } from '../types';

interface TileProps {
  sim: SimulationDef;
  audioDataRef: React.MutableRefObject<AudioFeatures>;
  shouldTimeAdvance: boolean;
  resetTrigger?: unknown;
  isFeatured: boolean;
}

export const Tile: React.FC<TileProps> = ({ sim, audioDataRef, shouldTimeAdvance, resetTrigger, isFeatured }) => {
  const { canvasRef, handleMouseMove, handleMouseEnter, handleMouseLeave } = useCanvas(sim.draw, audioDataRef, shouldTimeAdvance, resetTrigger);

  return (
    <div className="sim-tile">
      <canvas
        ref={canvasRef}
        onMouseMove={isFeatured ? handleMouseMove : undefined}
        onMouseEnter={isFeatured ? handleMouseEnter : undefined}
        onMouseLeave={isFeatured ? handleMouseLeave : undefined}
        style={{ cursor: isFeatured ? 'crosshair' : 'pointer' }}
      />
      {isFeatured && (
        <div className="sim-tile__info">
          <Text type="large" weight="semibold" as="p" display="block">{sim.title}</Text>
          <Text type="supporting" as="p" display="block">{sim.description}</Text>
        </div>
      )}
    </div>
  );
};
