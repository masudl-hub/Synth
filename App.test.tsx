import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PATCH } from './audio/defaultPatch.ts';
import type { SynthPatch } from './types.ts';

const PRESET: SynthPatch = { ...DEFAULT_PATCH, name: 'Preset' };

interface ComposerStub {
  thread: number;
  onPatch: (raw: unknown) => void;
  onStream: (draft: string) => void;
  onListen: () => void;
}

const fake = vi.hoisted(() => ({
  synth: {} as Record<string, unknown>,
  mic: {} as Record<string, unknown>,
  composer: null as ComposerStub | null,
}));

const SAVED = /^Saved/u;
const MINE = /^Mine/u;
const SAVE = /^Save current patch/u;

vi.mock('./hooks/useGenerativeAudio.ts', () => ({ useGenerativeAudio: () => fake.synth }));
vi.mock('./hooks/useAudioAnalyzer.ts', () => ({ useAudioAnalyzer: () => fake.mic }));
vi.mock('./hooks/useDynamicFavicon.ts', () => ({ useDynamicFavicon: vi.fn() }));
vi.mock('./components/Composer.tsx', () => ({
  // The test calls the composer's callbacks itself, as a reply or the ambient button would.
  Composer: (p: ComposerStub) => {
    fake.composer = p;
    return <section aria-label="Composer" data-thread={p.thread} />;
  },
}));
vi.mock('./components/SimCarousel.tsx', () => ({
  SimCarousel: (p: { active: number }) => (
    <section className="sim-carousel" aria-label="Carousel" data-active={p.active}>
      <canvas />
    </section>
  ),
}));
vi.mock('./components/Article.tsx', () => ({
  Article: (p: { onOpenStudio: () => void }) => (
    <article className="article" aria-label="Article">
      <canvas />
      <button type="button" onClick={p.onOpenStudio}>
        Studio
      </button>
    </article>
  ),
}));

const { App } = await import('./App.tsx');
const { simulations } = await import('./simulations/logic.ts');

let frames: FrameRequestCallback[] = [];
const flushFrames = () => {
  const run = frames;
  frames = [];
  for (const f of run) {
    f(0);
  }
};
let now = 0;

const resetFakes = () => {
  fake.synth = {
    audioDataRef: { current: null },
    loadGenerated: vi.fn(),
    togglePlay: vi.fn(),
    stopPlayback: vi.fn(),
    clearPatch: vi.fn(),
    loadPatch: vi.fn(),
    isPlaying: false,
    currentPatch: PRESET,
    bpm: 120,
    updateBpm: vi.fn(),
    volume: 0.5,
    updateVolume: vi.fn(),
    filterFreq: 1000,
    updateFilter: vi.fn(),
    updateOscillator: vi.fn(),
    patchVersion: 1,
    savedPatches: [{ ...DEFAULT_PATCH, name: 'Mine' }],
    saveCurrentPatch: vi.fn(),
    deleteSavedPatch: vi.fn(),
    PRESETS: { Preset: PRESET },
  };
  fake.mic = { audioDataRef: { current: null }, startAudio: vi.fn(), stopAudio: vi.fn(), isAudioEnabled: false };
};

const main = () => document.querySelector('main');
const view = () => main()?.getAttribute('data-view');
const phase = () => main()?.getAttribute('data-phase');

/** Runs the ease out, the swap, and the two frames before the paint check. */
const finishSwap = () => {
  act(() => {
    vi.advanceTimersByTime(220);
  });
  act(() => flushFrames());
  act(() => flushFrames());
};

/** Canvases that read back as the given alpha, or that cannot be read at all. */
const inkOf = (alpha: number | 'throws' | 'none') =>
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => {
    if (alpha === 'none') {
      return null;
    }
    return {
      getImageData: () => {
        if (alpha === 'throws') {
          throw new Error('tainted');
        }
        return { data: new Uint8ClampedArray([0, 0, 0, alpha]) };
      },
    };
  }) as unknown as HTMLCanvasElement['getContext']);

