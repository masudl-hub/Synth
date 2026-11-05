import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { TipMarker } from './TipMarker.tsx';

/* Two ways in, one analyser, fourteen canvases. Colours come from the theme so it follows light and dark. */
const LINE = 'var(--color-border)';
const INK = 'var(--color-text-primary)';
const SOFT = 'var(--color-text-secondary)';
const FILL = 'var(--color-background-card-raised)';

/* How each stage works, shown when its box is hovered or focused. */
const TIPS: Record<string, { name: string; text: string }> = {
  you: {
    name: 'You',
    text: 'Type a description, attach up to two images, or record a voice note. The patch now playing rides along, so a refinement edits what is playing instead of starting over.',
  },
  model: {
    name: 'Gemini, through Theorem',
    text: "Your request goes to Gemini 3.5 Flash-Lite through Theorem. Theorem hands the model its brief (the composer's rules on scales, rhythm, timbre and drums, plus the loop length you chose) and the exact shape a patch must take, so the reply comes back as valid JSON instead of prose. It streams the reply as it is written, remembers the conversation so a follow-up like 'make it slower' edits the patch instead of starting over, and picks up again if a stream is cut off. To remember, Google stores each exchange, images and voice notes included.",
  },
  patch: {
    name: 'A JSON patch',
    text: 'A page of plain data, not code: tempo and loop length; two instruments, a lead and a bass, each with its oscillator, FM, optional second layer and sub, filter, envelope and optional LFO; delay, reverb and optional drum hits; and two lists of notes, one for each instrument. Each note has a pitch in hertz, a start step and a length. Steps are sixteenth notes, sixteen to a bar. Because it is data, you can read it, edit it with the code button, save it, or share it.',
  },
  engine: {
    name: 'The synth engine',
    text: "The browser's Web Audio API plays the patch live. A scheduler wakes every 25 milliseconds and queues the notes due in the next 100 on the audio clock, which keeps the timing steady. Each note builds a small circuit from its instrument: oscillators, an FM modulator, a second layer or a sub, a filter, an envelope and a pan position. A slide note joins the note before it instead and bends its pitch. The mix goes through a master filter, delay and reverb to your speakers.",
  },
  mic: {
    name: 'Microphone',
    text: 'The browser asks permission, then sends the microphone stream straight to the analyser. There is no patch and no model, and nothing leaves the page.',
  },
  analyser: {
    name: 'The analyser',
    text: 'Two FFT analysers, one quick (256 points) and one detailed (8,192), watch the final signal every 16 milliseconds. From them come the level (RMS), the bass, mid and treble levels, the brightness (the spectral centroid), the onsets (spectral flux), the strongest partial, and how much of each of the twelve notes is sounding. The synth and the microphone share this code, so a canvas cannot tell which one it is drawing.',
  },
  canvases: {
    name: 'Fourteen canvases',
    text: 'Each canvas is a function the page calls on every animation frame with the latest numbers. It draws one relation from physics or maths with those numbers as its inputs, and says how faithful it is: Computes, Idealised, Inspired by or Artistic. The formulas below show what each part does.',
  },
};

interface BoxProps {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  note?: string;
  strong?: boolean;
}

const Box: React.FC<BoxProps> = ({ id, x, y, w, h, title, note, strong }) => (
  // A named <g> is a group already, so it needs no role.
  <g data-tip={id} tabIndex={0} aria-label={`${title}: ${TIPS[id].text}`} style={{ cursor: 'help', outline: 'none' }}>
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={10}
      fill={FILL}
      stroke={strong ? INK : LINE}
      strokeWidth={strong ? 1.25 : 1}
    />
    <text
      x={x + w / 2}
      y={y + (note ? h / 2 - 4 : h / 2 + 4)}
      textAnchor="middle"
      fill={INK}
      fontSize={13}
      fontWeight={600}
    >
      {title}
    </text>
    {note ? (
      <text x={x + w / 2} y={y + h / 2 + 14} textAnchor="middle" fill={SOFT} fontSize={11}>
        {note}
      </text>
    ) : null}
  </g>
);

