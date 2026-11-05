import { Banner } from '@astryxdesign/core/Banner';
import { HStack } from '@astryxdesign/core/HStack';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Selector } from '@astryxdesign/core/Selector';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { Tooltip } from '@astryxdesign/core/Tooltip';
import { VStack } from '@astryxdesign/core/VStack';
import {
  IconArrowUp,
  IconMetronome,
  IconMicrophone,
  IconPaperclip,
  IconPlayerStopFilled,
  IconX,
} from '@tabler/icons-react';
import { attachmentIssueText } from '@theoremjs/agents';
import { useTheoremChat, useTheoremInterface } from '@theoremjs/react';
import { createHttpTransport } from '@theoremjs/react/client';
import type React from 'react';
import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { SynthPatch } from '../types.ts';
import { withPalette } from '../utils/palette.ts';

const ENDPOINT = '/api/theorem';
const MAX_FILES = 2;

/** A message the user sent that a lost or full thread never answered. */
interface Unsent {
  text: string;
  files: File[];
  voice: File[];
  loop?: string;
}

const THREAD_LOST = /no longer available|conversation is full|conversation_unknown|session\.full/iu;

/** The host forgot the thread (a restart or deploy clears it) or it ran out of room. */
const isThreadLost = (failure: { error: string; errorInternal?: string } | null) =>
  !!failure && THREAD_LOST.test(`${failure.error} ${failure.errorInternal ?? ''}`);

/** Sends a message with a random palette hint, so open requests don't all land on the same sound. */
const sendWithPalette = (chat: Chat, message: Unsent) =>
  chat.sendText(withPalette(message.text, message.files.length + message.voice.length > 0), {
    files: message.files,
    voice: message.voice,
  });

// Files have no id, so each staged one is given a key the first time it is drawn.
const fileKeys = new WeakMap<File, number>();
let nextFileKey = 0;
const keyOf = (file: File) => {
  let key = fileKeys.get(file);
  if (key === undefined) {
    key = nextFileKey++;
    fileKeys.set(file, key);
  }
  return key;
};

export interface ComposerProps {
  currentPatch: SynthPatch | null;
  onPatch: (raw: unknown) => void;
  /** Changes to start a fresh thread (the page's reset button). */
  thread?: number;
  /** Switches to ambient sound mode, where the microphone drives the visuals. */
  onListen: () => void;
  /** The JSON the model has written so far while a reply streams (empty before the first token); null otherwise. */
  onStream: (draft: string | null) => void;
}

/** The synth profile's composer, on one line, with no transcript: replies land as patches. */
export const Composer: React.FC<ComposerProps> = ({
  currentPatch,
  onPatch,
  onStream,
  onListen,
  thread: resetKey = 0,
}) => {
  const transport = useMemo(() => createHttpTransport({ endpoint: ENDPOINT }), []);
  const described = useTheoremInterface(transport);
  const [lost, setLost] = useState(0);
  // The message waiting to be re-sent, with the thread it was lost in: a reset from the page drops it.
  const resume = useRef<{ thread: number; unsent: Unsent } | null>(null);
  const onNewThread = useCallback(
    (unsent?: Unsent) => {
      resume.current = unsent ? { thread: resetKey, unsent } : null;
      setLost((n) => n + 1);
    },
    [resetKey],
  );

  if (described.status === 'error') {
    return <Banner status="error" title={described.failure.error} />;
  }
  if (described.status === 'loading' || described.iface.type === 'live') {
    return null;
  }
  // A new thread is a new chat: the patch rides along as context, so only the talk is dropped.
  return (
    <ComposerBody
      key={`${resetKey}-${lost}`}
      transport={transport}
      iface={described.iface}
      currentPatch={currentPatch}
      onPatch={onPatch}
      onStream={onStream}
      onListen={onListen}
      resume={resume.current?.thread === resetKey ? resume.current.unsent : null}
      onNewThread={onNewThread}
    />
  );
};

type Chat = ReturnType<typeof useTheoremChat>;
type LoopOption = [string, { label?: string; choices: { value: string; description?: string }[] }];

/** The loop-length option the profile declares, if it declares one. */
const loopOf = (chat: Chat) => Object.entries(chat.optionChoices?.declared ?? {})[0] as LoopOption | undefined;

/** Hands each finished patch up once, and streams the one being written. */
const usePatchReplies = (chat: Chat, onPatch: ComposerProps['onPatch'], onStream: ComposerProps['onStream']) => {
  const handled = useRef<unknown>(null);
  // A finished reply carries the patch as its last structured block.
  useEffect(() => {
    const last = [...chat.blocks].reverse().find((b) => b.kind === 'structured');
    if (last && last.kind === 'structured' && last !== handled.current) {
      handled.current = last;
      onPatch(last.value);
    }
  }, [chat.blocks, onPatch]);

  // Show what the model is writing while it writes.
  const isStreaming = chat.phase === 'streaming';
  const draft = useMemo(() => {
    const live = [...chat.streamBlocks].reverse().find((b) => b.kind === 'structured');
    return live && live.kind === 'structured' ? (live.draft ?? '') : '';
  }, [chat.streamBlocks]);
  useEffect(() => {
    onStream(isStreaming ? draft : null);
  }, [isStreaming, draft, onStream]);
  useEffect(() => () => onStream(null), [onStream]);
};

