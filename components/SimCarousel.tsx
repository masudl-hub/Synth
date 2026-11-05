import type React from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { simulations } from '../simulations/logic.ts';
import type { AudioFeatures } from '../types.ts';
import { Tile } from './Tile.tsx';

export interface SimCarouselProps {
  active: number;
  onActiveChange: (index: number) => void;
  audioDataRef: React.RefObject<AudioFeatures>;
  shouldTimeAdvance: boolean;
  resetTrigger?: unknown;
}

/** Cards shown each side of the centre one: 2 gives five visible tiles. */
const REACH = 2;
const SCALES = [1, 0.74, 0.55];
const SPACING = [0, 0.88, 1.5];
const WHEEL_COOLDOWN_MS = 380;
const SWIPE_MIN_PX = 40;
const WHEEL_MIN = 8;
const COUNT = simulations.length;
const FORM_FIELD = /^(INPUT|TEXTAREA|SELECT)$/u;

/** Signed shortest distance from `active` to `index` around the loop. */
const offsetOf = (index: number, active: number, count: number) => {
  let d = index - active;
  if (d > count / 2) {
    d -= count;
  }
  if (d < -count / 2) {
    d += count;
  }
  return d;
};

/**
 * Steps the carousel from the wheel, a sideways swipe or the arrow keys. Returns the click handler that swallows the
 * click a swipe ends with.
 */
const useStepGestures = (step: (dir: 1 | -1) => void) => {
  const lastWheel = useRef(0);
  // Scrolling or swiping anywhere moves the carousel, except over the composer, menus and dialogs.
  const stepRef = useRef(step);
  stepRef.current = step;
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const ignored = (target: EventTarget | null) =>
      !!(target as Element | null)?.closest?.(
        '.dock, dialog, [role="dialog"], [role="alertdialog"], [role="listbox"], [role="menu"]',
      );
    const onWheel = (e: WheelEvent) => {
      if (ignored(e.target)) {
        return;
      }
      // Nothing here scrolls, so this also stops a sideways swipe from going back a page.
      e.preventDefault();
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      const now = performance.now();
      if (Math.abs(delta) < WHEEL_MIN || now - lastWheel.current < WHEEL_COOLDOWN_MS) {
        return;
      }
      lastWheel.current = now;
      stepRef.current(delta > 0 ? 1 : -1);
    };
    // Horizontal swipe on touch screens.
    const onPointerDown = (e: PointerEvent) => {
      swipeStart.current = e.pointerType !== 'mouse' && !ignored(e.target) ? { x: e.clientX, y: e.clientY } : null;
    };
    const onPointerUp = (e: PointerEvent) => {
      const start = swipeStart.current;
      swipeStart.current = null;
      if (!start) {
        return;
      }
      const dx = e.clientX - start.x;
      if (Math.abs(dx) > SWIPE_MIN_PX && Math.abs(dx) > Math.abs(e.clientY - start.y)) {
        swiped.current = true;
        stepRef.current(dx < 0 ? 1 : -1);
      }
    };
    const onPointerCancel = () => {
      swipeStart.current = null;
    };
    globalThis.addEventListener('wheel', onWheel, { passive: false });
    globalThis.addEventListener('pointerdown', onPointerDown);
    globalThis.addEventListener('pointerup', onPointerUp);
    globalThis.addEventListener('pointercancel', onPointerCancel);
    return () => {
      globalThis.removeEventListener('wheel', onWheel);
      globalThis.removeEventListener('pointerdown', onPointerDown);
      globalThis.removeEventListener('pointerup', onPointerUp);
      globalThis.removeEventListener('pointercancel', onPointerCancel);
    };
  }, []);
  // A swipe that ends on a side tile must not also select it.
  const swiped = useRef<boolean>(false);
  const onClickCapture = (e: React.MouseEvent) => {
    if (swiped.current) {
      e.stopPropagation();
    }
    swiped.current = false;
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || FORM_FIELD.test(el.tagName))) {
        return;
      }
      if (e.key === 'ArrowRight') {
        step(1);
      }
      if (e.key === 'ArrowLeft') {
        step(-1);
      }
    };
    globalThis.addEventListener('keydown', onKey);
    return () => globalThis.removeEventListener('keydown', onKey);
  }, [step]);
  return onClickCapture;
};

export const SimCarousel: React.FC<SimCarouselProps> = ({
  active,
  onActiveChange,
  audioDataRef,
  shouldTimeAdvance,
  resetTrigger,
}) => {
  const step = useCallback((dir: 1 | -1) => onActiveChange((active + dir + COUNT) % COUNT), [active, onActiveChange]);

  const onClickCapture = useStepGestures(step);

  return (
    <section
      className="sim-carousel"
      onClickCapture={onClickCapture}
      aria-roledescription="carousel"
      aria-label="Simulations"
    >
      {simulations.map((sim, i) => {
        const offset = offsetOf(i, active, COUNT);
        const distance = Math.abs(offset);
        if (distance > REACH) {
          return null;
        }
        return (
          <Slot
            key={sim.id}
            index={i}
            distance={distance}
            dir={Math.sign(offset)}
            onSelect={onActiveChange}
            label={sim.title}
          >
            <Tile
              sim={sim}
              audioDataRef={audioDataRef}
              shouldTimeAdvance={shouldTimeAdvance}
              resetTrigger={resetTrigger}
              isFeatured={distance === 0}
            />
          </Slot>
        );
      })}
    </section>
  );
};

/** How faded a slot is, by how many places it is from the centre. */
const OPACITY = [1, 0.8, 0.45];

/**
 * One place in the carousel. It is a button, so a side tile can be picked by click or keyboard; the centre one does
 * nothing. It stays the same element as it moves, so its canvas keeps running.
 */
const Slot: React.FC<{
  index: number;
  distance: number;
  dir: number;
  label: string;
  onSelect: (index: number) => void;
  children: React.ReactNode;
}> = ({ index, distance, dir, label, onSelect, children }) => {
  const isCenter = distance === 0;
  const select = useCallback(() => {
    if (!isCenter) {
      onSelect(index);
    }
  }, [isCenter, onSelect, index]);
  const translate = `calc(-50% + ${dir * SPACING[distance] * 100}%)`;
  return (
    <button
      type="button"
      className="sim-carousel__slot"
      data-center={isCenter}
      onClick={select}
      style={{
        transform: `translate(${translate}, -50%) scale(${SCALES[distance]})`,
        opacity: OPACITY[distance],
        zIndex: REACH + 1 - distance,
      }}
      aria-label={label}
      aria-current={isCenter}
    >
      {children}
    </button>
  );
};
