import type { SimulationDef } from '../types.ts';

/** How faithfully each canvas follows the physics, as the tiles and the article word it. */
export const FIDELITY_LABEL: Record<SimulationDef['fidelity'], string> = {
  computes: 'Computes',
  idealised: 'Idealised',
  inspired: 'Inspired by',
  artistic: 'Artistic',
};
