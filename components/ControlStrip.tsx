import { Button } from '@astryxdesign/core/Button';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { HStack } from '@astryxdesign/core/HStack';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Slider } from '@astryxdesign/core/Slider';
import { Text } from '@astryxdesign/core/Text';
import { Tooltip } from '@astryxdesign/core/Tooltip';
import { VStack } from '@astryxdesign/core/VStack';
import {
  IconActivity,
  IconBell,
  IconBooks,
  IconCode,
  IconPiano,
  IconPlayerPause,
  IconPlayerPlay,
  IconTriangle,
  IconWaveSawTool,
  IconWaveSine,
  IconWaveSquare,
} from '@tabler/icons-react';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { focusPart } from '../audio/patch.ts';
import type { SynthPatch, WaveShape } from '../types.ts';
import { JsonEditor } from './JsonEditor.tsx';
import { PARAM_DOCS } from './paramDocs.ts';

export interface ControlStripProps {
  currentPatch: SynthPatch | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
  bpm: number;
  updateBpm: (v: number) => void;
  volume: number;
  updateVolume: (v: number) => void;
  filterFreq: number;
  updateFilter: (v: number) => void;
  onCycleOscillator: (type: WaveShape) => void;
  onOpenLibrary: () => void;
  onUpdatePatch: (patch: unknown, playOnLoad: boolean) => void;
  /** Keeps the strip's space while hidden, so the page never moves. */
  isHidden?: boolean;
  /** Changes when a new patch arrives; the strip eases in again. */
  arrival?: number;
}

// The wave shapes in the order the button steps through them; its icon is the shape it's on.
const SHAPES: { type: WaveShape; icon: React.ReactElement }[] = [
  { type: 'sine', icon: <IconWaveSine /> },
  { type: 'triangle', icon: <IconTriangle /> },
  { type: 'sawtooth', icon: <IconWaveSawTool /> },
  { type: 'square', icon: <IconWaveSquare /> },
  { type: 'pulse', icon: <IconActivity /> },
  { type: 'organ', icon: <IconPiano /> },
  { type: 'bell', icon: <IconBell /> },
];

