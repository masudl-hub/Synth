import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { HStack } from '@astryxdesign/core/HStack';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Selector } from '@astryxdesign/core/Selector';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { Token } from '@astryxdesign/core/Token';
import { VStack } from '@astryxdesign/core/VStack';
import { attachmentIssueText } from '@theoremjs/agents';
import { createHttpTransport } from '@theoremjs/react/client';
import { useTheoremChat, useTheoremInterface } from '@theoremjs/react';
import {
  IconArrowUp, IconMetronome, IconMicrophone, IconPaperclip, IconPlayerStopFilled, IconX,
} from '@tabler/icons-react';
import type { SynthPatch } from '../types';
import { withPalette } from '../utils/palette';

const ENDPOINT = '/api/theorem';
const MAX_FILES = 2;

/** A message the user sent that a lost or full thread never answered. */
interface Unsent { text: string; files: File[]; voice: File[]; loop?: string }

/** The host forgot the thread (a restart or deploy clears it) or it ran out of room. */
const isThreadLost = (failure: { error: string; errorInternal?: string } | null) =>
  !!failure && /no longer available|conversation is full|conversation_unknown|session\.full/i.test(`${failure.error} ${failure.errorInternal ?? ''}`);

interface ComposerProps {
  currentPatch: SynthPatch | null;
  onPatch: (raw: unknown) => void;
  /** Changes to start a fresh thread (the page's reset button). */
  thread?: number;
  /** The JSON the model has written so far while a reply streams (empty before the first token); null otherwise. */
  onStream: (draft: string | null) => void;
}

/** The synth profile's composer, on one line, with no transcript: replies land as patches. */
export const Composer: React.FC<ComposerProps> = ({ currentPatch, onPatch, onStream, thread: resetKey = 0 }) => {
  const transport = useMemo(() => createHttpTransport({ endpoint: ENDPOINT }), []);
  const described = useTheoremInterface(transport);
  const [lost, setLost] = useState(0);
  const resume = useRef<Unsent | null>(null);
  // A reset from the page drops any message waiting to be re-sent.
  useEffect(() => { resume.current = null; }, [resetKey]);

  if (described.status === 'error') {
    return <Banner status="error" title={described.failure.error} />;
  }
  if (described.status === 'loading' || described.iface.type === 'live') return null;
  // A new thread is a new chat: the patch rides along as context, so only the talk is dropped.
  return (
    <ComposerBody
      key={`${resetKey}-${lost}`} transport={transport} iface={described.iface}
      currentPatch={currentPatch} onPatch={onPatch} onStream={onStream}
      resume={resume.current}
      onNewThread={(unsent) => { resume.current = unsent ?? null; setLost((n) => n + 1); }}
    />
  );
};

/** Records one voice note; `stop` resolves to the audio as a File. */
function useVoiceNote(onNote: (file: File) => void) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (e) => chunks.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = rec.mimeType || 'audio/webm';
        onNote(new File(chunks.current, `voice-note.${type.includes('mp4') ? 'm4a' : 'webm'}`, { type }));
      };
      rec.start();
      recorder.current = rec;
      setRecording(true);
    } catch {
      setError('Microphone unavailable.');
    }
  };
  const stop = () => {
    recorder.current?.stop();
    setRecording(false);
  };
  return { recording, error, toggle: () => (recording ? stop() : void start()) };
}

