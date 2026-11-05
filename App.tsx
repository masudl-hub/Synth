import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Theme } from '@astryxdesign/core/theme';
import { ToggleButton } from '@astryxdesign/core/ToggleButton';
import { Link } from '@astryxdesign/core/Link';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { IconButton } from '@astryxdesign/core/IconButton';
import { HStack } from '@astryxdesign/core/HStack';
import { IconLayoutSidebarLeftCollapse, IconLayoutSidebarRightCollapse, IconRefresh } from '@tabler/icons-react';
import { themes, defaultThemeSlug } from './astryx-themes';
import { SimCarousel } from './components/SimCarousel';
import { simulations } from './simulations/logic';
import { ControlStrip } from './components/ControlStrip';
import { Composer } from './components/Composer';
import { Article } from './components/Article';
import { MicPanel } from './components/MicPanel';
import { Library, LibraryEntry } from './components/Library';
import { StreamReadout } from './components/StreamReadout';
import { useGenerativeAudio } from './hooks/useGenerativeAudio';
import { useAudioAnalyzer } from './hooks/useAudioAnalyzer';
import { useDynamicFavicon } from './hooks/useDynamicFavicon';

// The article lives at its own path.
const ARTICLE_PATH = '/why';
const isArticlePath = () => window.location.pathname.replace(/\/+$/, '') === ARTICLE_PATH;

