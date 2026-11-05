import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { StreamReadout } from './StreamReadout.tsx';

describe('StreamReadout', () => {
  afterEach(cleanup);

  it('is hidden and empty while nothing streams', () => {
    const { container } = render(<StreamReadout text={null} />);
    const root = container.querySelector('.stream');
    expect(root?.getAttribute('data-live')).toBe('false');
    expect(root?.getAttribute('aria-hidden')).toBe('true');
    expect(root?.textContent).toBe('');
  });

  it('shows only the tail of a long stream', () => {
    const text = `${'a'.repeat(100)}${'b'.repeat(1400)}`;
    const { container } = render(<StreamReadout text={text} />);
    expect(container.querySelector('.stream')?.getAttribute('data-live')).toBe('true');
    expect(container.querySelector('.stream__text')?.textContent).toBe('b'.repeat(1400));
  });
});
