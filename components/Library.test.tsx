import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PATCH } from '../audio/defaultPatch.ts';
import type { SynthPatch } from '../types.ts';
import { Library, type LibraryEntry, type LibraryProps } from './Library.tsx';

const named = (name: string, extra: Partial<SynthPatch> = {}): SynthPatch => ({ ...DEFAULT_PATCH, name, ...extra });

const setup = (props: Partial<LibraryProps> = {}) => {
  const handlers = { onSave: vi.fn(), onLoad: vi.fn(), onDelete: vi.fn() };
  const entries: LibraryEntry[] = [
    { patch: named('Preset one', { totalSteps: 32 }), savedIndex: null },
    { patch: named('Mine', { totalSteps: 16 }), savedIndex: 0 },
    { patch: named('Mine', { totalSteps: 24 }), savedIndex: 1 },
  ];
  render(<Library entries={entries} currentPatch={named('Playing')} isCurrentSaved={false} {...handlers} {...props} />);
  return handlers;
};

const SAVE = /Save current patch/u;
const SAVED = /^Saved/u;

/** Each chip on a card, in order. */
const chipsOf = (card: HTMLElement | undefined) =>
  Array.from(card?.querySelectorAll('.library__chip') ?? [], (c) => c.textContent);

/** The card that loads the named patch; saved patches can share a name, so there may be several. */
const cards = (name: string) => screen.getAllByRole('button', { name: new RegExp(`^${name}`, 'u') });

describe('Library', () => {
  afterEach(cleanup);

  it('lists the save card and one card per entry', () => {
    setup();
    expect(screen.getByRole('list', { name: 'Patch library' })).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
  });

  it('shows each patch with its waveform and loop length', () => {
    setup();
    const [preset] = cards('Preset one');
    const [one, half] = cards('Mine');
    expect(chipsOf(preset)).toEqual(['sawtooth', '2 bars']);
    expect(chipsOf(one)).toEqual(['sawtooth', '1 bar', 'saved']);
    expect(chipsOf(half)).toEqual(['sawtooth', '1.5 bars', 'saved']);
  });

  it('loads a patch from its card', () => {
    const { onLoad } = setup();
    const [preset] = cards('Preset one');
    if (preset) {
      fireEvent.click(preset);
    }
    expect(onLoad).toHaveBeenCalledWith(expect.objectContaining({ name: 'Preset one' }));
  });

  it('deletes only saved patches, by their place in the saved list', () => {
    const { onDelete } = setup();
    const deletes = screen.getAllByRole('button', { name: 'Delete Mine' });
    expect(deletes).toHaveLength(2);
    const [, second] = deletes;
    if (second) {
      fireEvent.click(second);
    }
    expect(onDelete).toHaveBeenCalledWith(1);
    expect(screen.queryByRole('button', { name: 'Delete Preset one' })).toBeNull();
  });

  it('saves the patch that is playing', () => {
    const { onSave } = setup();
    const save = screen.getByRole('button', { name: SAVE });
    expect(save.textContent).toContain('Playing');
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalled();
  });

  it('cannot save a patch that is already saved', () => {
    setup({ isCurrentSaved: true });
    const save = screen.getByRole('button', { name: SAVED });
    expect(save.hasAttribute('disabled')).toBe(true);
  });

  it('cannot save when nothing is loaded', () => {
    setup({ currentPatch: null });
    const save = screen.getByRole('button', { name: SAVE });
    expect(save.textContent).toContain('No patch loaded');
    expect(save.hasAttribute('disabled')).toBe(true);
  });
});
