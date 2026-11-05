import React, { useMemo, useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { Tooltip } from '@astryxdesign/core/Tooltip';
import { VStack } from '@astryxdesign/core/VStack';
import { SignalDiagram } from './SignalDiagram';
import { FIDELITY_LABEL } from './Tile';
import { CANVAS_NOTES, Tip } from './articleSections';
import { simulations } from '../simulations/logic';

/** A displayed formula whose marked parts show their tip on hover, focus or tap. */
const Formula: React.FC<{ latex: string; tips: Record<string, Tip> }> = ({ latex, tips }) => {
  const html = useMemo(
    () => katex.renderToString(latex.replace(/«(\w+)\|([^»]*)»/g, '\\htmlData{tip=$1}{$2}'), { displayMode: true, throwOnError: false, trust: true }),
    [latex],
  );
  // The hovered part's box, so the tooltip anchors to an invisible marker laid over it.
  const [hover, setHover] = useState<{ key: string; box: DOMRect } | null>(null);

  const show = (e: React.SyntheticEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]');
    setHover(el?.dataset.tip ? { key: el.dataset.tip, box: el.getBoundingClientRect() } : null);
  };
  const tip = hover ? tips[hover.key] : undefined;

  return (
    <>
      <span
        className="article__formula"
        onMouseOver={show}
        onMouseLeave={() => setHover(null)}
        onClick={show}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {hover && tip && (
        <Tooltip isOpen placement="above" content={<><strong>{tip.name}.</strong> {tip.text}</>}>
          <span className="article__marker" style={{ left: hover.box.left, top: hover.box.top, width: hover.box.width, height: hover.box.height }} />
        </Tooltip>
      )}
    </>
  );
};

const P: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text as="p" display="block" textWrap="pretty" className="article__p">{children}</Text>
);

export const Article: React.FC = () => (
  <article className="article" aria-label="About cymatics lab">
    <VStack gap={6} align="start" className="article__column">
      <Heading level={1} type="display-2" textWrap="balance">Making sound visible, honestly</Heading>

      <VStack gap={4} align="start">
        <P>As a teenager, I came across a video on Chladni plates and I was mesmerised. It&rsquo;s so simple, but quotidian forces made visible triggered something in my mind, and in the way I think about the world.</P>
        <P>In late 2025, I had a bit of time and access to Google&rsquo;s AI Studio, and I thought, &ldquo;what if I could recreate these visuals?&rdquo; Not only the way equaliser videos on YouTube do, but other ways, too. I only knew sand vibrating on a plate, so that was my starting point, and the agent was pleasantly eager to explore other patterns with me.</P>
        <P>Well, surprise: that eagerness didn&rsquo;t translate to thoroughness. The original visuals were faked, based on hardly anything from the sound. That felt dishonest, and, selectively subscribing to John Ruskin&rsquo;s 1849 treatise <em>The Seven Lamps of Architecture</em>, the Lamp of Truth, I wanted visuals driven by real maths and physics.</P>
        <P>So Gemini and I went back and forth and the truth started to emerge. I can&rsquo;t pretend I understand everything that&rsquo;s happening here. I wish I did, and I endeavour to. What captivates me is how human-AI collaboration can alchemise curiosity.</P>
        <P>But I got even more curious. If sound could be visualised through code, could sound itself be code? Probably obvious if you do this sort of thing, but a sound can be described as data. JSON! Of course. An LLM can produce it cleanly, a human can read and edit it, and the browser can play it without guesses.</P>
      </VStack>

      <VStack gap={3} align="stretch" className="article__how">
        <Heading level={2}>How this works</Heading>
        <SignalDiagram />
      </VStack>

      {CANVAS_NOTES.map((note, i) => {
        const sim = simulations.find((s) => s.title === note.title);
        if (!sim) return null;
        return (
          <VStack key={note.title} gap={3} align="start" className="article__canvas">
            <VStack gap={0.5} align="start">
              <Text type="supporting" size="2xs" className="article__kicker">{String(i + 1).padStart(2, '0')} · {FIDELITY_LABEL[sim.fidelity]}</Text>
              <Heading level={3}>{sim.title}</Heading>
              <Text type="supporting" size="xsm">{sim.description}</Text>
            </VStack>
            <P>{note.plain}</P>
            <Formula latex={note.latex} tips={note.tips} />
            <Text type="supporting" size="sm">Your sound: {note.reacts}</Text>
            <Text type="supporting" size="2xs">{sim.reference}</Text>
          </VStack>
        );
      })}
    </VStack>
  </article>
);
