import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SignalDiagram } from './SignalDiagram.tsx';

const ENGINE_TIP = /scheduler wakes every 25 milliseconds/u;

/** The box for a stage. */
const box = (id: string) => {
  const g = document.querySelector<SVGGElement>(`[data-tip="${id}"]`);
  if (!g) {
    throw new Error(`No box for ${id}`);
  }
  return g;
};

describe('SignalDiagram', () => {
  afterEach(cleanup);

  it('draws one named, focusable box for each stage', () => {
    const { container } = render(<SignalDiagram />);
    expect(screen.getByRole('figure', { name: 'How sound reaches the canvases' })).toBeTruthy();
    const boxes = Array.from(container.querySelectorAll('[data-tip]'), (g) => g.getAttribute('data-tip'));
    expect(boxes).toEqual(['you', 'model', 'patch', 'engine', 'mic', 'analyser', 'canvases']);
    for (const g of container.querySelectorAll('[data-tip]')) {
      expect(g.getAttribute('tabindex')).toBe('0');
    }
    expect(box('engine').getAttribute('aria-label')).toMatch(ENGINE_TIP);
    expect(box('engine').textContent).toBe('The synth engineoscillators · filter · drums · reverb');
  });

  it('shows the stage tip while the pointer is over its box', () => {
    render(<SignalDiagram />);
    expect(screen.queryByText(ENGINE_TIP)).toBeNull();
    const title = box('engine').querySelector('text');
    if (title) {
      fireEvent.mouseOver(title);
    }
    expect(screen.getByText(ENGINE_TIP)).toBeTruthy();
    fireEvent.mouseLeave(screen.getByRole('figure'));
    expect(screen.queryByText(ENGINE_TIP)).toBeNull();
  });

  it('shows no tip over the space between boxes', () => {
    const { container } = render(<SignalDiagram />);
    const arrow = container.querySelector('line');
    if (arrow) {
      fireEvent.mouseOver(arrow);
    }
    expect(document.querySelector('.article__marker')).toBeNull();
  });

  it('shows the tip on focus and hides it on blur', () => {
    render(<SignalDiagram />);
    fireEvent.focus(box('engine'));
    expect(screen.getByText(ENGINE_TIP)).toBeTruthy();
    fireEvent.blur(box('engine'));
    expect(screen.queryByText(ENGINE_TIP)).toBeNull();
  });

  it('closes the tip when the page scrolls', () => {
    render(<SignalDiagram />);
    fireEvent.focus(box('engine'));
    act(() => {
      globalThis.dispatchEvent(new Event('scroll'));
    });
    expect(screen.queryByText(ENGINE_TIP)).toBeNull();
  });
});
