import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Composer, type ComposerProps } from './Composer.tsx';

interface Block {
  kind: string;
  value?: unknown;
  draft?: string;
}

interface FakeChat {
  draftText: string;
  setDraftText: (text: string) => void;
  pendingFiles: File[];
  setPendingFiles: (next: File[] | ((prev: File[]) => File[])) => void;
  pendingVoice: File[];
  setPendingVoice: (next: File[]) => void;
  issues: { code: string }[];
  setIssues: (next: { code: string }[]) => void;
}

/** What the fake chat reports; tests change it and re-render. */
const scenario = vi.hoisted(() => ({
  described: { status: 'ready', iface: { type: 'chat' } } as
    | { status: 'ready'; iface: { type: string } }
    | { status: 'loading' }
    | { status: 'error'; failure: { error: string } },
  phase: 'idle',
  blocks: [] as Block[],
  streamBlocks: [] as Block[],
  failure: null as { error: string; errorInternal?: string } | null,
  declared: undefined as Record<string, { label?: string; choices: { value: string }[] }> | undefined,
  values: {} as Record<string, string>,
  context: undefined as unknown,
  mounts: 0,
  chat: null as FakeChat | null,
  sendText: vi.fn(),
  handleStop: vi.fn(),
  pickOption: vi.fn(),
  onOption: vi.fn(),
}));

vi.mock('@theoremjs/react/client', () => ({ createHttpTransport: () => ({}) }));
vi.mock('@theoremjs/agents', () => ({ attachmentIssueText: (issue: { code: string }) => `Problem: ${issue.code}` }));
vi.mock('@theoremjs/react', async () => {
  const { useState } = await import('react');
  return {
    useTheoremInterface: () => scenario.described,
    useTheoremChat: (options: { context?: unknown }) => {
      // A new chat starts clean: the failure that ended the old one is gone.
      useState(() => {
        scenario.mounts += 1;
        scenario.failure = null;
        return null;
      });
      const [draftText, setDraftText] = useState('');
      const [pendingFiles, setPendingFiles] = useState([] as File[]);
      const [pendingVoice, setPendingVoice] = useState([] as File[]);
      const [issues, setIssues] = useState([] as { code: string }[]);
      scenario.context = options.context;
      const chat = {
        draftText,
        setDraftText,
        pendingFiles,
        setPendingFiles,
        pendingVoice,
        setPendingVoice,
        issues,
        setIssues,
        phase: scenario.phase,
        blocks: scenario.blocks,
        streamBlocks: scenario.streamBlocks,
        failure: scenario.failure,
        optionChoices: scenario.declared
          ? { declared: scenario.declared, values: scenario.values, onChange: scenario.onOption }
          : undefined,
        sendText: scenario.sendText,
        handleStop: scenario.handleStop,
        controller: { pickOption: scenario.pickOption },
        iface: { labels: undefined },
      };
      scenario.chat = chat;
      return chat;
    },
  };
});

const PALETTE = /^make it glassy\n\nPalette hint: /u;
const LOST = 'This conversation is no longer available.';

const props = (extra: Partial<ComposerProps> = {}): ComposerProps => ({
  currentPatch: null,
  onPatch: vi.fn(),
  onStream: vi.fn(),
  onListen: vi.fn(),
  ...extra,
});

const box = () => screen.getByRole('textbox', { name: 'Describe a sound' }) as HTMLTextAreaElement;
const type = (text: string) => fireEvent.change(box(), { target: { value: text } });
const image = (name: string) => new File(['x'], name, { type: 'image/png' });

/** Changes what the chat reports, then draws again. */
const update = (view: ReturnType<typeof render>, next: Partial<typeof scenario>, extra?: Partial<ComposerProps>) => {
  Object.assign(scenario, next);
  view.rerender(<Composer {...props(extra)} />);
};