// Descriptions can run long; keep the first ~45 characters, cut on a word, and show the rest on hover.
const DESCRIPTION_MAX = 45;
const TRAILING_PUNCTUATION = /[,;:\s]+$/u;
const shorten = (text: string) => {
  if (text.length <= DESCRIPTION_MAX) {
    return text;
  }
  const cut = text.slice(0, DESCRIPTION_MAX + 1);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(TRAILING_PUNCTUATION, '')}…`;
};

// The filter cutoff sweeps by octaves, so the slider works on a log scale.
const FILTER_MIN = 20;
const FILTER_MAX = 20_000;
const toLog = (hz: number) => Math.log(hz / FILTER_MIN) / Math.log(FILTER_MAX / FILTER_MIN);
const fromLog = (t: number) => FILTER_MIN * (FILTER_MAX / FILTER_MIN) ** t;
const filterPosition = (hz: number) => Math.min(1, Math.max(0, toLog(hz)));
const formatPercent = (v: number) => `${Math.round(v * 100)}%`;
const formatHz = (t: number) => `${Math.round(fromLog(t))} Hz`;

// The editor takes JSON with // and /* */ comments, as the docs beside it are written.
const LINE_COMMENT = /\/\/.*$/gmu;
const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//gu;
const parsePatchSource = (source: string): unknown =>
  JSON.parse(source.replace(LINE_COMMENT, '').replace(BLOCK_COMMENT, ''));

const cap = (word: string) => word[0].toUpperCase() + word.slice(1);

/** What's playing: the play button, the patch name and its description on one truncated line. */
const NowPlaying: React.FC<{
  currentPatch: SynthPatch | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
  arrival: number;
}> = ({ currentPatch, isPlaying, onTogglePlay, arrival }) => {
  const description = currentPatch?.description ?? '';
  const shortDescription = shorten(description);
  return (
    <HStack gap={3} align="center" className={arrival ? 'strip__now strip__arrive' : 'strip__now'}>
      <IconButton
        className="round"
        label={isPlaying ? 'Pause' : 'Play'}
        tooltip={isPlaying ? 'Pause' : 'Play'}
        variant="primary"
        icon={isPlaying ? <IconPlayerPause /> : <IconPlayerPlay />}
        isDisabled={!currentPatch}
        onClick={onTogglePlay}
      />
      <VStack gap={0} className="strip__name">
        <Text type="label" maxLines={1}>
          {currentPatch?.name ?? 'No patch'}
        </Text>
        {description.length > shortDescription.length - 1 && shortDescription.endsWith('…') ? (
          <Tooltip content={description}>
            <Text type="supporting" size="xsm" maxLines={1}>
              {shortDescription}
            </Text>
          </Tooltip>
        ) : (
          <Text type="supporting" size="xsm" maxLines={1}>
            {shortDescription}
          </Text>
        )}
      </VStack>
    </HStack>
  );
};

/** A slider with its name written beside it. */
const LabelledSlider: React.FC<{
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
  formatValue?: (v: number) => string;
}> = ({ label, min, max, step, value, onChange, formatValue }) => (
  <HStack gap={2} align="center" className="strip__slider">
    <Text type="supporting" size="xsm">
      {label}
    </Text>
    <Slider
      label={label}
      isLabelHidden={true}
      containerClassName="strip__field"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={onChange}
      formatValue={formatValue}
    />
  </HStack>
);

/** How it sounds: the wave button and the sliders, then the editor and library buttons. */
const Mixer: React.FC<
  Pick<
    ControlStripProps,
    | 'currentPatch'
    | 'bpm'
    | 'updateBpm'
    | 'volume'
    | 'updateVolume'
    | 'filterFreq'
    | 'updateFilter'
    | 'onCycleOscillator'
    | 'onOpenLibrary'
  > & { arrival: number; onEdit: () => void }
> = ({
  currentPatch,
  bpm,
  updateBpm,
  volume,
  updateVolume,
  filterFreq,
  updateFilter,
  onCycleOscillator,
  onOpenLibrary,
  arrival,
  onEdit,
}) => {
  const current = currentPatch ? currentPatch[focusPart(currentPatch)].oscillator.type : 'sine';
  const next = SHAPES[(SHAPES.findIndex((s) => s.type === current) + 1) % SHAPES.length];
  const cycle = useCallback(() => onCycleOscillator(next.type), [onCycleOscillator, next.type]);
  const setFilter = useCallback((t: number) => updateFilter(Math.round(fromLog(t))), [updateFilter]);
  return (
    <HStack
      gap={4}
      align="center"
      className={arrival ? 'strip__controls strip__arrive strip__arrive--late' : 'strip__controls'}
    >
      <HStack gap={4} align="center" className="strip__sliders">
        <IconButton
          className="round"
          label={`Oscillator wave, currently ${current}`}
          tooltip={`${cap(current)} · click for ${next.type}`}
          variant="ghost"
          icon={SHAPES.find((s) => s.type === current)?.icon ?? SHAPES[0].icon}
          isDisabled={!currentPatch}
          onClick={cycle}
        />
        <LabelledSlider label="BPM" min={40} max={240} value={bpm} onChange={updateBpm} />
        <LabelledSlider
          label="Volume"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={updateVolume}
          formatValue={formatPercent}
        />
        <LabelledSlider
          label="Filter"
          min={0}
          max={1}
          step={0.005}
          value={filterPosition(filterFreq)}
          onChange={setFilter}
          formatValue={formatHz}
        />
      </HStack>
      <HStack gap={1} align="center">
        <IconButton
          className="round"
          label="Edit patch JSON"
          tooltip="Edit patch JSON"
          variant="ghost"
          icon={<IconCode />}
          isDisabled={!currentPatch}
          onClick={onEdit}
        />
        <IconButton
          className="round"
          label="Library"
          tooltip="Library"
          variant="ghost"
          icon={<IconBooks />}
          onClick={onOpenLibrary}
        />
      </HStack>
    </HStack>
  );
};

/** The patch's JSON, editable, beside the docs for every field. */
const PatchEditor: React.FC<{
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  currentPatch: SynthPatch | null;
  isPlaying: boolean;
  onUpdatePatch: ControlStripProps['onUpdatePatch'];
}> = ({ isOpen, onOpenChange, currentPatch, isPlaying, onUpdatePatch }) => {
  const [jsonCode, setJsonCode] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  useEffect(() => {
    if (isOpen && currentPatch) {
      setJsonCode(JSON.stringify(currentPatch, null, 2));
      setJsonError(null);
    }
  }, [isOpen, currentPatch]);

  const applyEdit = useCallback(() => {
    try {
      onUpdatePatch(parsePatchSource(jsonCode), isPlaying);
      onOpenChange(false);
    } catch (e) {
      setJsonError(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [jsonCode, isPlaying, onUpdatePatch, onOpenChange]);
  const cancel = useCallback(() => onOpenChange(false), [onOpenChange]);

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} width="min(50rem, 94vw)" purpose="form">
      <DialogHeader title="Patch source" onOpenChange={onOpenChange} />
      <HStack gap={4} align="start" padding={4} wrap="wrap" className="patch-editor">
        <VStack gap={2} className="patch-editor__source">
          <JsonEditor label="Patch JSON" value={jsonCode} onChange={setJsonCode} />
          {jsonError === null ? null : (
            <Text type="supporting" size="xsm" style={{ color: 'var(--color-text-error)' }}>
              {jsonError}
            </Text>
          )}
          <HStack gap={2} justify="end">
            <Button label="Cancel" tooltip="Close without changing the patch" variant="ghost" onClick={cancel} />
            <Button label="Apply" tooltip="Play this patch" variant="primary" onClick={applyEdit} />
          </HStack>
        </VStack>
        <VStack gap={3} isScrollable={true} className="patch-editor__docs">
          {PARAM_DOCS.map((section) => (
            <VStack key={section.section} gap={2}>
              <Text type="label">{section.section}</Text>
              {section.items.map((item) => (
                <VStack key={item.key} gap={0.5}>
                  <Text type="label">{item.key}</Text>
                  <Text type="supporting" size="xsm">
                    {item.desc}
                  </Text>
                </VStack>
              ))}
            </VStack>
          ))}
        </VStack>
      </HStack>
    </Dialog>
  );
};

export const ControlStrip: React.FC<ControlStripProps> = ({
  currentPatch,
  isPlaying,
  onTogglePlay,
  onUpdatePatch,
  isHidden = false,
  arrival = 0,
  ...mixer
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const edit = useCallback(() => setIsEditing(true), []);

  return (
    <>
      {/* Two fixed rows: what's playing, then how it sounds. The description is one truncated line,
          so the strip's height never depends on the patch. */}
      <VStack gap={3} align="center" className={isHidden ? 'strip strip--hidden' : 'strip'}>
        <NowPlaying
          key={`now-${arrival}`}
          currentPatch={currentPatch}
          isPlaying={isPlaying}
          onTogglePlay={onTogglePlay}
          arrival={arrival}
        />
        <Mixer key={`controls-${arrival}`} currentPatch={currentPatch} arrival={arrival} onEdit={edit} {...mixer} />
      </VStack>

      <PatchEditor
        isOpen={isEditing}
        onOpenChange={setIsEditing}
        currentPatch={currentPatch}
        isPlaying={isPlaying}
        onUpdatePatch={onUpdatePatch}
      />
    </>
  );
};