export default function App() {
  const [audioSource, setAudioSource] = useState<'synth' | 'mic'>('synth');
  const [showArticle, setShowArticle] = useState(isArticlePath);
  // Opens on Swarm, wherever it sits in the loop; kept here so the carousel keeps its place while the article is open.
  const [activeSim, setActiveSim] = useState(() => Math.max(0, simulations.findIndex((sim) => sim.title === 'Swarm')));
  const [showLibrary, setShowLibrary] = useState(false);
  const [stream, setStream] = useState<string | null>(null);
  // Bumped when a generated patch lands, so the controls ease in.
  const [arrival, setArrival] = useState(0);

  const {
    audioDataRef: synthAudioDataRef, loadGenerated, togglePlay, isPlaying, currentPatch,
    bpm, updateBpm, volume, updateVolume, filterFreq, updateFilter, updateOscillator, patchVersion,
    stopPlayback, clearPatch,
    savedPatches, saveCurrentPatch, deleteSavedPatch, loadPatch, PRESETS,
  } = useGenerativeAudio();
  // Bumped by the refresh button; the composer starts a new thread.
  const [thread, setThread] = useState(0);

  const { audioDataRef: micAudioDataRef, startAudio: startMic, stopAudio: stopMic, isAudioEnabled: isMicLive } = useAudioAnalyzer();

  const activeAudioRef = audioSource === 'synth' ? synthAudioDataRef : micAudioDataRef;
  useDynamicFavicon(activeAudioRef);

  // Synth time only advances while playing; the mic world is always moving.
  const shouldTimeAdvance = audioSource === 'mic' || isPlaying;

  const onGenerated = useCallback((raw: unknown) => {
    loadGenerated(raw);
    setArrival((n) => n + 1);
  }, [loadGenerated]);

  // Switching sources stops the music and the mic, but keeps the patch and the thread.
  const listen = (on: boolean) => {
    stopPlayback();
    setAudioSource(on ? 'mic' : 'synth');
    if (on) void startMic(); else stopMic();
    goTo(false);
  };

  // Moves between the app and the article by changing the path, so the article can be linked to and the back button works.
  const goTo = useCallback((article: boolean) => {
    if (article === isArticlePath()) return;
    window.history.pushState(null, '', article ? ARTICLE_PATH : '/');
    setShowArticle(article);
  }, []);
  useEffect(() => {
    const onPop = () => setShowArticle(isArticlePath());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  // The article is for reading: no sound plays, and the mic is off.
  useEffect(() => {
    if (!showArticle) return;
    stopPlayback();
    stopMic();
  }, [showArticle]);

  const startOver = () => {
    clearPatch();
    setStream(null);
    setArrival(0);
    setThread((n) => n + 1);
    goTo(false);
  };

  const entries = useMemo<LibraryEntry[]>(() => [
    ...Object.values(PRESETS).map((patch) => ({ patch, savedIndex: null })),
    ...savedPatches.map((patch, i) => ({ patch, savedIndex: i })),
  ], [PRESETS, savedPatches]);

  const isCurrentSaved = useMemo(() => {
    if (!currentPatch) return false;
    const current = JSON.stringify(currentPatch);
    return entries.some((e) => e.patch === currentPatch || JSON.stringify(e.patch) === current);
  }, [entries, currentPatch]);

  return (
    <Theme theme={themes[defaultThemeSlug]} mode="dark">
      <main className="app">
        <HStack gap={1} align="center" className="app__toggle">
          <IconButton
            label="Start over"
            tooltip="Start over: new thread, and the patch is cleared unless you saved it"
            variant="ghost"
            icon={<IconRefresh />}
            onClick={startOver}
          />
          <ToggleButton
            label="Why this exists"
            tooltip={showArticle ? 'Back to the studio' : 'Why this exists'}
            icon={<IconLayoutSidebarLeftCollapse />}
            pressedIcon={<IconLayoutSidebarRightCollapse />}
            isIconOnly
            isPressed={showArticle}
            onPressedChange={goTo}
          />
        </HStack>
        <VStack gap={0.5} align="center" className="app__header">
          <Text type="large" weight="semibold">cymatics lab</Text>
          <Text type="supporting" size="xsm">Generative Audio Physics</Text>
        </VStack>

        {!showArticle && <SimCarousel active={activeSim} onActiveChange={setActiveSim} audioDataRef={activeAudioRef} shouldTimeAdvance={shouldTimeAdvance} resetTrigger={patchVersion} />}

        <ControlStrip
          arrival={arrival}
          isHidden={audioSource !== 'synth'}
          currentPatch={currentPatch}
          isPlaying={isPlaying}
          onTogglePlay={togglePlay}
          bpm={bpm} updateBpm={updateBpm}
          volume={volume} updateVolume={updateVolume}
          filterFreq={filterFreq} updateFilter={updateFilter}
          onCycleOscillator={updateOscillator}
          onOpenLibrary={() => setShowLibrary(true)}
          onUpdatePatch={loadPatch}
        />

        {/* Fixed height: the composer is pinned to its bottom and grows up into the gap, never pushing the page. */}
        <div className="dock">
          <div className="dock__float">
            {/* Both stay mounted: the composer keeps its thread while the mic is on. */}
            <div hidden={audioSource === 'mic'} className="dock__slot">
              <Composer currentPatch={currentPatch} onPatch={onGenerated} onStream={setStream} onListen={() => listen(true)} thread={thread} />
            </div>
            {audioSource === 'mic' && <MicPanel isLive={isMicLive} onStart={startMic} onBack={() => listen(false)} />}
          </div>
        </div>

        {showArticle && <Article onOpenStudio={() => goTo(false)} />}

        <StreamReadout text={audioSource === 'synth' ? stream : null} />

        <Dialog isOpen={showLibrary} onOpenChange={setShowLibrary} width="min(48rem, 94vw)">
          <DialogHeader title="Library" onOpenChange={setShowLibrary} />
          <VStack padding={4}>
            <Library
              entries={entries}
              currentPatch={currentPatch}
              isCurrentSaved={isCurrentSaved}
              onSave={saveCurrentPatch}
              onLoad={(patch) => { loadPatch(patch, true); setShowLibrary(false); }}
              onDelete={deleteSavedPatch}
            />
          </VStack>
        </Dialog>

        <VStack gap={0.5} align="center" className="footer">
          <Text type="supporting" size="2xs">Formes inspirées des 36 formes vectorielles technologiques de Vanzyst | Powered by{' '}
            <Link href="https://theorem.masudlewis.com" target="_blank" className="footer__link">Theorem</Link></Text>
        </VStack>
      </main>
    </Theme>
  );
}
