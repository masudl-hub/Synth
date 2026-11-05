import React, { useEffect, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { HStack } from '@astryxdesign/core/HStack';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Slider } from '@astryxdesign/core/Slider';
import { Text } from '@astryxdesign/core/Text';
import { ToggleButton } from '@astryxdesign/core/ToggleButton';
import { Tooltip } from '@astryxdesign/core/Tooltip';
import { VStack } from '@astryxdesign/core/VStack';
import { IconActivity, IconBell, IconBooks, IconCode, IconPiano, IconPlayerPause, IconPlayerPlay, IconTriangle, IconWaveSawTool, IconWaveSine, IconWaveSquare } from '@tabler/icons-react';
import { JsonEditor } from './JsonEditor';
import { PARAM_DOCS } from './paramDocs';
import { SynthPatch } from '../types';

interface ControlStripProps {
  currentPatch: SynthPatch | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
  bpm: number; updateBpm: (v: number) => void;
  volume: number; updateVolume: (v: number) => void;
  filterFreq: number; updateFilter: (v: number) => void;
  onCycleOscillator: (type: OscillatorShape) => void;
  onOpenLibrary: () => void;
  onUpdatePatch: (patch: SynthPatch, playOnLoad: boolean) => void;
  /** Keeps the strip's space while hidden, so the page never moves. */
  isHidden?: boolean;
  /** Changes when a new patch arrives; the strip eases in again. */
  arrival?: number;
}

