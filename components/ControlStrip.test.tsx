import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PATCH } from '../audio/defaultPatch.ts';
import { focusPart } from '../audio/patch.ts';
import type { SynthPatch, WaveShape } from '../types.ts';
import { ControlStrip, type ControlStripProps } from './ControlStrip.tsx';

const INVALID = /^Invalid JSON:/u;

/** The default patch, with its playing instrument on the given wave. */
const onWave = (type: WaveShape, extra: Partial<SynthPatch> = {}): SynthPatch => {
  const part = focusPart(DEFAULT_PATCH);
  const sound = DEFAULT_PATCH[part];
  return { ...DEFAULT_PATCH, ...extra, [part]: { ...sound, oscillator: { ...sound.oscillator, type } } };
};

const setup = (props: Partial<ControlStripProps> = {}) => {
  const handlers = {
    onTogglePlay: vi.fn(),
    updateBpm: vi.fn(),
    updateVolume: vi.fn(),
    updateFilter: vi.fn(),
    onCycleOscillator: vi.fn(),
    onOpenLibrary: vi.fn(),
    onUpdatePatch: vi.fn(),
  };
  const view = render(
    <ControlStrip
      currentPatch={onWave('sine', { name: 'Glass', description: 'Short and bright.' })}
      isPlaying={false}
      bpm={120}
      volume={0.5}
      filterFreq={632}
      {...handlers}
      {...props}
    />,
  );
  return { ...handlers, ...view };
};

const openEditor = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Edit patch JSON' }));
  return screen.getByLabelText('Patch JSON') as HTMLTextAreaElement;
};

describe('ControlStrip', () => {
  afterEach(cleanup);

  it('plays and pauses', () => {
    const { onTogglePlay, rerender } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(onTogglePlay).toHaveBeenCalledTimes(1);
    rerender(
      <ControlStrip
        currentPatch={DEFAULT_PATCH}
        isPlaying={true}
        onTogglePlay={onTogglePlay}
        bpm={120}
        updateBpm={vi.fn()}
        volume={0.5}
        updateVolume={vi.fn()}
        filterFreq={632}
        updateFilter={vi.fn()}
        onCycleOscillator={vi.fn()}
        onOpenLibrary={vi.fn()}
        onUpdatePatch={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(onTogglePlay).toHaveBeenCalledTimes(2);
  });

  it('shows the patch name and a short description whole', () => {
    setup();
    expect(screen.getByText('Glass')).toBeTruthy();
    expect(screen.getByText('Short and bright.')).toBeTruthy();
  });

  it('cuts a long description on a word, without trailing punctuation', () => {
    const description = 'A slow, warm pad that drifts between two chords, with a soft bell on top.';
    setup({ currentPatch: onWave('sine', { description }) });
    expect(screen.getByText('A slow, warm pad that drifts between two…')).toBeTruthy();
  });

  it('disables what needs a patch when there is none', () => {
    setup({ currentPatch: null });
    expect(screen.getByText('No patch')).toBeTruthy();
    for (const name of ['Play', 'Edit patch JSON', 'Oscillator wave, currently sine']) {
      expect(screen.getByRole('button', { name }).getAttribute('aria-disabled')).toBe('true');
    }
  });

  it('steps the wave to the next shape, and from the last back to the first', () => {
    const { onCycleOscillator, unmount } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Oscillator wave, currently sine' }));
    expect(onCycleOscillator).toHaveBeenLastCalledWith('triangle');
    unmount();
    const bell = setup({ currentPatch: onWave('bell') });
    fireEvent.click(screen.getByRole('button', { name: 'Oscillator wave, currently bell' }));
    expect(bell.onCycleOscillator).toHaveBeenLastCalledWith('sine');
  });

  it('opens the library', () => {
    const { onOpenLibrary } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Library' }));
    expect(onOpenLibrary).toHaveBeenCalled();
  });

  it('places the filter slider by octaves and reports hertz', () => {
    const { updateFilter } = setup();
    const filter = screen.getByRole('slider', { name: 'Filter' });
    // 632 Hz is half way between 20 Hz and 20 kHz in octaves.
    expect(Number(filter.getAttribute('aria-valuenow'))).toBeCloseTo(0.5, 2);
    expect(filter.getAttribute('aria-valuetext')).toBe('632 Hz');
    fireEvent.keyDown(filter, { key: 'End' });
    expect(updateFilter).toHaveBeenLastCalledWith(20_000);
    expect(screen.getByRole('slider', { name: 'Volume' }).getAttribute('aria-valuetext')).toBe('50%');
  });

  it('edits the patch as JSON with comments, and applies it', () => {
    const { onUpdatePatch } = setup({ isPlaying: true });
    const input = openEditor();
    expect(JSON.parse(input.value)).toEqual(expect.objectContaining({ name: 'Glass' }));
    fireEvent.change(input, { target: { value: '{\n  // the name\n  "name": /* new */ "Ice"\n}' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onUpdatePatch).toHaveBeenCalledWith({ name: 'Ice' }, true);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps the editor open with the error when the JSON is invalid', () => {
    const { onUpdatePatch } = setup();
    fireEvent.change(openEditor(), { target: { value: '{ "name": ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onUpdatePatch).not.toHaveBeenCalled();
    expect(screen.getByText(INVALID)).toBeTruthy();
  });

  it('cancels without changing the patch, and reopens on the patch as it is', () => {
    const { onUpdatePatch } = setup();
    fireEvent.change(openEditor(), { target: { value: '{ "name": ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onUpdatePatch).not.toHaveBeenCalled();
    const reopened = openEditor();
    expect(JSON.parse(reopened.value)).toEqual(expect.objectContaining({ name: 'Glass' }));
    expect(screen.queryByText(INVALID)).toBeNull();
    const docs = reopened.closest('.patch-editor');
    expect(docs ? within(docs as HTMLElement).getAllByText('bpm').length : 0).toBeGreaterThan(0);
  });
});
