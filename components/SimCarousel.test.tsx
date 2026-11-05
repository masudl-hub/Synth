import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { silentFeatures } from '../audio/analysis.ts';
import { simulations } from '../simulations/logic.ts';
import { SimCarousel } from './SimCarousel.tsx';

vi.mock('./Tile.tsx', () => ({
  Tile: ({ sim, isFeatured }: { sim: { title: string }; isFeatured: boolean }) => (
    <canvas data-title={sim.title} data-featured={isFeatured} />
  ),
}));

const COUNT = simulations.length;
const titleOf = (i: number) => simulations[i]?.title ?? '';

const setup = (active = 0) => {
  const onActiveChange = vi.fn();
  const view = render(
    <SimCarousel
      active={active}
      onActiveChange={onActiveChange}
      audioDataRef={{ current: silentFeatures() }}
      shouldTimeAdvance={true}
    />,
  );
  return { onActiveChange, ...view };
};

let now = 1000;

/** A touch pointer event, which happy-dom builds without the pointer fields. */
const touch = (type: string, x: number, y: number, pointerType = 'touch') => {
  const e = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
  Object.defineProperty(e, 'pointerType', { value: pointerType });
  return e;
};

beforeEach(() => {
  vi.spyOn(performance, 'now').mockImplementation(() => now);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('SimCarousel', () => {
  it('shows the active tile and two on each side, wrapping around the loop', () => {
    setup(0);
    const slots = screen.getAllByRole('button');
    expect(slots.map((s) => s.getAttribute('aria-label'))).toEqual([
      titleOf(0),
      titleOf(1),
      titleOf(2),
      titleOf(COUNT - 2),
      titleOf(COUNT - 1),
    ]);
    const centre = screen.getByRole('button', { name: titleOf(0) });
    expect(centre.getAttribute('aria-current')).toBe('true');
    expect(centre.style.opacity).toBe('1');
    expect(centre.querySelector('canvas')?.getAttribute('data-featured')).toBe('true');
    const far = screen.getByRole('button', { name: titleOf(COUNT - 2) });
    expect(far.style.opacity).toBe('0.45');
    expect(far.style.transform).toBe('translate(calc(-50% + -150%), -50%) scale(0.55)');
  });

  it('selects a side tile on click, and the centre one does nothing', () => {
    const { onActiveChange } = setup(3);
    fireEvent.click(screen.getByRole('button', { name: titleOf(4) }));
    expect(onActiveChange).toHaveBeenCalledWith(4);
    onActiveChange.mockClear();
    fireEvent.click(screen.getByRole('button', { name: titleOf(3) }));
    expect(onActiveChange).not.toHaveBeenCalled();
  });

  it('steps with the arrow keys, but not while typing', () => {
    const { onActiveChange } = setup(0);
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(onActiveChange).toHaveBeenLastCalledWith(1);
    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(onActiveChange).toHaveBeenLastCalledWith(COUNT - 1);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onActiveChange).toHaveBeenCalledTimes(2);

    const input = document.createElement('textarea');
    document.body.append(input);
    fireEvent.keyDown(input, { key: 'ArrowRight' });
    const editable = document.createElement('p');
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    document.body.append(editable);
    fireEvent.keyDown(editable, { key: 'ArrowRight' });
    expect(onActiveChange).toHaveBeenCalledTimes(2);
    input.remove();
    editable.remove();
  });
});

describe('SimCarousel gestures', () => {
  it('steps once per wheel gesture, by its larger axis', () => {
    const { onActiveChange } = setup(5);
    fireEvent.wheel(document, { deltaY: 30 });
    expect(onActiveChange).toHaveBeenLastCalledWith(6);
    // Still inside the cooldown.
    now += 100;
    fireEvent.wheel(document, { deltaY: 30 });
    expect(onActiveChange).toHaveBeenCalledTimes(1);
    now += 400;
    fireEvent.wheel(document, { deltaX: -30, deltaY: 10 });
    expect(onActiveChange).toHaveBeenLastCalledWith(4);
    // Too small to count.
    now += 400;
    fireEvent.wheel(document, { deltaY: 4 });
    expect(onActiveChange).toHaveBeenCalledTimes(2);
  });

  it('stops the wheel from scrolling, except over the composer and dialogs', () => {
    const { onActiveChange } = setup(0);
    const wheel = new WheelEvent('wheel', { deltaY: 30, bubbles: true, cancelable: true });
    globalThis.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(true);

    const dock = document.createElement('div');
    dock.className = 'dock';
    document.body.append(dock);
    now += 1000;
    const inDock = new WheelEvent('wheel', { deltaY: 30, bubbles: true, cancelable: true });
    dock.dispatchEvent(inDock);
    expect(inDock.defaultPrevented).toBe(false);
    expect(onActiveChange).toHaveBeenCalledTimes(1);
    dock.remove();
  });

  it('steps on a sideways swipe and swallows the click it ends with', () => {
    const { onActiveChange } = setup(0);
    const side = screen.getByRole('button', { name: titleOf(1) });
    side.dispatchEvent(touch('pointerdown', 200, 100));
    side.dispatchEvent(touch('pointerup', 100, 110));
    expect(onActiveChange).toHaveBeenLastCalledWith(1);
    fireEvent.click(side);
    expect(onActiveChange).toHaveBeenCalledTimes(1);
    // The next click is a click again.
    fireEvent.click(side);
    expect(onActiveChange).toHaveBeenCalledTimes(2);

    globalThis.dispatchEvent(touch('pointerdown', 100, 100));
    globalThis.dispatchEvent(touch('pointerup', 200, 100));
    expect(onActiveChange).toHaveBeenLastCalledWith(COUNT - 1);
  });

  it('ignores mouse drags, short or mostly vertical swipes, and cancelled ones', () => {
    const { onActiveChange } = setup(0);
    globalThis.dispatchEvent(touch('pointerdown', 200, 100, 'mouse'));
    globalThis.dispatchEvent(touch('pointerup', 50, 100, 'mouse'));
    globalThis.dispatchEvent(touch('pointerdown', 200, 100));
    globalThis.dispatchEvent(touch('pointerup', 180, 100));
    globalThis.dispatchEvent(touch('pointerdown', 200, 100));
    globalThis.dispatchEvent(touch('pointerup', 140, 300));
    globalThis.dispatchEvent(touch('pointerdown', 200, 100));
    globalThis.dispatchEvent(new Event('pointercancel'));
    globalThis.dispatchEvent(touch('pointerup', 50, 100));
    expect(onActiveChange).not.toHaveBeenCalled();
  });

  it('stops listening once removed', () => {
    const { onActiveChange, unmount } = setup(0);
    unmount();
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    fireEvent.wheel(document, { deltaY: 30 });
    expect(onActiveChange).not.toHaveBeenCalled();
  });
});
