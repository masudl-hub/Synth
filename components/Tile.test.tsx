import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { silentFeatures } from '../audio/analysis.ts';
import type { SimulationDef } from '../types.ts';
import { Tile } from './Tile.tsx';

vi.mock('../hooks/useCanvas.ts', () => ({
  useCanvas: () => ({
    canvasRef: { current: null },
    handleMouseMove: vi.fn(),
    handleMouseEnter: vi.fn(),
    handleMouseLeave: vi.fn(),
  }),
}));

const sim: SimulationDef = {
  id: 1,
  formula: 'x',
  title: 'Chladni plate',
  description: 'Sand finds the still lines.',
  reference: 'Chladni, 1787',
  fidelity: 'computes',
  draw: vi.fn(),
};

const renderTile = (isFeatured: boolean) =>
  render(
    <Tile sim={sim} audioDataRef={{ current: silentFeatures() }} shouldTimeAdvance={true} isFeatured={isFeatured} />,
  );

describe('Tile', () => {
  afterEach(cleanup);

  it('names the featured canvas and how faithful it is', () => {
    const { container } = renderTile(true);
    expect(screen.getByText('Chladni plate')).toBeTruthy();
    expect(screen.getByText('Sand finds the still lines.')).toBeTruthy();
    expect(container.querySelector('.sim-tile__ref')?.textContent).toBe('Computes · Chladni, 1787');
    expect(container.querySelector('canvas')?.style.cursor).toBe('crosshair');
  });

  it('shows only the canvas when it is not featured', () => {
    const { container } = renderTile(false);
    expect(container.querySelector('.sim-tile__info')).toBeNull();
    expect(container.querySelector('canvas')?.style.cursor).toBe('pointer');
  });

  it('writes the formula under every canvas', () => {
    for (const isFeatured of [true, false]) {
      const { container } = renderTile(isFeatured);
      expect(container.querySelector('.sim-tile__equation')?.textContent).toBe('x');
      cleanup();
    }
  });
});
