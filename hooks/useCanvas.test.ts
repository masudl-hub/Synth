import { act, renderHook } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { silentFeatures } from '../audio/analysis.ts';
import type { AudioFeatures, DrawFunction, SimulationContext } from '../types.ts';
import { useCanvas } from './useCanvas.ts';

let frames: FrameRequestCallback[] = [];
const cancelled: number[] = [];

/** Runs the newest scheduled frame at the given timestamp. */
const step = (timestamp: number) => {
  const next = frames.at(-1);
  frames = [];
  next?.(timestamp);
};

const fakeContext = () => {
  const calls: string[] = [];
  const record = (name: string) => () => {
    calls.push(name);
  };
  const ctx = { resetTransform: record('resetTransform'), scale: record('scale'), clearRect: record('clearRect') };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
};

const makeCanvas = (ctx: CanvasRenderingContext2D | null) => {
  const canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'clientWidth', { value: 200 });
  Object.defineProperty(canvas, 'clientHeight', { value: 100 });
  Object.defineProperty(canvas, 'offsetWidth', { value: 200 });
  Object.defineProperty(canvas, 'offsetHeight', { value: 100 });
  Object.defineProperty(canvas, 'getContext', { value: () => ctx });
  return canvas;
};

const setup = (shouldTimeAdvance = true, ctx: CanvasRenderingContext2D | null = fakeContext().ctx) => {
  const seen: SimulationContext[] = [];
  const draw: DrawFunction = (c) => {
    seen.push({ ...c, mouse: { ...c.mouse } });
  };
  const audioDataRef: React.MutableRefObject<AudioFeatures> = { current: silentFeatures() };
  const hook = renderHook(
    ({ advance, trigger }: { advance: boolean; trigger: number }) =>
      useCanvas(draw, audioDataRef, { shouldTimeAdvance: advance, resetTrigger: trigger }),
    { initialProps: { advance: shouldTimeAdvance, trigger: 0 } },
  );
  // The mount frame finds no canvas yet and stops; attaching one and hovering restarts the loop.
  step(0);
  hook.result.current.canvasRef.current = makeCanvas(ctx);
  act(() => hook.result.current.handleMouseEnter());
  return { hook, seen };
};

beforeEach(() => {
  frames = [];
  cancelled.length = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.push(cb);
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    cancelled.push(id);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useCanvas', () => {
  it('accumulates physics time from frame deltas, capped at 0.1 s', () => {
    const { seen } = setup();
    step(1000);
    step(1016);
    step(5000);
    expect(seen.map((c) => c.time)).toEqual([0, expect.closeTo(0.016), expect.closeTo(0.116)]);
    expect(seen[0]).toMatchObject({ width: 200, height: 100, isHovered: true });
  });

  it('holds physics time while paused', () => {
    const { seen } = setup(false);
    step(1000);
    step(1500);
    expect(seen.map((c) => c.time)).toEqual([0, 0]);
  });

  it('zeroes physics time when the reset trigger changes', () => {
    const { hook, seen } = setup();
    step(1000);
    step(1050);
    hook.rerender({ advance: true, trigger: 0 });
    step(1100);
    expect(seen.at(-1)?.time).toBeCloseTo(0.1);
    hook.rerender({ advance: true, trigger: 1 });
    step(1150);
    expect(seen.at(-1)?.time).toBeCloseTo(0.05);
  });

  it('sizes the backing store for the device pixel ratio', () => {
    vi.stubGlobal('devicePixelRatio', 2);
    const { hook } = setup();
    step(1000);
    expect(hook.result.current.canvasRef.current?.width).toBe(400);
    expect(hook.result.current.canvasRef.current?.height).toBe(200);
  });

  it('maps the pointer through a CSS scale and eases towards it', () => {
    const { hook, seen } = setup();
    const canvas = hook.result.current.canvasRef.current;
    Object.defineProperty(canvas, 'getBoundingClientRect', {
      value: () => ({ left: 10, top: 20, width: 100, height: 50 }),
    });
    hook.result.current.handleMouseMove({ clientX: 60, clientY: 45 } as React.MouseEvent);
    step(1000);
    // Half-size on screen, so (50, 25) on screen is (100, 50) on the canvas; the drawing gets a tenth of the way.
    expect(seen.at(-1)?.mouse).toEqual({ x: 10, y: 5 });
  });

  it('treats an unscaled zero-size rect as 1:1', () => {
    const { hook, seen } = setup();
    Object.defineProperty(hook.result.current.canvasRef.current, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 0, height: 0 }),
    });
    hook.result.current.handleMouseMove({ clientX: 30, clientY: 40 } as React.MouseEvent);
    step(1000);
    expect(seen.at(-1)?.mouse).toEqual({ x: 3, y: 4 });
  });

  it('drifts the pointer to the centre once it leaves', () => {
    const { hook, seen } = setup();
    act(() => hook.result.current.handleMouseLeave());
    for (let t = 1000; t < 3000; t += 16) {
      step(t);
    }
    expect(seen.at(-1)?.isHovered).toBe(false);
    expect(seen.at(-1)?.mouse.x).toBeCloseTo(100, 0);
    expect(seen.at(-1)?.mouse.y).toBeCloseTo(50, 0);
  });

  it('ignores mouse moves before the canvas mounts', () => {
    const audioDataRef: React.MutableRefObject<AudioFeatures> = { current: silentFeatures() };
    const { result } = renderHook(() => useCanvas(() => undefined, audioDataRef));
    expect(() => result.current.handleMouseMove({ clientX: 1, clientY: 1 } as React.MouseEvent)).not.toThrow();
  });

  it('stops without a 2D context', () => {
    const { seen } = setup(true, null);
    step(1000);
    expect(seen).toHaveLength(0);
    expect(frames).toHaveLength(0);
  });

  it('cancels the pending frame on unmount', () => {
    const { hook } = setup();
    step(1000);
    hook.unmount();
    expect(cancelled.length).toBeGreaterThan(0);
  });
});