beforeEach(() => {
  Object.assign(scenario, {
    described: { status: 'ready', iface: { type: 'chat' } },
    phase: 'idle',
    blocks: [],
    streamBlocks: [],
    failure: null,
    declared: undefined,
    values: {},
    mounts: 0,
    chat: null,
  });
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:thumb', revokeObjectURL: vi.fn() }));
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('Composer', () => {
  it('shows the error when the interface cannot be described', () => {
    scenario.described = { status: 'error', failure: { error: 'The composer is down.' } };
    render(<Composer {...props()} />);
    expect(screen.getByText('The composer is down.')).toBeTruthy();
  });

  it('draws nothing while loading, or for a live interface', () => {
    scenario.described = { status: 'loading' };
    const view = render(<Composer {...props()} />);
    expect(view.container.innerHTML).toBe('');
    update(view, { described: { status: 'ready', iface: { type: 'live' } } });
    expect(view.container.innerHTML).toBe('');
  });

  it('offers ambient sound while there is nothing to send', () => {
    const onListen = vi.fn();
    render(<Composer {...props({ onListen })} />);
    expect(box().placeholder).toBe('Describe a sound');
    fireEvent.click(screen.getByRole('button', { name: 'Ambient sound' }));
    expect(onListen).toHaveBeenCalled();
  });

  it('sends the draft with a palette hint, and clears it', () => {
    render(<Composer {...props()} />);
    type('make it glassy');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(scenario.sendText).toHaveBeenCalledWith(expect.stringMatching(PALETTE), { files: [], voice: [] });
    expect(box().value).toBe('');
    expect(screen.getByRole('button', { name: 'Ambient sound' })).toBeTruthy();
  });

  it('sends on Enter, but Shift+Enter and an empty draft do not', () => {
    render(<Composer {...props({ currentPatch: null })} />);
    fireEvent.keyDown(box(), { key: 'Enter' });
    type('make it glassy');
    fireEvent.keyDown(box(), { key: 'Enter', shiftKey: true });
    expect(scenario.sendText).not.toHaveBeenCalled();
    fireEvent.keyDown(box(), { key: 'Enter' });
    expect(scenario.sendText).toHaveBeenCalledTimes(1);
  });

  it('refines the patch that is playing, which rides along as context', () => {
    const patch = { name: 'Glass' } as unknown as ComposerProps['currentPatch'];
    render(<Composer {...props({ currentPatch: patch })} />);
    expect(box().placeholder).toBe('Describe a sound, or refine this patch');
    expect(scenario.context).toBe(patch);
  });
});

describe('Composer attachments and options', () => {
  it('stops a reply while it streams, and will not send meanwhile', () => {
    const view = render(<Composer {...props()} />);
    type('make it glassy');
    update(view, { phase: 'streaming' });
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull();
    fireEvent.keyDown(box(), { key: 'Enter' });
    expect(scenario.sendText).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Attach image' }).getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(scenario.handleStop).toHaveBeenCalled();
  });

  it('stages at most two images, which can be removed, and sends them without a hint', () => {
    const { container } = render(<Composer {...props()} />);
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Attach image' }));
    expect(click).toHaveBeenCalled();

    const input = container.ownerDocument.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) {
      throw new Error('No file input');
    }
    act(() => scenario.chat?.setIssues([{ code: 'too_big' }]));
    expect(screen.getByRole('alert').textContent).toBe('Problem: too_big');
    const files = [image('a.png'), image('b.png'), image('c.png')];
    fireEvent.change(input, { target: { files } });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getAllByRole('img').map((i) => i.getAttribute('alt'))).toEqual(['a.png', 'b.png']);
    expect(screen.getByRole('img', { name: 'a.png' }).getAttribute('src')).toBe('blob:thumb');

    fireEvent.click(screen.getByRole('button', { name: 'Remove a.png' }));
    expect(screen.getAllByRole('img').map((i) => i.getAttribute('alt'))).toEqual(['b.png']);

    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(scenario.sendText).toHaveBeenCalledWith('', { files: [files[1]], voice: [] });
    expect(screen.queryByRole('img')).toBeNull();
    click.mockRestore();
  });

  it('can send a voice note on its own', () => {
    render(<Composer {...props()} />);
    const voice = new File(['x'], 'note.webm', { type: 'audio/webm' });
    act(() => scenario.chat?.setPendingVoice([voice]));
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(scenario.sendText).toHaveBeenCalledWith('', { files: [], voice: [voice] });
  });

  it('picks the loop length the profile declares', () => {
    Object.assign(scenario, {
      declared: { loop: { label: 'Loop length', choices: [{ value: '32' }, { value: '64' }] } },
      values: { loop: '32' },
    });
    render(<Composer {...props()} />);
    const selector = screen.getByRole('combobox', { name: 'Loop length' });
    expect(selector.textContent).toContain('2 bars');
    fireEvent.click(selector);
    fireEvent.click(screen.getByRole('option', { name: '4 bars' }));
    expect(scenario.onOption).toHaveBeenCalledWith('loop', '64');
  });
});