/**
 * Keeps the last message sent, so a lost thread can be replaced and the message sent again; a fresh thread picks up
 * the message the old one dropped, with the same loop length.
 */
const useResend = (chat: Chat, resume: Unsent | null, onNewThread: (unsent?: Unsent) => void) => {
  const lastSent = useRef<Unsent | null>(null);
  const loopKey = Object.keys(chat.optionChoices?.declared ?? {})[0];

  const resendOnce = useEffectEvent((message: Unsent) => {
    if (message.loop && loopKey) {
      chat.controller.pickOption(loopKey, message.loop);
    }
    lastSent.current = message;
    sendWithPalette(chat, message);
  });
  const resumed = useRef(false);
  useEffect(() => {
    if (!resume || resumed.current) {
      return;
    }
    resumed.current = true;
    resendOnce(resume);
  }, [resume]);

  useEffect(() => {
    if (isThreadLost(chat.failure) && lastSent.current) {
      onNewThread(lastSent.current);
    }
  }, [chat.failure, onNewThread]);

  return lastSent;
};

/** Grows the textarea with its text; CSS caps the height to the gap above the dock, then it scrolls. Enter sends. */
const useDraftBox = (send: () => void) => {
  const textRef = useRef<HTMLTextAreaElement>(null);
  // Measured after every render, but only when the text on screen has changed since the last measure.
  const fitted = useRef<string | null>(null);
  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el || el.value === fitted.current) {
      return;
    }
    fitted.current = el.value;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  });

  // Enter sends; Shift+Enter starts a new line.
  const sendRef = useRef(send);
  sendRef.current = send;
  useEffect(() => {
    const el = textRef.current;
    if (!el) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        sendRef.current();
      }
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, []);
  return textRef;
};

const ComposerBody: React.FC<
  ComposerProps & {
    resume: Unsent | null;
    onNewThread: (unsent?: Unsent) => void;
    transport: ReturnType<typeof createHttpTransport>;
    iface: Parameters<typeof useTheoremChat>[0]['iface'];
  }
> = ({ transport, iface, currentPatch, onPatch, onStream, onListen, resume, onNewThread }) => {
  const chat = useTheoremChat({ transport, iface, context: currentPatch ?? undefined });
  usePatchReplies(chat, onPatch, onStream);
  const lastSent = useResend(chat, resume, onNewThread);

  const isStreaming = chat.phase === 'streaming';
  const loop = loopOf(chat);
  const loopValue = loop ? chat.optionChoices?.values[loop[0]] : undefined;
  const hasContent = chat.draftText.trim().length > 0 || chat.pendingFiles.length > 0 || chat.pendingVoice.length > 0;
  const problems = [
    ...chat.issues.map((i) => attachmentIssueText(i, chat.iface?.labels)),
    ...(chat.failure && !isThreadLost(chat.failure) ? [chat.failure.error] : []),
  ];

  const send = () => {
    if (!hasContent || isStreaming) {
      return;
    }
    const sent = { text: chat.draftText, files: chat.pendingFiles, voice: chat.pendingVoice, loop: loopValue };
    lastSent.current = sent;
    chat.setDraftText('');
    chat.setPendingFiles([]);
    chat.setPendingVoice([]);
    sendWithPalette(chat, sent);
  };
  const textRef = useDraftBox(send);

  return (
    <>
      {/* Above the composer and centered; it hangs off the top edge, so it never moves the page. */}
      {problems.length > 0 ? <Notices problems={problems} /> : null}
      <VStack gap={2} width="100%" className="composer">
        {chat.pendingFiles.length > 0 ? <Tray files={chat.pendingFiles} setFiles={chat.setPendingFiles} /> : null}

        <HStack gap={1} align="center" width="100%" className="composer__row">
          <Attach isDisabled={isStreaming} setFiles={chat.setPendingFiles} setIssues={chat.setIssues} />
          {loop ? (
            <LoopLength
              loop={loop}
              value={loopValue ?? ''}
              isDisabled={isStreaming}
              onChange={chat.optionChoices?.onChange}
            />
          ) : null}

          <TextArea
            ref={textRef}
            rows={1}
            label="Describe a sound"
            isLabelHidden={true}
            width="100%"
            placeholder={currentPatch ? 'Describe a sound, or refine this patch' : 'Describe a sound'}
            value={chat.draftText}
            onChange={chat.setDraftText}
            enterKeyHint="send"
            containerStyle={{ flex: 1, minWidth: 0 }}
            controlClassName="composer__input"
          />

          <SendButton
            isStreaming={isStreaming}
            hasContent={hasContent}
            onStop={chat.handleStop}
            onSend={send}
            onListen={onListen}
          />
        </HStack>
      </VStack>
    </>
  );
};