const ComposerBody: React.FC<ComposerProps & {
  resume: Unsent | null;
  onNewThread: (unsent?: Unsent) => void;
  transport: ReturnType<typeof createHttpTransport>;
  iface: Parameters<typeof useTheoremChat>[0]['iface'];
}> = ({ transport, iface, currentPatch, onPatch, onStream, resume, onNewThread }) => {
  const chat = useTheoremChat({ transport, iface, context: currentPatch ?? undefined });
  const handled = useRef<unknown>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const voice = useVoiceNote((file) => chat.setPendingVoice([file]));

  // A finished reply carries the patch as its last structured block.
  useEffect(() => {
    const last = [...chat.blocks].reverse().find((b) => b.kind === 'structured');
    if (last && last.kind === 'structured' && last !== handled.current) {
      handled.current = last;
      onPatch(last.value);
    }
  }, [chat.blocks, onPatch]);

  const isStreaming = chat.phase === 'streaming';

  // The last message sent, kept so a lost thread can be replaced and the message sent again.
  const lastSent = useRef<Unsent | null>(null);
  const loopKey = Object.keys(chat.optionChoices?.declared ?? {})[0];
  const loopValue = loopKey ? chat.optionChoices?.values[loopKey] : undefined;
  const loopRef = useRef(loopValue);
  loopRef.current = loopValue;

  // A fresh thread picks up the message the old one dropped, with the same loop length.
  const resumed = useRef(false);
  useEffect(() => {
    if (!resume || resumed.current) return;
    resumed.current = true;
    if (resume.loop && loopKey) chat.optionChoices?.onChange(loopKey, resume.loop);
    lastSent.current = resume;
    void chat.sendText(withPalette(resume.text, resume.files.length + resume.voice.length > 0), { files: resume.files, voice: resume.voice });
  }, [resume, loopKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isThreadLost(chat.failure) && lastSent.current) onNewThread(lastSent.current);
  }, [chat.failure]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show what the model is writing while it writes.
  const draft = useMemo(() => {
    const live = [...chat.streamBlocks].reverse().find((b) => b.kind === 'structured');
    return live && live.kind === 'structured' ? live.draft ?? '' : '';
  }, [chat.streamBlocks]);
  useEffect(() => { onStream(isStreaming ? draft : null); }, [isStreaming, draft, onStream]);
  useEffect(() => () => onStream(null), [onStream]);
  const hasContent = chat.draftText.trim().length > 0 || chat.pendingFiles.length > 0 || chat.pendingVoice.length > 0;
  const loop = Object.entries(chat.optionChoices?.declared ?? {})[0] as
    [string, { label?: string; choices: { value: string; description?: string }[] }] | undefined;
  const problems = [
    ...chat.issues.map((i) => attachmentIssueText(i, chat.iface?.labels)),
    ...(chat.failure && !isThreadLost(chat.failure) ? [chat.failure.error] : []),
    ...(voice.error ? [voice.error] : []),
  ];

  const send = () => {
    if (!hasContent || isStreaming) return;
    const sent = { text: chat.draftText, files: chat.pendingFiles, voice: chat.pendingVoice, loop: loopRef.current };
    lastSent.current = sent;
    // The draft goes out with a random palette hint, so open requests don't all land on the same sound.
    chat.setDraftText('');
    chat.setPendingFiles([]);
    chat.setPendingVoice([]);
    void chat.sendText(withPalette(sent.text, sent.files.length + sent.voice.length > 0), { files: sent.files, voice: sent.voice });
  };

  // Grow with the text; CSS caps the height to the gap above the dock, then it scrolls.
  const textRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [chat.draftText]);

  // Enter sends; Shift+Enter starts a new line.
  const sendRef = useRef(send);
  sendRef.current = send;
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        sendRef.current();
      }
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, []);

  const hasTray = chat.pendingFiles.length > 0 || chat.pendingVoice.length > 0;

  return (
    <>
      {/* Above the composer and centered; it hangs off the top edge, so it never moves the page. */}
      {problems.length > 0 && (
        <VStack gap={0.5} align="center" className="composer__notice" role="alert">
          {problems.map((message) => (
            <Text key={message} type="supporting" size="xsm" align="center" maxLines={2} color="inherit"
              style={{ color: 'var(--color-text-error)' }}>{message}</Text>
          ))}
        </VStack>
      )}
    <VStack gap={2} width="100%" className="composer">
      {hasTray && (
        <HStack gap={2} align="center" className="composer__tray">
          {chat.pendingFiles.map((file, i) => (
            <Thumbnail key={`${file.name}-${i}`} file={file}
              onRemove={() => chat.setPendingFiles((prev) => prev.filter((_, j) => j !== i))} />
          ))}
          {chat.pendingVoice.map((file) => (
            <Token key={file.name} size="sm" label="Voice note" icon={<IconMicrophone size={12} />}
              onRemove={() => chat.setPendingVoice([])} />
          ))}
        </HStack>
      )}

      <HStack gap={1} align="center" width="100%" className="composer__row">
        <input
          ref={fileInput} type="file" multiple accept="image/*" hidden
          onChange={(e) => {
            const picked: File[] = Array.from(e.target.files ?? []);
            chat.setPendingFiles((prev) => [...prev, ...picked].slice(0, MAX_FILES) as File[]);
            chat.setIssues([]);
            e.target.value = '';
          }}
        />
        <IconButton label="Attach image" variant="ghost" icon={<IconPaperclip />}
          isDisabled={isStreaming} onClick={() => fileInput.current?.click()} />

        {loop && (
          <Selector
            label={loop[1].label ?? 'Loop length'} isLabelHidden variant="ghost" placement="above"
            startIcon={<IconMetronome size={14} />}
            isDisabled={isStreaming} containerStyle={{ flex: 'none' }}
            value={chat.optionChoices?.values[loop[0]] ?? ''}
            options={[{
              type: 'section',
              title: 'Loop length',
              options: loop[1].choices.map((c) => ({ value: c.value, label: `${Number(c.value) / 16} bars`, description: c.description })),
            }]}
            onChange={(value) => chat.optionChoices?.onChange(loop[0], value)}
          />
        )}

        <TextArea
          ref={textRef} rows={1}
          label="Describe a sound" isLabelHidden width="100%"
          placeholder={currentPatch ? 'Describe a sound, or refine this patch' : 'Describe a sound'}
          value={chat.draftText} onChange={chat.setDraftText} enterKeyHint="send"
          containerStyle={{ flex: 1, minWidth: 0 }}
          controlClassName="composer__input"
        />

        {isStreaming ? (
          <IconButton label="Stop" variant="primary" icon={<IconPlayerStopFilled />} onClick={chat.handleStop} />
        ) : hasContent ? (
          <IconButton label="Send" variant="primary" icon={<IconArrowUp />} onClick={send} />
        ) : (
          <IconButton label={voice.recording ? 'Stop recording' : 'Record voice'}
            variant={voice.recording ? 'destructive' : 'ghost'}
            icon={voice.recording ? <IconPlayerStopFilled /> : <IconMicrophone />} onClick={voice.toggle} />
        )}
      </HStack>
    </VStack>
    </>
  );
};

/** A staged image, shown as itself, with a remove button. */
const Thumbnail: React.FC<{ file: File; onRemove: () => void }> = ({ file, onRemove }) => {
  // Made in the effect, so StrictMode's re-run can't leave a revoked URL behind.
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return (
    <span className="composer__thumb">
      {url && <img src={url} alt={file.name} />}
      <IconButton label={`Remove ${file.name}`} size="sm" variant="secondary" icon={<IconX />} onClick={onRemove} />
    </span>
  );
};
