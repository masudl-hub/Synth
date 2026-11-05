import React from 'react';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Text } from '@astryxdesign/core/Text';
import { Tooltip } from '@astryxdesign/core/Tooltip';
import { IconCheck, IconPlus, IconTrash } from '@tabler/icons-react';
import { SynthPatch } from '../types';

export interface LibraryEntry {
  patch: SynthPatch;
  /** Index into the saved list, or null for a built-in preset. */
  savedIndex: number | null;
}

interface LibraryProps {
  entries: LibraryEntry[];
  /** The patch the save card would add, or null when nothing is loaded. */
  currentPatch: SynthPatch | null;
  /** True when the current patch is already one of the entries. */
  isCurrentSaved: boolean;
  onSave: () => void;
  onLoad: (patch: SynthPatch) => void;
  onDelete: (savedIndex: number) => void;
}

type Osc = SynthPatch['oscillator']['type'];

/** Two periods of each waveform, built from exact points so the shapes read cleanly. */
const WAVES: Record<Osc, string> = {
  sine: Array.from({ length: 81 }, (_, i) =>
    `${i ? 'L' : 'M'}${(i * 1.5).toFixed(1)} ${(20 - 13 * Math.sin((i / 40) * 2 * Math.PI)).toFixed(2)}`).join(' '),
  square: 'M0 20 V7 H30 V33 H60 V7 H90 V33 H120 V20',
  sawtooth: 'M0 20 L15 7 V33 L45 7 V33 L75 7 V33 L105 7 V33 L120 20',
  triangle: 'M0 20 L15 7 L45 33 L75 7 L105 33 L120 20',
  pulse: 'M0 33 V7 H15 V33 H60 V7 H75 V33 H120',
  organ: Array.from({ length: 81 }, (_, i) => { const t = (i / 40) * 2 * Math.PI; return `${i ? 'L' : 'M'}${(i * 1.5).toFixed(1)} ${(20 - 8 * (Math.sin(t) + 0.6 * Math.sin(2 * t) + 0.4 * Math.sin(3 * t)) / 1.6).toFixed(2)}`; }).join(' '),
  bell: Array.from({ length: 81 }, (_, i) => { const t = (i / 40) * 2 * Math.PI; return `${i ? 'L' : 'M'}${(i * 1.5).toFixed(1)} ${(20 - 9 * (Math.sin(t) + 0.5 * Math.sin(4 * t)) / 1.5).toFixed(2)}`; }).join(' '),
};

/** Patches as colourful cards: a live-drawn waveform, name, and loop length. */
/** Steps are sixteenth notes, so sixteen make a bar. */
const barsLabel = (steps: number) => {
  const bars = Math.round((steps / 16) * 10) / 10;
  return `${bars} ${bars === 1 ? 'bar' : 'bars'}`;
};

export const Library: React.FC<LibraryProps> = ({ entries, currentPatch, isCurrentSaved, onSave, onLoad, onDelete }) => (
  <div className="library" role="list" aria-label="Patch library">
    <div role="listitem" className="library__item" style={{ ['--i' as string]: 0 }}>
      <Tooltip content={isCurrentSaved ? 'This patch is already in your library' : 'Save the patch that is playing to your library'}>
      <button
        className="library__card library__card--save"
        onClick={onSave}
        disabled={!currentPatch || isCurrentSaved}
      >
        <span className="library__save-icon" aria-hidden>
          {isCurrentSaved ? <IconCheck size={20} /> : <IconPlus size={20} />}
        </span>
        <span className="library__name">
          <Text type="label" maxLines={1}>{isCurrentSaved ? 'Saved' : 'Save current patch'}</Text>
        </span>
        <span className="library__chips">
          <span className="library__chip">{currentPatch?.name ?? 'No patch loaded'}</span>
        </span>
      </button>
      </Tooltip>
    </div>
    {entries.map(({ patch, savedIndex }, i) => {
      const osc = patch.oscillator.type;
      return (
        <div
          key={`${patch.name}-${i}`}
          role="listitem"
          className="library__item"
          style={{ ['--i' as string]: i + 1 }}
        >
          <Tooltip content={`Load ${patch.name}`}>
          <button className="library__card" onClick={() => onLoad(patch)}>
            <svg className="library__wave" viewBox="0 0 120 40" preserveAspectRatio="none" aria-hidden>
              <path className="midline" d="M0 20 H120" />
              <path d={WAVES[osc] ?? WAVES.sine} />
            </svg>
            <span className="library__name">
              <Text type="label" maxLines={1}>{patch.name}</Text>
            </span>
            <span className="library__chips">
              <span className="library__chip">{osc}</span>
              <span className="library__chip">{barsLabel(patch.totalSteps ?? 32)}</span>
              {savedIndex !== null && <span className="library__chip library__chip--mine">saved</span>}
            </span>
          </button>
          </Tooltip>
          {savedIndex !== null && (
            <span className="library__delete">
              <IconButton label={`Delete ${patch.name}`} tooltip="Delete from your library" size="sm" variant="ghost" icon={<IconTrash />}
                onClick={() => onDelete(savedIndex)} />
            </span>
          )}
        </div>
      );
    })}
  </div>
);
