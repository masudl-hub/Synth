import React, { useEffect, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { HStack } from '@astryxdesign/core/HStack';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Slider } from '@astryxdesign/core/Slider';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { VStack } from '@astryxdesign/core/VStack';
import { IconCheck, IconCode, IconDeviceFloppy, IconPlayerPause, IconPlayerPlay } from '@tabler/icons-react';
import { PARAM_DOCS } from './paramDocs';
import { SynthPatch } from '../types';

interface ControlStripProps {
  currentPatch: SynthPatch | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
  bpm: number; updateBpm: (v: number) => void;
  volume: number; updateVolume: (v: number) => void;
  filterFreq: number; updateFilter: (v: number) => void;
  onSave: () => void;
  onUpdatePatch: (patch: SynthPatch, playOnLoad: boolean) => void;
}

// The filter cutoff sweeps by octaves, so the slider works on a log scale.
const FILTER_MIN = 20;
const FILTER_MAX = 20000;
const toLog = (hz: number) => Math.log(hz / FILTER_MIN) / Math.log(FILTER_MAX / FILTER_MIN);
const fromLog = (t: number) => FILTER_MIN * Math.pow(FILTER_MAX / FILTER_MIN, t);

export const ControlStrip: React.FC<ControlStripProps> = ({
  currentPatch, isPlaying, onTogglePlay,
  bpm, updateBpm, volume, updateVolume, filterFreq, updateFilter, onSave, onUpdatePatch,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [jsonCode, setJsonCode] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (!justSaved) return;
    const id = setTimeout(() => setJustSaved(false), 1500);
    return () => clearTimeout(id);
  }, [justSaved]);

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

  return (
    <>
      <HStack gap={4} align="center" justify="center" className="strip">
        <IconButton
          label={isPlaying ? 'Pause' : 'Play'}
          tooltip={isPlaying ? 'Pause' : 'Play'}
          variant="primary"
          icon={isPlaying ? <IconPlayerPause /> : <IconPlayerPlay />}
          isDisabled={!currentPatch}
          onClick={onTogglePlay}
        />
        <VStack gap={0}>
          <Text type="label" maxLines={1}>{currentPatch?.name ?? 'No patch'}</Text>
          <Text type="supporting" size="xsm" maxLines={1}>{currentPatch?.description ?? ''}</Text>
        </VStack>
        <HStack gap={4} align="center">
          <HStack gap={2} align="center">
            <Text type="supporting" size="xsm">BPM</Text>
            <Slider label="BPM" isLabelHidden width="7rem" min={40} max={240} value={bpm} onChange={updateBpm} />
          </HStack>
          <HStack gap={2} align="center">
            <Text type="supporting" size="xsm">Volume</Text>
            <Slider label="Volume" isLabelHidden width="7rem" min={0} max={1} step={0.01} value={volume}
              onChange={updateVolume} formatValue={(v) => `${Math.round(v * 100)}%`} />
          </HStack>
          <HStack gap={2} align="center">
            <Text type="supporting" size="xsm">Filter</Text>
            <Slider label="Filter" isLabelHidden width="7rem" min={0} max={1} step={0.005} value={toLog(filterFreq)}
              onChange={(t) => updateFilter(Math.round(fromLog(t)))}
              formatValue={(t) => `${Math.round(fromLog(t))} Hz`} />
          </HStack>
        </HStack>
        <IconButton label={justSaved ? 'Saved' : 'Save to library'} tooltip={justSaved ? 'Saved' : 'Save to library'}
          variant="ghost" icon={justSaved ? <IconCheck /> : <IconDeviceFloppy />}
          isDisabled={!currentPatch} onClick={() => { onSave(); setJustSaved(true); }} />
        <IconButton label="Edit patch JSON" tooltip="Edit patch JSON" variant="ghost" icon={<IconCode />}
          isDisabled={!currentPatch} onClick={() => setIsEditing(true)} />
      </HStack>

      <Dialog isOpen={isEditing} onOpenChange={setIsEditing} width="min(72rem, 94vw)" purpose="form">
        <DialogHeader title="Patch source" onOpenChange={setIsEditing} />
        <HStack gap={4} align="start" padding={4}>
          <VStack gap={2} width="100%">
            <TextArea
              label="Patch JSON"
              isLabelHidden
              value={jsonCode}
              onChange={setJsonCode}
              rows={24}
              status={jsonError ? { type: 'error', message: jsonError } : undefined}
            />
            <HStack gap={2} justify="end">
              <Button label="Cancel" variant="ghost" onClick={() => setIsEditing(false)} />
              <Button label="Apply" variant="primary" onClick={applyEdit} />
            </HStack>
          </VStack>
          <VStack gap={3} width="18rem" isScrollable height="60dvh">
            {PARAM_DOCS.map((section) => (
              <VStack key={section.section} gap={2}>
                <Text type="label">{section.section}</Text>
                {section.items.map((item) => (
                  <VStack key={item.key} gap={0.5}>
                    <Text type="code">{item.key}</Text>
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
