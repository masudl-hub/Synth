import React, { useCallback, useEffect, useRef } from 'react';
import { Tile } from './Tile';
import { simulations } from '../simulations/logic';
import { AudioFeatures } from '../types';

interface SimCarouselProps {
  active: number;
  onActiveChange: (index: number) => void;
  audioDataRef: React.MutableRefObject<AudioFeatures>;
  shouldTimeAdvance: boolean;
  resetTrigger?: unknown;
}

/** Cards shown each side of the centre one: 2 gives five visible tiles. */
const REACH = 2;
const SCALES = [1, 0.74, 0.55];
const SPACING = [0, 0.88, 1.5];
const WHEEL_COOLDOWN_MS = 380;
const SWIPE_MIN_PX = 40;

/** Signed shortest distance from `active` to `index` around the loop. */
const offsetOf = (index: number, active: number, count: number) => {
  let d = index - active;
  if (d > count / 2) d -= count;
  if (d < -count / 2) d += count;
  return d;
};

export const SimCarousel: React.FC<SimCarouselProps> = ({ active, onActiveChange, audioDataRef, shouldTimeAdvance, resetTrigger }) => {
  const count = simulations.length;
  const lastWheel = useRef(0);

  const step = useCallback((dir: 1 | -1) => onActiveChange((active + dir + count) % count), [active, count, onActiveChange]);

  const onWheel = (e: React.WheelEvent) => {
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    const now = performance.now();
    if (Math.abs(delta) < 8 || now - lastWheel.current < WHEEL_COOLDOWN_MS) return;
    lastWheel.current = now;
    step(delta > 0 ? 1 : -1);
  };

  // Horizontal swipe on touch screens.
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') swipeStart.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    if (Math.abs(dx) > SWIPE_MIN_PX && Math.abs(dx) > Math.abs(e.clientY - start.y)) {
      swiped.current = true;
      step(dx < 0 ? 1 : -1);
    }
  };
  // A swipe that ends on a side tile must not also select it.
  const swiped = useRef(false);
  const onClickCapture = (e: React.MouseEvent) => {
    if (swiped.current) e.stopPropagation();
    swiped.current = false;
  };

  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step]);

  return (
    <div ref={rootRef} className="sim-carousel" onWheel={onWheel}
      onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { swipeStart.current = null; }} onClickCapture={onClickCapture} role="group" aria-roledescription="carousel" aria-label="Simulations">
      {simulations.map((sim, i) => {
        const offset = offsetOf(i, active, count);
        const distance = Math.abs(offset);
        if (distance > REACH) return null;
        const isCenter = offset === 0;
        const dir = Math.sign(offset);
        const translate = `calc(-50% + ${dir * SPACING[distance] * 100}%)`;
        return (
          <div
            key={sim.id}
            className="sim-carousel__slot"
            data-center={isCenter}
            onClick={isCenter ? undefined : () => onActiveChange(i)}
            style={{
              transform: `translate(${translate}, -50%) scale(${SCALES[distance]})`,
              opacity: distance === 2 ? 0.45 : distance === 1 ? 0.8 : 1,
              zIndex: REACH + 1 - distance,
            }}
            aria-label={sim.title}
            aria-current={isCenter}
          >
            <Tile
              sim={sim}
              audioDataRef={audioDataRef}
              shouldTimeAdvance={shouldTimeAdvance}
              resetTrigger={resetTrigger}
              isFeatured={isCenter}
            />
          </div>
        );
      })}
    </div>
  );
};
