import { Text } from '@astryxdesign/core/Text';
import type React from 'react';
import { useCanvas } from '../hooks/useCanvas.ts';
import type { AudioFeatures, SimulationDef } from '../types.ts';
import { FIDELITY_LABEL } from './fidelity.ts';

export interface TileProps {
  sim: SimulationDef;
  audioDataRef: React.RefObject<AudioFeatures>;
  shouldTimeAdvance: boolean;
  resetTrigger?: unknown;
  isFeatured: boolean;
}

export const Tile: React.FC<TileProps> = ({ sim, audioDataRef, shouldTimeAdvance, resetTrigger, isFeatured }) => {
  const { canvasRef, handleMouseMove, handleMouseEnter, handleMouseLeave } = useCanvas(
    sim.draw,
    audioDataRef,
    shouldTimeAdvance,
    resetTrigger,
  );

  return (
    <div className="sim-tile">
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: isFeatured ? 'crosshair' : 'pointer' }}
      />
      {isFeatured ? (
        <div className="sim-tile__info">
          <Text type="large" weight="semibold" as="p" display="block">
            {sim.title}
          </Text>
          <Text type="supporting" as="p" display="block">
            {sim.description}
          </Text>
          <Text type="supporting" size="2xs" as="p" display="block" className="sim-tile__ref">
            {FIDELITY_LABEL[sim.fidelity]} · {sim.reference}
          </Text>
        </div>
      ) : null}
    </div>
  );
};
