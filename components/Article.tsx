import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import { SignalDiagram } from './SignalDiagram';
import { FIDELITY_LABEL } from './Tile';
import { CANVAS_NOTES } from './articleSections';
import { simulations } from '../simulations/logic';

/** Static, trusted LaTeX from this repo, rendered by KaTeX. */
const Tex: React.FC<{ tex: string; block?: boolean }> = ({ tex, block }) => {
  const html = useMemo(() => katex.renderToString(tex, { displayMode: block, throwOnError: false }), [tex, block]);
  return <span className={block ? 'article__formula' : undefined} dangerouslySetInnerHTML={{ __html: html }} />;
};

const P: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text as="p" display="block" justify="center" textWrap="pretty" className="article__p">{children}</Text>
);

export const Article: React.FC = () => (
  <article className="article" aria-label="About cymatics lab">
    <VStack gap={6} align="center" className="article__column">
      <VStack gap={2} align="center">
        <Text type="supporting" size="2xs" className="article__kicker">An essay</Text>
        <Heading level={1} type="display-2" textWrap="balance">Making sound visible, honestly</Heading>
      </VStack>

      <VStack gap={4} align="center">
        <P>As a teenager I came across a video of sand on a vibrating plate. The grains jumped, slid, and settled into lines, and the lines made patterns. It is introductory physics, and I know that. But an everyday force, the thump you feel from a speaker, had become something I could see, and it changed how I think about the world.</P>
        <P>Years later I had some free time and access to Google&rsquo;s AI Studio, and I asked a plain question: what if I could recreate this? Not only the way equaliser videos do it, though maybe that way too. I only knew about cymatic sand, so that is where we started, and the agent was pleasantly eager to explore other patterns with me.</P>
        <P>The eagerness was a facade. The waves were fake. They looked like physics and were not, and that felt dishonest. John Ruskin wrote of a Lamp of Truth in <em>The Seven Lamps of Architecture</em> in 1849, and I borrow it selectively. I wanted the visuals to be real mathematics, drawn on logical canvases.</P>
        <P>So the agent and I went back and forth, and the truth started to emerge. I cannot pretend I understand all of it. I wish I did, and I am working on it. What holds me is the collaboration: a person&rsquo;s curiosity and a machine&rsquo;s patience, turning one into the other. These days I am reading about Lorenz and Lissajous.</P>
        <P>Then a stranger question arrived. If sound can be visualised through code, could sound itself be code? That may be obvious to you. I came to this from theatre, then architecture, then ceramics. The most I had ever done was open GarageBand and make some transitions.</P>
        <P>As a non-coder, declarative code is what resonates: say what you want, not how to get it. So here a sound is a <em>patch</em>, a page of JSON that names an oscillator, a filter, an envelope and a list of notes. An agent can write it, and the browser can perform it, the way a musician performs a score.</P>
        <P>Each canvas carries the lamp as a label: it <em>computes</em> its source, <em>idealises</em> it, is only <em>inspired by</em> it, or is <em>artistic</em>. Where something is invented, it says so. So, yes, I think sound can be code. The browser reads the score, plays it, listens to itself, and draws what it hears.</P>
      </VStack>

      <VStack gap={3} align="center">
        <Heading level={2}>How it works</Heading>
        <P>There are two ways in. In the first, you describe a sound and a model writes a patch. The browser&rsquo;s audio engine plays it. In the second, the microphone feeds sound in directly. Either way, one analyser listens and turns the sound into a handful of numbers, and every canvas draws from those same numbers.</P>
        <SignalDiagram />
      </VStack>

      <VStack gap={3} align="center">
        <Heading level={2}>The thirteen canvases</Heading>
        <P>Each one prints its formula on the canvas. Here it is again, with each symbol said in plain words.</P>
      </VStack>

      {CANVAS_NOTES.map((note, i) => {
        const sim = simulations.find((s) => s.title === note.title);
        if (!sim) return null;
        return (
          <VStack key={note.title} gap={3} align="center" className="article__canvas">
            <VStack gap={0.5} align="center">
              <Text type="supporting" size="2xs" className="article__kicker">{String(i + 1).padStart(2, '0')} · {FIDELITY_LABEL[sim.fidelity]}</Text>
              <Heading level={3}>{sim.title}</Heading>
              <Text type="supporting" size="xsm">{sim.description}</Text>
            </VStack>
            <P>{note.plain}</P>
            <Tex block tex={note.latex} />
            <VStack gap={1} align="center" className="article__symbols">
              {note.symbols.map(([tex, meaning]) => (
                <Text key={tex} type="supporting" size="sm" justify="center"><Tex tex={tex} /> &mdash; {meaning}</Text>
              ))}
            </VStack>
            <Text type="supporting" size="sm" justify="center">Your sound: {note.reacts}</Text>
            <Text type="supporting" size="2xs" justify="center">{sim.reference}</Text>
          </VStack>
        );
      })}
    </VStack>
  </article>
);