beforeEach(() => {
  resetFakes();
  frames = [];
  now = 0;
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => frames.push(f));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('scrollTo', vi.fn());
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  globalThis.history.replaceState(null, '', '/');
  inkOf(255);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('App', () => {
  it('opens the studio on Swarm', () => {
    render(<App />);
    expect(view()).toBe('studio');
    const swarm = simulations.findIndex((s) => s.title === 'Swarm');
    expect(screen.getByRole('region', { name: 'Carousel' }).getAttribute('data-active')).toBe(String(swarm));
    expect(screen.getByText('cymatics lab')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Theorem' }).getAttribute('href')).toBe('https://theorem.masudlewis.com');
  });

  it('plays a generated patch and eases the controls in', () => {
    const { container } = render(<App />);
    expect(container.querySelector('.strip__arrive')).toBeNull();
    act(() => fake.composer?.onPatch({ name: 'Made' }));
    expect(fake.synth.loadGenerated).toHaveBeenCalledWith({ name: 'Made' });
    expect(container.querySelector('.strip__arrive')).toBeTruthy();
  });

  it('shows the stream while it is written', () => {
    const { container } = render(<App />);
    act(() => fake.composer?.onStream('{"bpm":'));
    expect(container.querySelector('.stream__text')?.textContent).toBe('{"bpm":');
  });

  it('switches to the microphone and back, keeping the composer mounted', () => {
    const { container } = render(<App />);
    act(() => fake.composer?.onStream('{"bpm":'));
    act(() => fake.composer?.onListen());
    expect(fake.synth.stopPlayback).toHaveBeenCalled();
    expect(fake.mic.startAudio).toHaveBeenCalled();
    expect(container.querySelector('.dock__slot')?.hasAttribute('hidden')).toBe(true);
    expect(container.querySelector('.strip--hidden')).toBeTruthy();
    expect(container.querySelector('.stream__text')?.textContent).toBe('');
    expect(screen.getByRole('button', { name: 'Allow microphone' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Ambient sound' }));
    expect(fake.mic.stopAudio).toHaveBeenCalled();
    expect(container.querySelector('.dock__slot')?.hasAttribute('hidden')).toBe(false);
  });

  it('starts over with a new thread and no patch', () => {
    const { container } = render(<App />);
    act(() => fake.composer?.onStream('{"bpm":'));
    fireEvent.click(screen.getByRole('button', { name: 'Start over' }));
    expect(fake.synth.clearPatch).toHaveBeenCalled();
    expect(screen.getByRole('region', { name: 'Composer' }).getAttribute('data-thread')).toBe('1');
    expect(container.querySelector('.stream__text')?.textContent).toBe('');
  });

  it('lists presets and saved patches in the library, and loading one closes it', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Library' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    // The loaded patch is one of the presets, so it is already saved.
    expect(screen.getByRole('button', { name: SAVED }).hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: MINE }));
    expect(fake.synth.loadPatch).toHaveBeenCalledWith(expect.objectContaining({ name: 'Mine' }), true);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('offers to save a patch that is not in the library, and nothing when none is loaded', () => {
    fake.synth.currentPatch = { ...DEFAULT_PATCH, name: 'Fresh' };
    const { unmount } = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Library' }));
    fireEvent.click(screen.getByRole('button', { name: SAVE }));
    expect(fake.synth.saveCurrentPatch).toHaveBeenCalled();
    unmount();

    fake.synth.currentPatch = null;
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Library' }));
    expect(screen.getByRole('button', { name: SAVE }).hasAttribute('disabled')).toBe(true);
  });
});

describe('App routes', () => {
  it('goes to the article at its own path, easing out and in, and silences the sound', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Why this exists' }));
    expect(globalThis.location.pathname).toBe('/why');
    expect(phase()).toBe('out');
    expect(view()).toBe('studio');

    finishSwap();
    expect(view()).toBe('article');
    expect(globalThis.scrollTo).toHaveBeenCalledWith(0, 0);
    expect(phase()).toBe('in');
    expect(fake.synth.stopPlayback).toHaveBeenCalled();
    expect(fake.mic.stopAudio).toHaveBeenCalled();
    expect(screen.queryByRole('region', { name: 'Carousel' })).toBeNull();
    act(() => {
      vi.advanceTimersByTime(320);
    });
    expect(phase()).toBe('idle');

    fireEvent.click(screen.getByRole('button', { name: 'Studio' }));
    expect(globalThis.location.pathname).toBe('/');
    finishSwap();
    expect(view()).toBe('studio');
  });

  it('does nothing when asked for the view it is already on', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Start over' }));
    expect(phase()).toBe('idle');
  });

  it('opens on the article at its path, with or without a trailing slash', () => {
    globalThis.history.replaceState(null, '', '/why/');
    render(<App />);
    expect(view()).toBe('article');
  });

  it('follows the back button', () => {
    render(<App />);
    globalThis.history.replaceState(null, '', '/why');
    act(() => {
      globalThis.dispatchEvent(new PopStateEvent('popstate'));
    });
    finishSwap();
    expect(view()).toBe('article');
  });

  it('waits for the new canvases to paint, but not for ever', () => {
    inkOf(0);
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Why this exists' }));
    finishSwap();
    expect(phase()).toBe('out');
    act(() => flushFrames());
    expect(phase()).toBe('out');
    now = 700;
    act(() => flushFrames());
    expect(phase()).toBe('in');
  });

  it('counts an unreadable canvas as painted', () => {
    inkOf('throws');
    const { unmount } = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Why this exists' }));
    finishSwap();
    expect(phase()).toBe('in');
    unmount();

    vi.restoreAllMocks();
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    inkOf('none');
    globalThis.history.replaceState(null, '', '/');
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Why this exists' }));
    finishSwap();
    expect(phase()).toBe('in');
  });
});
