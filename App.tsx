import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { HStack } from '@astryxdesign/core/HStack';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Link } from '@astryxdesign/core/Link';
import { Text } from '@astryxdesign/core/Text';
import { ToggleButton } from '@astryxdesign/core/ToggleButton';
import { Theme } from '@astryxdesign/core/theme';
import { VStack } from '@astryxdesign/core/VStack';
import { IconLayoutSidebarLeftCollapse, IconRefresh } from '@tabler/icons-react';
import type React from 'react';
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { defaultThemeSlug, themes } from './astryx-themes.ts';
import { Article } from './components/Article.tsx';
import { Composer, type ComposerProps } from './components/Composer.tsx';
import { ControlStrip } from './components/ControlStrip.tsx';
import { Library, type LibraryEntry, type LibraryProps } from './components/Library.tsx';
import { MicPanel } from './components/MicPanel.tsx';
import { SimCarousel } from './components/SimCarousel.tsx';
import { StreamReadout } from './components/StreamReadout.tsx';
import { useAudioAnalyzer } from './hooks/useAudioAnalyzer.ts';
import { useDynamicFavicon } from './hooks/useDynamicFavicon.ts';
import { useGenerativeAudio } from './hooks/useGenerativeAudio.ts';
import { simulations } from './simulations/logic.ts';
import type { SynthPatch } from './types.ts';

// The article lives at its own path.
const ARTICLE_PATH = '/why';
const VIEW_EASE_OUT = 220;
const VIEW_EASE_IN = 320;
const PAINT_WAIT_MAX = 600;
const TRAILING_SLASHES = /\/+$/u;
const isArticlePath = () => globalThis.location.pathname.replace(TRAILING_SLASHES, '') === ARTICLE_PATH;

/** True once a canvas has drawn anything: some pixel is not fully transparent. */
const hasInk = (canvas: HTMLCanvasElement) => {
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      // Unreadable canvas: treat as painted.
      return true;
    }
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 3; i < data.length; i += 4) {
      if (data[i]) {
        return true;
      }
    }
  } catch {
    // Unreadable canvas: treat as painted.
    return true;
  }
  return false;
};
const painted = () =>
  [...document.querySelectorAll<HTMLCanvasElement>('.sim-carousel canvas, .article canvas')].some(hasInk);

/**
 * Moves between the app and the article by changing the path, so the article can be linked to and the back button
 * works. The view eases out, swaps while hidden, and eases in only once the new canvases have painted, so nothing
 * arrives before the visuals.
 */
const useArticleRoute = () => {
  const [showArticle, setShowArticle] = useState(isArticlePath);
  const [phase, setPhase] = useState<'idle' | 'out' | 'in'>('idle');
  const swapTimer = useRef<ReturnType<typeof globalThis.setTimeout>>(undefined);
  const paintFrame = useRef(0);

  const swap = useCallback((article: boolean) => {
    globalThis.clearTimeout(swapTimer.current);
    cancelAnimationFrame(paintFrame.current);
    setPhase('out');
    swapTimer.current = globalThis.setTimeout(() => {
      setShowArticle(article);
      globalThis.scrollTo(0, 0);
      const waitUntil = performance.now() + PAINT_WAIT_MAX;
      const check = () => {
        if (!painted() && performance.now() < waitUntil) {
          paintFrame.current = requestAnimationFrame(check);
          return;
        }
        setPhase('in');
        swapTimer.current = globalThis.setTimeout(() => setPhase('idle'), VIEW_EASE_IN);
      };
      paintFrame.current = requestAnimationFrame(() => requestAnimationFrame(check));
    }, VIEW_EASE_OUT);
  }, []);
  const goTo = useCallback(
    (article: boolean) => {
      if (article === isArticlePath()) {
        return;
      }
      globalThis.history.pushState(null, '', article ? ARTICLE_PATH : '/');
      swap(article);
    },
    [swap],
  );
  useEffect(() => {
    const onPop = () => swap(isArticlePath());
    globalThis.addEventListener('popstate', onPop);
    return () => globalThis.removeEventListener('popstate', onPop);
  }, [swap]);
  return { showArticle, phase, goTo };
};