const Arrow: React.FC<{ x1: number; y1: number; x2: number; y2: number; dashed?: boolean }> = ({
  x1,
  y1,
  x2,
  y2,
  dashed,
}) => (
  <line
    x1={x1}
    y1={y1}
    x2={x2}
    y2={y2}
    stroke={SOFT}
    strokeWidth={1.25}
    strokeDasharray={dashed ? '4 4' : undefined}
    markerEnd="url(#signal-arrow)"
  />
);

const Label: React.FC<{ x: number; y: number; children: React.ReactNode; anchor?: 'start' | 'middle' }> = ({
  x,
  y,
  children,
  anchor = 'middle',
}) => (
  <text
    x={x}
    y={y}
    textAnchor={anchor}
    fill={SOFT}
    fontSize={10.5}
    letterSpacing={1.2}
    style={{ textTransform: 'uppercase' }}
  >
    {children}
  </text>
);

/** The drawing itself: two ways in, one analyser, fourteen canvases. */
const Diagram: React.FC = () => (
  <svg viewBox="0 0 720 580" role="presentation" className="article__diagram" fontFamily="var(--font-family-body)">
    <defs>
      <marker
        id="signal-arrow"
        viewBox="0 0 10 10"
        refX="8"
        refY="5"
        markerWidth="7"
        markerHeight="7"
        orient="auto-start-reverse"
      >
        <path d="M0 0 L10 5 L0 10 z" fill={SOFT} />
      </marker>
    </defs>

    <Label x={170} y={22}>
      Path one · AI synth
    </Label>
    <Label x={550} y={22}>
      Path two · Microphone
    </Label>

    <Box id="you" x={40} y={40} w={260} h={56} title="You" note="words, an image, or your voice" />
    <Arrow x1={170} y1={96} x2={170} y2={128} />
    <Box id="model" x={40} y={128} w={260} h={56} title="Gemini, through Theorem" note="reads the request, composes" />
    <Arrow x1={170} y1={184} x2={170} y2={216} />
    <Box id="patch" x={40} y={216} w={260} h={56} title="A JSON patch" note="a score written as data" strong={true} />
    <Arrow x1={170} y1={272} x2={170} y2={304} />
    <Box
      id="engine"
      x={40}
      y={304}
      w={260}
      h={56}
      title="The synth engine"
      note="oscillators · filter · drums · reverb"
    />
    <Label x={312} y={338} anchor="start">
      + speakers
    </Label>

    <Box id="mic" x={420} y={40} w={260} h={56} title="Microphone" note="any sound in the room" />
    <Arrow x1={550} y1={96} x2={550} y2={396} dashed={true} />
    <Label x={566} y={236} anchor="start">
      no patch
    </Label>

    <Arrow x1={170} y1={360} x2={170} y2={396} />
    <Box
      id="analyser"
      x={40}
      y={396}
      w={640}
      h={64}
      title="The analyser"
      note="waveform · spectrum · level · bass, mid, treble · brightness · onsets · strongest partial · the twelve notes"
      strong={true}
    />
    <Arrow x1={360} y1={460} x2={360} y2={500} />
    <Box
      id="canvases"
      x={40}
      y={500}
      w={640}
      h={64}
      title="Fourteen canvases"
      note="each one draws a relation from that data, and says how closely it follows the physics"
    />
  </svg>
);

export const SignalDiagram: React.FC = () => {
  // The hovered box's rectangle, so the tooltip anchors to an invisible marker laid over it.
  const [hover, setHover] = useState<{ key: string; box: DOMRect } | null>(null);
  const show = useCallback((e: React.SyntheticEvent) => {
    const el = (e.target as Element).closest<SVGGElement>('[data-tip]');
    setHover(el?.dataset.tip ? { key: el.dataset.tip, box: el.getBoundingClientRect() } : null);
  }, []);
  const hide = useCallback(() => setHover(null), []);
  const tip = hover ? TIPS[hover.key] : undefined;
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
      {/* The figure names the diagram and hears the boxes' hover and focus; the svg only draws it. */}
      <figure
        aria-label="How sound reaches the canvases"
        onMouseOver={show}
        onFocus={show}
        onMouseLeave={hide}
        onBlur={hide}
      >
        <Diagram />
      </figure>
      {hover && tip ? <TipMarker name={tip.name} text={tip.text} box={hover.box} /> : null}
    </>
  );
};