const Notices: React.FC<{ problems: string[] }> = ({ problems }) => (
  <VStack gap={0.5} align="center" className="composer__notice" role="alert">
    {problems.map((message) => (
      <Text
        key={message}
        type="supporting"
        size="xsm"
        justify="center"
        maxLines={2}
        color="inherit"
        style={{ color: 'var(--color-text-error)' }}
      >
        {message}
      </Text>
    ))}
  </VStack>
);

type SetFiles = Chat['setPendingFiles'];

/** The staged images, each with its remove button. */
const Tray: React.FC<{ files: File[]; setFiles: SetFiles }> = ({ files, setFiles }) => {
  const remove = useCallback((file: File) => setFiles((prev) => prev.filter((f) => f !== file)), [setFiles]);
  return (
    <HStack gap={2} align="center" className="composer__tray">
      {files.map((file) => (
        <Thumbnail key={keyOf(file)} file={file} onRemove={remove} />
      ))}
    </HStack>
  );
};

/** The paperclip and the hidden file picker it opens. */
const Attach: React.FC<{ isDisabled: boolean; setFiles: SetFiles; setIssues: Chat['setIssues'] }> = ({
  isDisabled,
  setFiles,
  setIssues,
}) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const pick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const picked: File[] = Array.from(e.target.files ?? []);
      setFiles((prev) => [...prev, ...picked].slice(0, MAX_FILES) as File[]);
      setIssues([]);
      e.target.value = '';
    },
    [setFiles, setIssues],
  );
  const open = useCallback(() => fileInput.current?.click(), []);
  return (
    <>
      <input ref={fileInput} type="file" multiple={true} accept="image/*" hidden={true} onChange={pick} />
      <IconButton
        label="Attach image"
        tooltip="Attach an image (up to two)"
        variant="ghost"
        icon={<IconPaperclip />}
        isDisabled={isDisabled}
        onClick={open}
      />
    </>
  );
};

const LoopLength: React.FC<{
  loop: LoopOption;
  value: string;
  isDisabled: boolean;
  onChange: ((name: string, value: string) => void) | undefined;
}> = ({ loop: [name, option], value, isDisabled, onChange }) => {
  const change = useCallback((next: string) => onChange?.(name, next), [onChange, name]);
  const options = useMemo(
    () => [
      {
        type: 'section' as const,
        title: 'Loop length',
        options: option.choices.map((c) => ({
          value: c.value,
          label: `${Number(c.value) / 16} bars`,
          description: c.description,
        })),
      },
    ],
    [option.choices],
  );
  return (
    <Tooltip content="Loop length: how many bars the patch repeats">
      <Selector
        label={option.label ?? 'Loop length'}
        isLabelHidden={true}
        variant="ghost"
        placement="above"
        startIcon={<IconMetronome size={14} />}
        isDisabled={isDisabled}
        containerStyle={{ flex: 'none' }}
        value={value}
        options={options}
        onChange={change}
      />
    </Tooltip>
  );
};

/** Stop while a reply streams, send when there is something to send, and otherwise the way into ambient sound. */
const SendButton: React.FC<{
  isStreaming: boolean;
  hasContent: boolean;
  onStop: () => void;
  onSend: () => void;
  onListen: () => void;
}> = ({ isStreaming, hasContent, onStop, onSend, onListen }) => {
  if (isStreaming) {
    return (
      <IconButton
        label="Stop"
        tooltip="Stop writing"
        variant="primary"
        icon={<IconPlayerStopFilled />}
        onClick={onStop}
      />
    );
  }
  if (hasContent) {
    return <IconButton label="Send" tooltip="Send" variant="primary" icon={<IconArrowUp />} onClick={onSend} />;
  }
  return (
    <IconButton
      label="Ambient sound"
      tooltip="Ambient sound: the visuals react to the sound around you"
      variant="ghost"
      icon={<IconMicrophone />}
      onClick={onListen}
    />
  );
};

/** A staged image, shown as itself, with a remove button. */
const Thumbnail: React.FC<{ file: File; onRemove: (file: File) => void }> = ({ file, onRemove }) => {
  // Made in the effect, so StrictMode's re-run can't leave a revoked URL behind.
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  const remove = useCallback(() => onRemove(file), [onRemove, file]);
  return (
    <span className="composer__thumb">
      {url ? <img src={url} alt={file.name} /> : null}
      <IconButton
        label={`Remove ${file.name}`}
        tooltip="Remove this image"
        size="sm"
        variant="secondary"
        icon={<IconX />}
        onClick={remove}
      />
    </span>
  );
};