/** The page's two corner buttons: start over, and the way to the article and back. */
const Corner: React.FC<{
  thread: number;
  showArticle: boolean;
  onStartOver: () => void;
  goTo: (a: boolean) => void;
}> = ({ thread, showArticle, onStartOver, goTo }) => (
  <HStack gap={1} align="center" className="app__toggle">
    <IconButton
      label="Start over"
      tooltip="Start over: new thread, and the patch is cleared unless you saved it"
      variant="ghost"
      // A full turn on every click.
      icon={
        <IconRefresh style={{ transform: `rotate(${thread * 360}deg)`, transition: 'transform 500ms ease-in-out' }} />
      }
      onClick={onStartOver}
    />
    <ToggleButton
      label="Why this exists"
      tooltip={showArticle ? 'Back to the studio' : 'Why this exists'}
      // One icon turned half a revolution: its mirror image is the right-collapse glyph.
      icon={
        <IconLayoutSidebarLeftCollapse
          style={{
            transform: showArticle ? 'rotate(180deg)' : 'none',
            transition: 'transform 300ms ease-in-out',
          }}
        />
      }
      isIconOnly={true}
      isPressed={showArticle}
      onPressedChange={goTo}
    />
  </HStack>
);

/** The patch library in its dialog; loading a patch plays it and closes the dialog. */
const LibraryDialog: React.FC<
  Omit<LibraryProps, 'onLoad'> & {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    loadPatch: (patch: unknown, playOnLoad: boolean) => void;
  }
> = ({ isOpen, onOpenChange, loadPatch, ...library }) => {
  const onLoad = useCallback(
    (patch: unknown) => {
      loadPatch(patch, true);
      onOpenChange(false);
    },
    [loadPatch, onOpenChange],
  );
  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} width="min(48rem, 94vw)">
      <DialogHeader title="Library" onOpenChange={onOpenChange} />
      <VStack padding={4}>
        <Library {...library} onLoad={onLoad} />
      </VStack>
    </Dialog>
  );
};

/** Every preset, then the saved patches, and whether the patch now loaded is already one of them. */
const useLibraryEntries = (
  presets: Record<string, SynthPatch>,
  savedPatches: SynthPatch[],
  currentPatch: SynthPatch | null,
) => {
  const entries = useMemo<LibraryEntry[]>(
    () => [
      ...Object.values(presets).map((patch) => ({ patch, savedIndex: null })),
      ...savedPatches.map((patch, i) => ({ patch, savedIndex: i })),
    ],
    [presets, savedPatches],
  );
  const isCurrentSaved = useMemo(() => {
    if (!currentPatch) {
      return false;
    }
    const current = JSON.stringify(currentPatch);
    return entries.some((e) => e.patch === currentPatch || JSON.stringify(e.patch) === current);
  }, [entries, currentPatch]);
  return { entries, isCurrentSaved };
};

/**
 * Which sound drives the visuals. Switching stops the music and the mic, but keeps the patch and the thread; the
 * article is for reading, so opening it silences both.
 */
const useAudioSource = (stopPlayback: () => void, goTo: (article: boolean) => void, showArticle: boolean) => {
  const [audioSource, setAudioSource] = useState<'synth' | 'mic'>('synth');
  const mic = useAudioAnalyzer();
  const { startAudio: startMic, stopAudio: stopMic } = mic;
  const listen = useCallback(
    (on: boolean) => {
      stopPlayback();
      setAudioSource(on ? 'mic' : 'synth');
      if (on) {
        startMic();
      } else {
        stopMic();
      }
      goTo(false);
    },
    [stopPlayback, startMic, stopMic, goTo],
  );
  const listenToMic = useCallback(() => listen(true), [listen]);
  const backToSynth = useCallback(() => listen(false), [listen]);

  const silence = useEffectEvent(() => {
    stopPlayback();
    stopMic();
  });
  useEffect(() => {
    if (showArticle) {
      silence();
    }
  }, [showArticle]);
  return { audioSource, mic, listenToMic, backToSynth };
};

/** Fixed height: the composer is pinned to its bottom and grows up into the gap, never pushing the page. */
const Dock: React.FC<
  ComposerProps & { isMic: boolean; isMicLive: boolean; onStartMic: () => void; onBack: () => void }
> = ({ isMic, isMicLive, onStartMic, onBack, ...composer }) => (
  <div className="dock">
    <div className="dock__float">
      {/* Both stay mounted: the composer keeps its thread while the mic is on. */}
      <div hidden={isMic} className="dock__slot">
        <Composer {...composer} />
      </div>
      {isMic ? <MicPanel isLive={isMicLive} onStart={onStartMic} onBack={onBack} /> : null}
    </div>
  </div>
);

