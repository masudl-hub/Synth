import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JsonEditor } from './JsonEditor.tsx';

/** Each painted token as its class and text, in order. */
const tokensOf = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('.json__paint span'), (s) => [s.className, s.textContent]);

const paint = (value: string) => {
  const { container } = render(<JsonEditor label="Patch" value={value} onChange={vi.fn()} />);
  return container;
};

describe('JsonEditor', () => {
  afterEach(cleanup);

  it('tells keys from string values', () => {
    expect(tokensOf(paint('{"name": "Glass"}'))).toEqual([
      ['json__punct', '{'],
      ['json__key', '"name":'],
      ['json__str', '"Glass"'],
      ['json__punct', '}'],
    ]);
  });

  it('paints numbers, literals and escaped strings', () => {
    expect(tokensOf(paint('[-1.5e3, 2, true, false, null, "a\\"b"]'))).toEqual([
      ['json__punct', '['],
      ['json__num', '-1.5e3'],
      ['json__punct', ','],
      ['json__num', '2'],
      ['json__punct', ','],
      ['json__lit', 'true'],
      ['json__punct', ','],
      ['json__lit', 'false'],
      ['json__punct', ','],
      ['json__lit', 'null'],
      ['json__punct', ','],
      ['json__str', '"a\\"b"'],
      ['json__punct', ']'],
    ]);
  });

  it('paints line and block comments', () => {
    const tokens = tokensOf(paint('// one\n/* two\nlines */ 3'));
    expect(tokens).toEqual([
      ['json__comment', '// one'],
      ['json__comment', '/* two\nlines */'],
      ['json__num', '3'],
    ]);
  });

  it('keeps the text between tokens, so the paint matches the source', () => {
    const source = '{ "a" :  1 }  trailing';
    const painted = paint(source).querySelector('.json__paint')?.textContent;
    expect(painted).toBe(`${source}\n`);
  });

  it('paints nothing for empty text', () => {
    expect(tokensOf(paint(''))).toEqual([]);
  });

  it('reports each edit', () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(<JsonEditor label="Patch" value="{}" onChange={onChange} />);
    fireEvent.change(getByLabelText('Patch'), { target: { value: '[]' } });
    expect(onChange).toHaveBeenCalledWith('[]');
  });

  it('scrolls the paint with the text', () => {
    const { getByLabelText, container } = render(<JsonEditor label="Patch" value="{}" onChange={vi.fn()} rows={4} />);
    const input = getByLabelText('Patch');
    input.scrollTop = 40;
    input.scrollLeft = 12;
    fireEvent.scroll(input);
    const pre = container.querySelector<HTMLPreElement>('.json__paint');
    expect(pre?.scrollTop).toBe(40);
    expect(pre?.scrollLeft).toBe(12);
    expect(container.querySelector<HTMLElement>('.json')?.style.getPropertyValue('--rows')).toBe('4');
  });
});
