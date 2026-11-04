import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Tile } from './Tile';
import { simulations } from '../simulations/logic';
import { AudioFeatures } from '../types';

interface SimCarouselProps {
  audioDataRef: React.MutableRefObject<AudioFeatures>;
  shouldTimeAdvance: boolean;
  resetTrigger?: unknown;
}

/** Cards shown each side of the centre one: 2 gives five visible tiles. */
const REACH = 2;
const SCALES = [1, 0.74, 0.55];
const SPACING = [0, 0.88, 1.5];
const WHEEL_COOLDOWN_MS = 380;

/** Signed shortest distance from `active` to `index` around the loop. */
const offsetOf = (index: number, active: number, count: number) => {
  let d = index - active;
  if (d > count / 2) d -= count;
  if (d < -count / 2) d += count;
  return d;
};

export const SimCarousel: React.FC<SimCarouselProps> = ({ audioDataRef, shouldTimeAdvance, resetTrigger }) => {
  const count = simulations.length;
  const [active, setActive] = useState(0);
  const lastWheel = useRef(0);

  const step = useCallback((dir: 1 | -1) => setActive((a) => (a + dir + count) % count), [count]);

  const onWheel = (e: React.WheelEvent) => {
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    const now = performance.now();
    if (Math.abs(delta) < 8 || now - lastWheel.current < WHEEL_COOLDOWN_MS) return;
    lastWheel.current = now;
    step(delta > 0 ? 1 : -1);
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
    <div ref={rootRef} className="sim-carousel" onWheel={onWheel} role="group" aria-roledescription="carousel" aria-label="Simulations">
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
            onClick={isCenter ? undefined : () => setActive(i)}
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
