import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Article } from './Article.tsx';
import { CANVAS_NOTES } from './articleSections.ts';

// KaTeX checks the mode as it loads and will not draw in quirks mode. The page has a doctype; the test document does not.
vi.hoisted(() => Object.defineProperty(document, 'compatMode', { value: 'CSS1Compat', configurable: true }));

const engine = vi.hoisted(() => ({
  instances: [] as {
    silent: boolean;
    loadPatch: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
    resume: ReturnType<typeof vi.fn>;
    isRunning: boolean;
    audioData: { rms: number };
  }[],
}));

vi.mock('../audio/SynthEngine.ts', () => ({
  SynthEngine: class {
    loadPatch = vi.fn();
    setFilterFreq = vi.fn();
    setVolume = vi.fn();
    start = vi.fn();
    dispose = vi.fn();
    resume = vi.fn(() => Promise.resolve());
    isRunning = false;
    audioData = { rms: 0.5 };
    silent: boolean;
    constructor(silent: boolean) {
      this.silent = silent;
      engine.instances.push(this);
    }
  },
}));

vi.mock('../hooks/useCanvas.ts', () => ({
  useCanvas: () => ({
    canvasRef: { current: null },
    handleMouseMove: vi.fn(),
    handleMouseEnter: vi.fn(),
    handleMouseLeave: vi.fn(),
  }),
}));

const RIDGE = CANVAS_NOTES[0];
const FIRST = /^01 · /u;
const STFT_TIP = /Cut the sound into short slices/u;

let frames: FrameRequestCallback[] = [];
const nextFrame = () => {
  const run = frames;
  frames = [];
  for (const f of run) {
    f(0);
  }
};

/** Every glyph sits in one small box, so a pointer inside it is on a glyph and one outside is not. */
const GLYPH = new DOMRect(10, 10, 20, 20);

const stftPart = () => {
  const part = document.querySelector<HTMLElement>('.article__formula [data-tip="STFT"]');
  if (!part) {
    throw new Error('The Ridge formula has no STFT part');
  }
  return part;
};

describe('Article', () => {
  beforeEach(() => {
    engine.instances.length = 0;
    vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => frames.push(f));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.spyOn(Range.prototype, 'getClientRects').mockImplementation(() => [GLYPH] as unknown as DOMRectList);
  });
  afterEach(() => {
    cleanup();
    frames = [];
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('writes up every canvas, numbered, with its formula', () => {
    const { container } = render(<Article onOpenStudio={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Making sound visible, honestly');
    expect(container.querySelectorAll('.article__canvas')).toHaveLength(CANVAS_NOTES.length);
    expect(container.querySelector('.article__kicker')?.textContent).toMatch(FIRST);
    expect(screen.getByRole('img', { name: `${RIDGE?.title}, drawn live` })).toBeTruthy();
    expect(container.querySelectorAll('.article__formula .katex-display')).toHaveLength(CANVAS_NOTES.length);
  });

  it('opens the studio', () => {
    const onOpenStudio = vi.fn();
    render(<Article onOpenStudio={onOpenStudio} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open the synth studio' }));
    expect(onOpenStudio).toHaveBeenCalled();
  });

  it('shows a formula part tip while the pointer is on its glyphs', () => {
    render(<Article onOpenStudio={vi.fn()} />);
    const part = stftPart();
    fireEvent.pointerMove(part, { clientX: 15, clientY: 15 });
    expect(screen.getByText(STFT_TIP)).toBeTruthy();
    expect(part.hasAttribute('data-active')).toBe(true);
    // Moving over the same part keeps the tip where it is.
    fireEvent.pointerMove(part, { clientX: 20, clientY: 20 });
    expect(screen.getAllByText(STFT_TIP)).toHaveLength(1);
    // Off the glyphs, but still inside KaTeX's box.
    fireEvent.pointerMove(part, { clientX: 50, clientY: 50 });
    expect(screen.queryByText(STFT_TIP)).toBeNull();
    expect(part.hasAttribute('data-active')).toBe(false);
  });

  it('shows the tip on a tap, and hides it when the pointer leaves or the page scrolls', () => {
    render(<Article onOpenStudio={vi.fn()} />);
    const part = stftPart();
    fireEvent.pointerUp(part, { clientX: 15, clientY: 15 });
    expect(screen.getByText(STFT_TIP)).toBeTruthy();
    fireEvent.pointerLeave(part.closest('.article__formula') ?? part);
    expect(screen.queryByText(STFT_TIP)).toBeNull();

    fireEvent.pointerUp(part, { clientX: 15, clientY: 15 });
    act(() => {
      globalThis.dispatchEvent(new Event('scroll'));
    });
    expect(screen.queryByText(STFT_TIP)).toBeNull();
  });

  it('shows no tip off the marked parts', () => {
    const { container } = render(<Article onOpenStudio={vi.fn()} />);
    const formula = container.querySelector('.article__formula');
    if (formula) {
      fireEvent.pointerMove(formula, { clientX: 15, clientY: 15 });
    }
    expect(document.querySelector('.article__marker')).toBeNull();
  });

  it('plays the beat silently, and feeds the canvases once audio is allowed', async () => {
    const { unmount } = render(<Article onOpenStudio={vi.fn()} />);
    const [synth] = engine.instances;
    expect(synth?.silent).toBe(true);
    expect(synth?.loadPatch).toHaveBeenCalledWith(expect.objectContaining({ bpm: 64 }));
    // The browser has not let audio start yet, so the stand-in tone runs.
    await act(async () => {
      await Promise.resolve();
    });
    expect(synth?.start).not.toHaveBeenCalled();
    nextFrame();

    if (synth) {
      synth.isRunning = true;
    }
    await act(async () => {
      fireEvent.pointerDown(document.body);
      await Promise.resolve();
    });
    expect(synth?.start).toHaveBeenCalledTimes(1);
    // A second gesture does not start it twice.
    await act(async () => {
      fireEvent.keyDown(document.body);
      await Promise.resolve();
    });
    expect(synth?.start).toHaveBeenCalledTimes(1);
    nextFrame();
    expect(frames).toHaveLength(1);

    unmount();
    expect(synth?.dispose).toHaveBeenCalled();
  });
});
