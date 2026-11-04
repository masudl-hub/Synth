import React from 'react';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Text } from '@astryxdesign/core/Text';
import { IconTrash } from '@tabler/icons-react';
import { SynthPatch } from '../types';

export interface LibraryEntry {
  patch: SynthPatch;
  /** Index into the saved list, or null for a built-in preset. */
  savedIndex: number | null;
}

interface LibraryProps {
  entries: LibraryEntry[];
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
};

/** Patches as colourful cards: a live-drawn waveform, name, and loop length. */
export const Library: React.FC<LibraryProps> = ({ entries, onLoad, onDelete }) => (
  <div className="library" role="list" aria-label="Patch library">
    {entries.map(({ patch, savedIndex }, i) => {
      const osc = patch.oscillator.type;
      return (
        <div
          key={`${patch.name}-${i}`}
          role="listitem"
          className="library__item"
          style={{ ['--i' as string]: i }}
        >
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
              <span className="library__chip">{patch.totalSteps ?? 32} steps</span>
              {savedIndex !== null && <span className="library__chip library__chip--mine">saved</span>}
            </span>
          </button>
          {savedIndex !== null && (
            <span className="library__delete">
              <IconButton label={`Delete ${patch.name}`} size="sm" variant="ghost" icon={<IconTrash />}
                onClick={() => onDelete(savedIndex)} />
            </span>
          )}
        </div>
      );
    })}
  </div>
);
