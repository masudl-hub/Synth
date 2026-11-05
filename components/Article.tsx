import katex from 'katex';
import type React from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import 'katex/dist/katex.min.css';
import { Button } from '@astryxdesign/core/Button';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack } from '@astryxdesign/core/HStack';
import { Link } from '@astryxdesign/core/Link';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import { demoFeatures } from '../audio/demo.ts';
import { PORCELAIN_BEATS } from '../audio/porcelainBeats.ts';
import { SynthEngine } from '../audio/SynthEngine.ts';
import { useCanvas } from '../hooks/useCanvas.ts';
import { simulations } from '../simulations/logic.ts';
import type { AudioFeatures, Instrument, SimulationDef } from '../types.ts';
import { CANVAS_NOTES, type Tip } from './articleSections.ts';
import { FIDELITY_LABEL } from './fidelity.ts';
import { SignalDiagram } from './SignalDiagram.tsx';
import { TipMarker } from './TipMarker.tsx';

// A marked part of a formula, «key|tex», becomes a KaTeX box carrying data-tip="key".
const TIP_MARK = /«(\w+)\|([^»]*)»/gu;

// KaTeX lays struts and stacked boxes around each part that reach far past its glyphs, so the part's own box
// catches the pointer where nothing is drawn. Only the glyphs count: the box is returned while the pointer is on one.
const glyphBox = (el: HTMLElement, x: number, y: number) => {
  const rects: DOMRect[] = [];
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    if (!n.textContent?.trim()) {
      continue;
    }
    range.selectNodeContents(n);
    rects.push(...Array.from(range.getClientRects()));
  }
  if (!rects.some((r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom)) {
    return null;
  }
  const left = Math.min(...rects.map((r) => r.left));
  const top = Math.min(...rects.map((r) => r.top));
  return new DOMRect(
    left,
    top,
    Math.max(...rects.map((r) => r.right)) - left,
    Math.max(...rects.map((r) => r.bottom)) - top,
  );
};

interface Hover {
  key: string;
  box: DOMRect;
  el: HTMLElement;
}

/** The marked part whose glyphs are under the pointer, if any. */
const partAt = (e: React.PointerEvent): Hover | null => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]');
  const key = el?.dataset.tip;
  const box = el && key ? glyphBox(el, e.clientX, e.clientY) : null;
  return el && key && box ? { key, box, el } : null;
};

/** A displayed formula whose marked parts show their tip on hover or tap. */
const Formula: React.FC<{ latex: string; tips: Record<string, Tip> }> = ({ latex, tips }) => {
  // KaTeX draws into the element itself, so its markup never passes through React as a string.
  const formulaRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    if (formulaRef.current) {
      katex.render(latex.replace(TIP_MARK, '\\htmlData{tip=$1}{$2}'), formulaRef.current, {
        displayMode: true,
        throwOnError: false,
        trust: true,
      });
    }
  }, [latex]);
  // The hovered part's box, so the tooltip anchors to an invisible marker laid over it.
  const [hover, setHover] = useState<Hover | null>(null);
  // A tap has no hover, so lifting the pointer shows the tip too.
  const show = useCallback((e: React.PointerEvent) => {
    const part = partAt(e);
    // The same part keeps its hover, so the tip does not jump while the pointer moves over it.
    setHover((h) => (part && h?.el === part.el ? h : part));
  }, []);
  const hide = useCallback(() => setHover(null), []);
  const tip = hover ? tips[hover.key] : undefined;
  // The part lights up with its tip, rather than on :hover, which would follow KaTeX's oversized boxes.
  useEffect(() => {
    if (!hover) {
      return;
    }
    hover.el.dataset.active = '';
    return () => {
      delete hover.el.dataset.active;
    };
  }, [hover]);
  // The part scrolls away from a resting pointer without a mouse event, so scrolling closes the tip.
  useEffect(() => {
    if (!hover) {
      return;
    }
    const close = () => setHover(null);
    globalThis.addEventListener('scroll', close, true);
    return () => globalThis.removeEventListener('scroll', close, true);
  }, [hover]);

  return (
    <>
      <span
        ref={formulaRef}
        className="article__formula"
        onPointerMove={show}
        onPointerUp={show}
        onPointerLeave={hide}
      />
      {hover && tip ? <TipMarker name={tip.name} text={tip.text} box={hover.box} /> : null}
    </>
  );
};

