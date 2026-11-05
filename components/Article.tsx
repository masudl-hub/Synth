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
  <Text as="p" display="block" textWrap="pretty" className="article__p">{children}</Text>
);

export const Article: React.FC = () => (
  <article className="article" aria-label="About cymatics lab">
    <VStack gap={6} align="start" className="article__column">
      <VStack gap={4} align="start">
        <P>As a teenager, I came across a video on cymatic sand and I was mesmerised. It&rsquo;s introductory physics, sure, but quotidian forces made visible triggered something in my mind, and in the way I think about the world.</P>
        <P>So, I had a bit of time and access to Google&rsquo;s AI Studio, and I thought &ldquo;what if I could recreate these visuals&rdquo;. Not in the way equaliser videos on YouTube did, or actually, maybe including that way, but I wanted other ways, too. Of course, I only knew about cymatic sand so that was my starting point, and the agent was pleasantly eager to explore other patterns with me.</P>
        <P>But, the eagerness was a facade and the waves were fake. That felt dishonest and, selectively subscribing to John Ruskin&rsquo;s 1849 treatise <em>The Seven Lamps of Architecture</em>, The Lamp of Truth, I wanted the visuals to be real math rendered on logical canvases.</P>
        <P>So the agent and I went back and forth and the truth started to emerge. Now, I cannot pretend that I understand everything that&rsquo;s happening here. I wish I did, and I endeavour to. The part that captivates me is the utility of human-AI collaboration to alchemise curiosity. And now, I&rsquo;m reading about Lorenz and Lissajous.</P>
        <P>But I got even more curious. If sound could be visualised through code, then could sound itself be code? This might be obvious to you, but I&rsquo;m a Theatre-turned-Architecture-turned-Ceramics kid. At most I was opening GarageBand and creating some transitions.</P>
        <P>You&rsquo;ll find this with a lot of my work: as a non-coder, declarative code resonates. Synthetic patches as JSON an agent can write and the browser could [word].</P>
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
            <Tex block tex={note.latex} />
            <VStack gap={1} align="start" className="article__symbols">
              {note.symbols.map(([tex, meaning]) => (
                <Text key={tex} type="supporting" size="sm"><Tex tex={tex} /> &mdash; {meaning}</Text>
              ))}
            </VStack>
            <Text type="supporting" size="sm">Your sound: {note.reacts}</Text>
            <Text type="supporting" size="2xs">{sim.reference}</Text>
          </VStack>
        );
      })}
    </VStack>
  </article>
);