// The wave shapes in the order the button steps through them; its icon is the shape it's on.
type OscillatorShape = SynthPatch['oscillator']['type'];
const SHAPES: { type: OscillatorShape; icon: React.ReactElement }[] = [
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
const shorten = (text: string) => {
  if (text.length <= DESCRIPTION_MAX) return text;
  const cut = text.slice(0, DESCRIPTION_MAX + 1);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:\s]+$/, '')}…`;
};

// The filter cutoff sweeps by octaves, so the slider works on a log scale.
const FILTER_MIN = 20;
const FILTER_MAX = 20000;
const toLog = (hz: number) => Math.log(hz / FILTER_MIN) / Math.log(FILTER_MAX / FILTER_MIN);
const fromLog = (t: number) => FILTER_MIN * Math.pow(FILTER_MAX / FILTER_MIN, t);

export const ControlStrip: React.FC<ControlStripProps> = ({
  currentPatch, isPlaying, onTogglePlay,
  bpm, updateBpm, volume, updateVolume, filterFreq, updateFilter, onCycleOscillator, onOpenLibrary, onUpdatePatch, isHidden = false, arrival = 0,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [jsonCode, setJsonCode] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  useEffect(() => {
    if (isEditing && currentPatch) {
      setJsonCode(JSON.stringify(currentPatch, null, 2));
      setJsonError(null);
    }
  }, [isEditing, currentPatch]);

  const applyEdit = () => {
    try {
      const withoutComments = jsonCode.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      onUpdatePatch(JSON.parse(withoutComments), isPlaying);
      setIsEditing(false);
    } catch (e) {
      setJsonError(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const cap = (word: string) => word[0].toUpperCase() + word.slice(1);
  const current = currentPatch?.oscillator.type ?? 'sine';
  const next = SHAPES[(SHAPES.findIndex((s) => s.type === current) + 1) % SHAPES.length];

  const description = currentPatch?.description ?? '';
  const shortDescription = shorten(description);

  return (
    <>
      {/* Two fixed rows: what's playing, then how it sounds. The description is one truncated line,
          so the strip's height never depends on the patch. */}
      <VStack gap={3} align="center" className={isHidden ? 'strip strip--hidden' : 'strip'}>
        <HStack key={`now-${arrival}`} gap={3} align="center" className={arrival ? 'strip__now strip__arrive' : 'strip__now'}>
          <IconButton
            label={isPlaying ? 'Pause' : 'Play'}
            tooltip={isPlaying ? 'Pause' : 'Play'}
            variant="primary"
            icon={isPlaying ? <IconPlayerPause /> : <IconPlayerPlay />}
            isDisabled={!currentPatch}
            onClick={onTogglePlay}
          />
          <VStack gap={0} className="strip__name">
            <Text type="label" maxLines={1}>{currentPatch?.name ?? 'No patch'}</Text>
            {description.length > shortDescription.length - 1 && shortDescription.endsWith('…') ? (
              <Tooltip content={description}>
                <Text type="supporting" size="xsm" maxLines={1}>{shortDescription}</Text>
              </Tooltip>
            ) : (
              <Text type="supporting" size="xsm" maxLines={1}>{shortDescription}</Text>
            )}
          </VStack>
        </HStack>
        <HStack key={`controls-${arrival}`} gap={4} align="center" className={arrival ? 'strip__controls strip__arrive strip__arrive--late' : 'strip__controls'}>
          <HStack gap={4} align="center" className="strip__sliders">
            <ToggleButton
              label={`Oscillator wave, currently ${current}`}
              tooltip={`${cap(current)} · click for ${next.type}`}
              variant="ghost"
              isIconOnly
              icon={SHAPES.find((s) => s.type === current)?.icon ?? SHAPES[0].icon}
              isPressed={false}
              isDisabled={!currentPatch}
              onPressedChange={() => onCycleOscillator(next.type)}
            />
            <HStack gap={2} align="center" className="strip__slider">
              <Text type="supporting" size="xsm">BPM</Text>
              <Slider label="BPM" isLabelHidden containerClassName="strip__field" min={40} max={240} value={bpm} onChange={updateBpm} />
            </HStack>
            <HStack gap={2} align="center" className="strip__slider">
              <Text type="supporting" size="xsm">Volume</Text>
              <Slider label="Volume" isLabelHidden containerClassName="strip__field" min={0} max={1} step={0.01} value={volume}
                onChange={updateVolume} formatValue={(v) => `${Math.round(v * 100)}%`} />
            </HStack>
            <HStack gap={2} align="center" className="strip__slider">
              <Text type="supporting" size="xsm">Filter</Text>
              <Slider label="Filter" isLabelHidden containerClassName="strip__field" min={0} max={1} step={0.005} value={Math.min(1, Math.max(0, toLog(filterFreq)))}
                onChange={(t) => updateFilter(Math.round(fromLog(t)))}
                formatValue={(t) => `${Math.round(fromLog(t))} Hz`} />
            </HStack>
          </HStack>
          <HStack gap={1} align="center">
            <IconButton label="Edit patch JSON" tooltip="Edit patch JSON" variant="ghost" icon={<IconCode />}
              isDisabled={!currentPatch} onClick={() => setIsEditing(true)} />
            <IconButton label="Library" tooltip="Library" variant="ghost" icon={<IconBooks />} onClick={onOpenLibrary} />
          </HStack>
        </HStack>
      </VStack>

      <Dialog isOpen={isEditing} onOpenChange={setIsEditing} width="min(50rem, 94vw)" purpose="form">
        <DialogHeader title="Patch source" onOpenChange={setIsEditing} />
        <HStack gap={4} align="start" padding={4} wrap="wrap" className="patch-editor">
          <VStack gap={2} className="patch-editor__source">
            <JsonEditor label="Patch JSON" value={jsonCode} onChange={setJsonCode} />
            {jsonError && <Text type="supporting" size="xsm" style={{ color: 'var(--color-text-error)' }}>{jsonError}</Text>}
            <HStack gap={2} justify="end">
              <Button label="Cancel" tooltip="Close without changing the patch" variant="ghost" onClick={() => setIsEditing(false)} />
              <Button label="Apply" tooltip="Play this patch" variant="primary" onClick={applyEdit} />
            </HStack>
          </VStack>
          <VStack gap={3} isScrollable className="patch-editor__docs">
            {PARAM_DOCS.map((section) => (
              <VStack key={section.section} gap={2}>
                <Text type="label">{section.section}</Text>
                {section.items.map((item) => (
                  <VStack key={item.key} gap={0.5}>
                    <Text type="label">{item.key}</Text>
                    <Text type="supporting" size="xsm">{item.desc}</Text>
                  </VStack>
                ))}
              </VStack>
            ))}
          </VStack>
        </HStack>
      </Dialog>
    </>
  );
};
