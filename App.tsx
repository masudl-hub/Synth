import React, { useMemo, useState } from 'react';
import { Theme } from '@astryxdesign/core/theme';
import { HStack } from '@astryxdesign/core/HStack';
import { IconButton } from '@astryxdesign/core/IconButton';
import { ToggleButton } from '@astryxdesign/core/ToggleButton';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { IconBooks, IconMicrophone } from '@tabler/icons-react';
import { themes, defaultThemeSlug } from './astryx-themes';
import { SimCarousel } from './components/SimCarousel';
import { ControlStrip } from './components/ControlStrip';
import { Composer } from './components/Composer';
import { MicPanel } from './components/MicPanel';
import { Library, LibraryEntry } from './components/Library';
import { useGenerativeAudio } from './hooks/useGenerativeAudio';
import { useAudioAnalyzer } from './hooks/useAudioAnalyzer';
import { useDynamicFavicon } from './hooks/useDynamicFavicon';

export default function App() {
  const [audioSource, setAudioSource] = useState<'synth' | 'mic'>('synth');
  const [showLibrary, setShowLibrary] = useState(false);

  const {
    audioDataRef: synthAudioDataRef, loadGenerated, togglePlay, isPlaying, currentPatch,
    bpm, updateBpm, volume, updateVolume, filterFreq, updateFilter,
    savedPatches, saveCurrentPatch, deleteSavedPatch, loadPatch, PRESETS,
  } = useGenerativeAudio();

  const { audioDataRef: micAudioDataRef, startAudio: startMic, isAudioEnabled: isMicLive } = useAudioAnalyzer();

  const activeAudioRef = audioSource === 'synth' ? synthAudioDataRef : micAudioDataRef;
  useDynamicFavicon(activeAudioRef);

  // Synth time only advances while playing; the mic world is always moving.
  const shouldTimeAdvance = audioSource === 'mic' || isPlaying;

  const entries = useMemo<LibraryEntry[]>(() => [
    ...Object.values(PRESETS).map((patch) => ({ patch, savedIndex: null })),
    ...savedPatches.map((patch, i) => ({ patch, savedIndex: i })),
  ], [PRESETS, savedPatches]);

  return (
    <Theme theme={themes[defaultThemeSlug]} mode="dark">
      <main className="app">
        <div className="app__toggle">
          <ToggleButton
            label={audioSource === 'mic' ? 'Back to AI synth' : 'Use the microphone'}
            icon={<IconMicrophone />}
            isIconOnly
            isPressed={audioSource === 'mic'}
            onPressedChange={(on) => setAudioSource(on ? 'mic' : 'synth')}
          />
        </div>
        <VStack gap={0.5} align="center" className="app__header">
          <Text type="large" weight="semibold">cymatics lab</Text>
          <Text type="supporting" size="xsm">Generative Audio Physics</Text>
        </VStack>

        <SimCarousel audioDataRef={activeAudioRef} shouldTimeAdvance={shouldTimeAdvance} resetTrigger={currentPatch} />

        {audioSource === 'synth' ? (
          <ControlStrip
            currentPatch={currentPatch}
            isPlaying={isPlaying}
            onTogglePlay={togglePlay}
            bpm={bpm} updateBpm={updateBpm}
            volume={volume} updateVolume={updateVolume}
            filterFreq={filterFreq} updateFilter={updateFilter}
            onSave={saveCurrentPatch}
            onUpdatePatch={loadPatch}
          />
        ) : <div />}

        <HStack gap={3} align="center" className="dock">
          <div className="dock__main">
            {audioSource === 'mic' ? (
              <MicPanel isLive={isMicLive} onStart={startMic} />
            ) : (
              <Composer currentPatch={currentPatch} onPatch={loadGenerated} />
            )}
          </div>
          {audioSource === 'synth' && (
            <IconButton
              label="Library"
              tooltip="Library"
              variant="ghost"
              icon={<IconBooks />}
              onClick={() => setShowLibrary(true)}
            />
          )}
        </HStack>

        <Dialog isOpen={showLibrary} onOpenChange={setShowLibrary} width="min(48rem, 94vw)">
          <DialogHeader title="Library" onOpenChange={setShowLibrary} />
          <VStack padding={4}>
            <Library
              entries={entries}
              onLoad={(patch) => { loadPatch(patch, true); setShowLibrary(false); }}
              onDelete={deleteSavedPatch}
            />
          </VStack>
        </Dialog>

        <VStack gap={0.5} align="center" className="footer">
          <Text type="supporting" size="2xs">Formes inspirées des 36 formes vectorielles technologiques de Vanzyst | Built on Theorem</Text>
        </VStack>
      </main>
    </Theme>
  );
}
