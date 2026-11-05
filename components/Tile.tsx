import { Text } from '@astryxdesign/core/Text';
import type React from 'react';
import { useRef } from 'react';
import { useCanvas } from '../hooks/useCanvas.ts';
import { readOverlayValues } from '../simulations/logic.ts';
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
  const valuesRef = useRef<HTMLElement>(null);
  // The values change every frame, so they're written straight to the DOM rather than through a render.
  const showValues = (canvas: HTMLCanvasElement) => {
    const values = readOverlayValues(canvas) ?? '';
    if (valuesRef.current && valuesRef.current.textContent !== values) {
      valuesRef.current.textContent = values;
    }
  };
  const { canvasRef, handleMouseMove, handleMouseEnter, handleMouseLeave } = useCanvas(sim.draw, audioDataRef, {
    shouldTimeAdvance,
    resetTrigger,
    onFrame: showValues,
  });

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
        <div className="sim-tile__info scrim scrim--top">
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
      <div className="sim-tile__equation scrim scrim--bottom">
        <Text type="supporting" size="2xs">
          {sim.formula}
        </Text>
        <Text type="supporting" size="2xs" color="primary" hasTabularNumbers={true} ref={valuesRef}>
          {null}
        </Text>
      </div>
    </div>
  );
};