describe('Composer replies and threads', () => {
  it('shows a failed reply, but not a lost thread', () => {
    const view = render(<Composer {...props()} />);
    update(view, { failure: { error: 'The model is busy.' } });
    expect(screen.getByRole('alert').textContent).toBe('The model is busy.');
  });

  it('hands each finished patch up once, and streams the one being written', () => {
    const onPatch = vi.fn();
    const onStream = vi.fn();
    const view = render(<Composer {...props({ onPatch, onStream })} />);
    expect(onStream).toHaveBeenLastCalledWith(null);

    update(view, { phase: 'streaming', streamBlocks: [{ kind: 'text' }] }, { onPatch, onStream });
    expect(onStream).toHaveBeenLastCalledWith('');
    update(
      view,
      { streamBlocks: [{ kind: 'structured', draft: '{"bpm": 9' }, { kind: 'text' }] },
      { onPatch, onStream },
    );
    expect(onStream).toHaveBeenLastCalledWith('{"bpm": 9');
    update(view, { streamBlocks: [{ kind: 'structured' }] }, { onPatch, onStream });
    expect(onStream).toHaveBeenLastCalledWith('');

    const done = { kind: 'structured', value: { bpm: 90 } };
    update(view, { phase: 'idle', streamBlocks: [], blocks: [{ kind: 'text' }, done] }, { onPatch, onStream });
    expect(onStream).toHaveBeenLastCalledWith(null);
    expect(onPatch).toHaveBeenCalledWith({ bpm: 90 });
    update(view, { blocks: [...scenario.blocks] }, { onPatch, onStream });
    expect(onPatch).toHaveBeenCalledTimes(1);

    onStream.mockClear();
    view.unmount();
    expect(onStream).toHaveBeenCalledWith(null);
  });

  it('starts a new thread when the old one is lost, and sends the lost message again', () => {
    Object.assign(scenario, { declared: { loop: { choices: [{ value: '32' }] } }, values: { loop: '32' } });
    const view = render(<Composer {...props()} />);
    type('make it glassy');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(scenario.mounts).toBe(1);

    update(view, { failure: { error: 'Something went wrong.', errorInternal: 'conversation_unknown' } });
    expect(scenario.mounts).toBe(2);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(scenario.pickOption).toHaveBeenCalledWith('loop', '32');
    expect(scenario.sendText).toHaveBeenCalledTimes(2);
    expect(scenario.sendText).toHaveBeenLastCalledWith(expect.stringMatching(PALETTE), { files: [], voice: [] });

    // Drawing again does not send it a third time.
    update(view, {});
    expect(scenario.sendText).toHaveBeenCalledTimes(2);
  });

  it('drops the lost message when the page starts over', () => {
    const view = render(<Composer {...props({ thread: 0 })} />);
    type('make it glassy');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    update(view, { failure: { error: LOST } }, { thread: 0 });
    expect(scenario.sendText).toHaveBeenCalledTimes(2);
    update(view, {}, { thread: 1 });
    expect(scenario.mounts).toBe(3);
    expect(scenario.sendText).toHaveBeenCalledTimes(2);
  });

  it('starts no new thread for a lost thread that was never sent to', () => {
    const view = render(<Composer {...props()} />);
    update(view, { failure: { error: LOST } });
    expect(scenario.mounts).toBe(1);
  });
});
