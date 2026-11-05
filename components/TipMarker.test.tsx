import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TipMarker } from './TipMarker.tsx';

describe('TipMarker', () => {
  afterEach(cleanup);

  it('lays its marker over the part and holds the tip open', () => {
    render(<TipMarker name="Gain" text="How loud it is." box={new DOMRect(10, 20, 30, 40)} />);
    const marker = document.querySelector<HTMLElement>('.article__marker');
    expect([marker?.style.left, marker?.style.top, marker?.style.width, marker?.style.height]).toEqual([
      '10px',
      '20px',
      '30px',
      '40px',
    ]);
    expect(screen.getByText('Gain.').tagName).toBe('STRONG');
    expect(screen.getByText('How loud it is.', { exact: false })).toBeTruthy();
  });
});
