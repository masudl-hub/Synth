import { describe, expect, it } from 'vitest';
import { dist, lerp, map, project, rotateX, rotateY } from './math.ts';

describe('math', () => {
  it('interpolates, measures and remaps', () => {
    expect(lerp(2, 10, 0.25)).toBe(4);
    expect(dist(0, 0, 3, 4)).toBe(5);
    expect(map(5, [0, 10], [100, 200])).toBe(150);
    expect(map(-1, [0, 1], [1, 0.2])).toBeCloseTo(1.8);
  });

  it('projects a point with perspective about the centre', () => {
    expect(project(0, 0, 0, { width: 200, height: 100 })).toEqual({ x: 100, y: 50, scale: 1 });
    const far = project(10, 10, 300, { width: 200, height: 100 });
    expect(far.scale).toBe(0.5);
    expect(far).toEqual({ x: 105, y: 55, scale: 0.5 });
    expect(project(10, 0, 400, { width: 0, height: 0, fov: 400 }).x).toBe(5);
  });

  it('rotates a quarter turn about each axis', () => {
    const p = rotateY({ x: 1, y: 2, z: 0 }, Math.PI / 2);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBe(2);
    expect(p.z).toBeCloseTo(1);
    const q = rotateX({ x: 1, y: 1, z: 0 }, Math.PI / 2);
    expect(q.x).toBe(1);
    expect(q.y).toBeCloseTo(0);
    expect(q.z).toBeCloseTo(1);
  });
});