const Header: React.FC = () => (
  <VStack gap={0.5} align="center" className="app__header">
    <Text type="large" weight="semibold">
      cymatics lab
    </Text>
    <Text type="supporting" size="xsm">
      Generative Audio Physics
    </Text>
  </VStack>
);

const Footer: React.FC = () => (
  <VStack gap={0.5} align="center" className="footer">
    <Text type="supporting" size="2xs">
      Formes inspirées des 36 formes vectorielles technologiques de Vanzyst | Powered by{' '}
      <Link href="https://theorem.masudlewis.com" target="_blank" className="footer__link">
        Theorem
      </Link>
    </Text>
  </VStack>
);

export function App() {
  const { showArticle, phase, goTo } = useArticleRoute();
  // Opens on Swarm, wherever it sits in the loop; kept here so the carousel keeps its place while the article is open.
  const [activeSim, setActiveSim] = useState(() =>
    Math.max(
      0,
      simulations.findIndex((sim) => sim.title === 'Swarm'),
    ),
  );
  const [showLibrary, setShowLibrary] = useState(false);
  const [stream, setStream] = useState<string | null>(null);
  // Bumped when a generated patch lands, so the controls ease in.
  const [arrival, setArrival] = useState(0);

  const synth = useGenerativeAudio();
  const { loadGenerated, isPlaying, currentPatch, stopPlayback, clearPatch, loadPatch } = synth;
  const { audioSource, mic, listenToMic, backToSynth } = useAudioSource(stopPlayback, goTo, showArticle);
  // Bumped by the refresh button; the composer starts a new thread.
  const [thread, setThread] = useState(0);

  const activeAudioRef = audioSource === 'synth' ? synth.audioDataRef : mic.audioDataRef;
  useDynamicFavicon(activeAudioRef);

  // Synth time only advances while playing; the mic world is always moving.
  const shouldTimeAdvance = audioSource === 'mic' || isPlaying;

  const onGenerated = useCallback(
    (raw: unknown) => {
      loadGenerated(raw);
      setArrival((n) => n + 1);
    },
    [loadGenerated],
  );

  const openStudio = useCallback(() => goTo(false), [goTo]);
  const openLibrary = useCallback(() => setShowLibrary(true), []);

  const startOver = useCallback(() => {
    clearPatch();
    setStream(null);
    setArrival(0);
    setThread((n) => n + 1);
    goTo(false);
  }, [clearPatch, goTo]);

  const { entries, isCurrentSaved } = useLibraryEntries(synth.PRESETS, synth.savedPatches, currentPatch);

  return (
    <Theme theme={themes[defaultThemeSlug]} mode="dark">
      <main className="app" data-phase={phase} data-view={showArticle ? 'article' : 'studio'}>
        <Corner thread={thread} showArticle={showArticle} onStartOver={startOver} goTo={goTo} />
        <Header />

        {showArticle ? null : (
          <SimCarousel
            active={activeSim}
            onActiveChange={setActiveSim}
            audioDataRef={activeAudioRef}
            shouldTimeAdvance={shouldTimeAdvance}
            resetTrigger={synth.patchVersion}
          />
        )}

        <ControlStrip
          arrival={arrival}
          isHidden={audioSource !== 'synth'}
          currentPatch={currentPatch}
          isPlaying={isPlaying}
          onTogglePlay={synth.togglePlay}
          bpm={synth.bpm}
          updateBpm={synth.updateBpm}
          volume={synth.volume}
          updateVolume={synth.updateVolume}
          filterFreq={synth.filterFreq}
          updateFilter={synth.updateFilter}
          onCycleOscillator={synth.updateOscillator}
          onOpenLibrary={openLibrary}
          onUpdatePatch={loadPatch}
        />

        <Dock
          isMic={audioSource === 'mic'}
          isMicLive={mic.isAudioEnabled}
          onStartMic={mic.startAudio}
          onBack={backToSynth}
          currentPatch={currentPatch}
          onPatch={onGenerated}
          onStream={setStream}
          onListen={listenToMic}
          thread={thread}
        />

        {showArticle ? <Article onOpenStudio={openStudio} /> : null}

        <StreamReadout text={audioSource === 'synth' ? stream : null} />

        <LibraryDialog
          isOpen={showLibrary}
          onOpenChange={setShowLibrary}
          loadPatch={loadPatch}
          entries={entries}
          currentPatch={currentPatch}
          isCurrentSaved={isCurrentSaved}
          onSave={synth.saveCurrentPatch}
          onDelete={synth.deleteSavedPatch}
        />

        <Footer />
      </main>
    </Theme>
  );
}