const P: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text as="p" display="block" textWrap="pretty" className="article__p">
    {children}
  </Text>
);

/** One canvas on its own: the shapes, without the border or the formula bar. It follows the pointer like the carousel tiles. */
const Shapes: React.FC<{ sim: SimulationDef; audioDataRef: React.RefObject<AudioFeatures> }> = ({
  sim,
  audioDataRef,
}) => {
  const { canvasRef, handleMouseMove, handleMouseEnter, handleMouseLeave } = useCanvas(sim.draw, audioDataRef, true);
  return (
    <canvas
      ref={canvasRef}
      data-bare="true"
      className="article__shapes"
      aria-label={`${sim.title}, drawn live`}
      role="img"
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    />
  );
};

/**
 * The canvases are fed Porcelain Beats played silently through the real analyser. Until the browser lets audio start,
 * a soft held tone stands in.
 */
const useDemoBeat = () => {
  const audioDataRef = useRef<AudioFeatures>(demoFeatures(0));
  useEffect(() => {
    const engine = new SynthEngine(true);
    // The tiles are small, so the beat is calmer here: slower, darker and quieter than the preset.
    const calm = (part: Instrument): Instrument => ({
      ...part,
      filter: { ...part.filter, frequency: 900, q: 1.5, envAmount: 1 },
      lfo: part.lfo && { ...part.lfo, rate: 1.5, depth: 0.06 },
    });
    engine.loadPatch({
      ...PORCELAIN_BEATS,
      bpm: 64,
      lead: calm(PORCELAIN_BEATS.lead),
      bass: calm(PORCELAIN_BEATS.bass),
    });
    engine.setFilterFreq(700);
    engine.setVolume(0.25);
    let started = false;
    const start = () => {
      engine.resume().then(() => {
        if (engine.isRunning && !started) {
          started = true;
          engine.start();
        }
      });
    };
    start();
    globalThis.addEventListener('pointerdown', start);
    globalThis.addEventListener('keydown', start);
    let frame = 0;
    const origin = performance.now();
    const tick = () => {
      if (started) {
        audioDataRef.current = engine.audioData;
      } else {
        demoFeatures((performance.now() - origin) / 1000, audioDataRef.current);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      globalThis.removeEventListener('pointerdown', start);
      globalThis.removeEventListener('keydown', start);
      engine.dispose();
    };
  }, []);
  return audioDataRef;
};

/** How this came to be. */
const Story: React.FC = () => (
  <VStack gap={4} align="start">
    <P>
      As a teenager, I came across a video on Chladni plates and I was mesmerised. It&rsquo;s so simple, but quotidian
      forces made visible triggered something in my mind, and in the way I think about the world.
    </P>
    <P>
      In late 2025, I had a bit of time and access to Google&rsquo;s AI Studio, and I thought, &ldquo;what if I could
      recreate these visuals?&rdquo; Not in the way equaliser videos on YouTube did, or actually, maybe including that
      way, but I wanted other ways, too. I only knew sand vibrating on a plate, so that was my starting point, and the
      LLM was pleasantly eager to explore other patterns with me.
    </P>
    <P>
      Well, surprise: that eagerness didn&rsquo;t translate to thoroughness. The original visuals were faked, based on
      hardly anything from the sound. That felt dishonest, and, selectively subscribing to John Ruskin&rsquo;s 1849
      treatise <em>The Seven Lamps of Architecture</em>, the Lamp of Truth, I wanted visuals driven by real maths and
      physics.
    </P>
    <P>
      The LLM and I went back and forth a bit. I started a few new chats, and finally, the truth was emerging. I
      can&rsquo;t pretend I understand everything that&rsquo;s happening here. I wish I did, and I endeavour to.
      I&rsquo;m sharing this because I&rsquo;m captivated by how human-AI collaboration can alchemise curiosity.
    </P>
    <P>
      That first version listened to the room around me, and each room left its own signature: my kitchen drew
      differently from my office nook. That somehow got me wondering what signatures different emotions and stories
      would leave. But a room only varies so much, so its signatures do too.
    </P>
    <P>
      So I got even more curious. Could the lab make its own sound? Or better yet, could it make data that a browser
      could &ldquo;perform&rdquo;? Probably obvious if you do this sort of thing, but a sound can be described as data.
      JSON! Of course. Now you describe a sound, in words or with an image, and Gemini (or a human, if you actually like
      writing JSON) writes it as a patch. The browser plays it without guesses, and the lab draws what it hears.
    </P>
  </VStack>
);

export const Article: React.FC<{ onOpenStudio: () => void }> = ({ onOpenStudio }) => {
  const audioDataRef = useDemoBeat();

  return (
    <article className="article" aria-label="About cymatics lab">
      <VStack gap={6} align="start" className="article__column">
        <Heading level={1} type="display-2" textWrap="balance">
          Making sound visible, honestly
        </Heading>

        <Story />

        <VStack gap={3} align="stretch" className="article__how">
          <Heading level={2}>How this works</Heading>
          <SignalDiagram />
        </VStack>

        <Heading level={2}>The thirteen canvases</Heading>
        <P>
          Most canvases also answer the pointer: moving it pushes, tilts or stirs the picture. That is there for play
          and is not part of any formula below.
        </P>

        {CANVAS_NOTES.map((note, i) => {
          const sim = simulations.find((s) => s.title === note.title);
          if (!sim) {
            return null;
          }
          return (
            <HStack key={note.title} gap={5} align="start" className="article__canvas">
              <Shapes sim={sim} audioDataRef={audioDataRef} />
              <VStack gap={3} align="start" className="article__canvas-text">
                <VStack gap={0.5} align="start">
                  <Text type="supporting" size="2xs" className="article__kicker">
                    {String(i + 1).padStart(2, '0')} · {FIDELITY_LABEL[sim.fidelity]}
                  </Text>
                  <Heading level={3}>{sim.title}</Heading>
                  <Text type="supporting" size="xsm">
                    {sim.description}
                  </Text>
                </VStack>
                <P>{note.plain}</P>
                <Formula latex={note.latex} tips={note.tips} />
                <Text type="supporting" size="sm">
                  Your sound: {note.reacts}
                </Text>
                <Text type="supporting" size="2xs">
                  {sim.reference}
                </Text>
              </VStack>
            </HStack>
          );
        })}

        <VStack gap={0.5} align="start">
          <Text type="supporting" size="xsm">
            Code written with Gemini in Google AI Studio and Claude Code.
          </Text>
          <Text type="supporting" size="xsm">
            Formes inspirées des 36 formes vectorielles technologiques de Vanzyst.
          </Text>
          <Text type="supporting" size="xsm">
            Agent powered by{' '}
            <Link href="https://theorem.masudlewis.com" target="_blank" className="footer__link">
              Theorem
            </Link>
            . UI built on{' '}
            <Link href="https://astryx.atmeta.com/" target="_blank" className="footer__link">
              Astryx
            </Link>
            .
          </Text>
        </VStack>

        <Button
          label="Open the synth studio"
          tooltip="Back to the studio, to make a sound of your own"
          variant="primary"
          onClick={onOpenStudio}
          className="article__studio"
        />
      </VStack>
    </article>
  );
};
