import React, { useState } from 'react';
import { Tooltip } from '@astryxdesign/core/Tooltip';

/* Two ways in, one analyser, thirteen canvases. Colours come from the theme so it follows light and dark. */
const LINE = 'var(--color-border)';
const INK = 'var(--color-text-primary)';
const SOFT = 'var(--color-text-secondary)';
const FILL = 'var(--color-background-card-raised)';

/* How each stage works, shown when its box is hovered or focused. */
const TIPS: Record<string, { name: string; text: string }> = {
  you: { name: 'You', text: 'Type a description, attach up to two images, or record a voice note. The patch now playing rides along, and a random palette hint (a key, a scale, a tempo, a timbre) is added to a new piece, so each one starts somewhere different. A refinement edits what is playing instead.' },
  model: { name: 'Gemini, through Theorem', text: 'Your request goes to Gemini 3.5 Flash-Lite through Theorem. Theorem hands the model its brief (the composer\'s rules on scales, rhythm, timbre and drums, plus the loop length you chose) and the exact shape a patch must take, so the reply comes back as valid JSON instead of prose. It streams the reply as it is written, remembers the conversation so a follow-up like \'make it slower\' edits the patch instead of starting over, and picks up again if a stream is cut off.' },
  patch: { name: 'A JSON patch', text: 'A page of plain data, not code: tempo and loop length; the oscillator, its FM and an optional second layer; filter, envelope, delay and reverb; an optional LFO and drum hits; and two lists of notes. Each note has a pitch in hertz, a start step and a length. Steps are sixteenth notes, sixteen to a bar. Because it is data, you can read it, edit it with the code button, save it, or share it.' },
  engine: { name: 'The synth engine', text: 'The browser\'s Web Audio API plays the patch live. A scheduler wakes every 25 milliseconds and queues the notes due in the next 100 on the audio clock, which keeps the timing steady. Each note builds a small circuit: an oscillator, an FM modulator or a second layer, a filter, an envelope and a pan position. The mix goes through a master filter, delay and reverb to your speakers.' },
  mic: { name: 'Microphone', text: 'The browser asks permission, then sends the microphone stream straight to the analyser. There is no patch and no model, and nothing leaves the page.' },
  analyser: { name: 'The analyser', text: 'Two FFT analysers, one quick (256 points) and one detailed (8,192), watch the final signal every 16 milliseconds. From them come the loudness, the bass, mid and treble levels, the brightness (the spectral centroid), the onsets (spectral flux), the loudest pitch, and how much of each of the twelve notes is sounding. The synth and the microphone share this code, so a canvas cannot tell which one it is drawing.' },
  canvases: { name: 'Thirteen canvases', text: 'Each canvas is a function the page calls on every animation frame with the latest numbers. It draws one relation from physics or maths with those numbers as its inputs, and says how faithful it is: Computes, Idealised, Inspired by or Artistic. The formulas below show what each part does.' },
};

interface BoxProps { id: string; x: number; y: number; w: number; h: number; title: string; note?: string; strong?: boolean }

const Box: React.FC<BoxProps> = ({ id, x, y, w, h, title, note, strong }) => (
  <g data-tip={id} tabIndex={0} role="group" aria-label={`${title}: ${TIPS[id].text}`} style={{ cursor: 'help', outline: 'none' }}>
    <rect x={x} y={y} width={w} height={h} rx={10} fill={FILL} stroke={strong ? INK : LINE} strokeWidth={strong ? 1.25 : 1} />
    <text x={x + w / 2} y={y + (note ? h / 2 - 4 : h / 2 + 4)} textAnchor="middle" fill={INK} fontSize={13} fontWeight={600}>{title}</text>
    {note && <text x={x + w / 2} y={y + h / 2 + 14} textAnchor="middle" fill={SOFT} fontSize={11}>{note}</text>}
  </g>
);

const Arrow: React.FC<{ x1: number; y1: number; x2: number; y2: number; dashed?: boolean }> = ({ x1, y1, x2, y2, dashed }) => (
  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={SOFT} strokeWidth={1.25} strokeDasharray={dashed ? '4 4' : undefined} markerEnd="url(#signal-arrow)" />
);

const Label: React.FC<{ x: number; y: number; children: React.ReactNode; anchor?: 'start' | 'middle' }> = ({ x, y, children, anchor = 'middle' }) => (
  <text x={x} y={y} textAnchor={anchor} fill={SOFT} fontSize={10.5} letterSpacing={1.2} style={{ textTransform: 'uppercase' }}>{children}</text>
);

export const SignalDiagram: React.FC = () => {
  // The hovered box's rectangle, so the tooltip anchors to an invisible marker laid over it.
  const [hover, setHover] = useState<{ key: string; box: DOMRect } | null>(null);
  const show = (e: React.SyntheticEvent) => {
    const el = (e.target as Element).closest<SVGGElement>('[data-tip]');
    setHover(el?.dataset.tip ? { key: el.dataset.tip, box: el.getBoundingClientRect() } : null);
  };
  const tip = hover ? TIPS[hover.key] : undefined;

  return (
  <>
  <svg
    viewBox="0 0 720 580" role="group" aria-label="How sound reaches the canvases" className="article__diagram" fontFamily="var(--font-family-body)"
    onMouseOver={show} onFocus={show} onMouseLeave={() => setHover(null)} onBlur={() => setHover(null)}
  >
    <defs>
      <marker id="signal-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 z" fill={SOFT} />
      </marker>
    </defs>

    <Label x={170} y={22}>Path one · AI synth</Label>
    <Label x={550} y={22}>Path two · Microphone</Label>

    <Box id="you" x={40} y={40} w={260} h={56} title="You" note="words, an image, or your voice" />
    <Arrow x1={170} y1={96} x2={170} y2={128} />
    <Box id="model" x={40} y={128} w={260} h={56} title="Gemini, through Theorem" note="reads the request, composes" />
    <Arrow x1={170} y1={184} x2={170} y2={216} />
    <Box id="patch" x={40} y={216} w={260} h={56} title="A JSON patch" note="a score written as data" strong />
    <Arrow x1={170} y1={272} x2={170} y2={304} />
    <Box id="engine" x={40} y={304} w={260} h={56} title="The synth engine" note="oscillators · filter · drums · reverb" />
    <Label x={312} y={338} anchor="start">+ speakers</Label>

    <Box id="mic" x={420} y={40} w={260} h={56} title="Microphone" note="any sound in the room" />
    <Arrow x1={550} y1={96} x2={550} y2={396} dashed />
    <Label x={566} y={236} anchor="start">no patch</Label>

    <Arrow x1={170} y1={360} x2={170} y2={396} />
    <Box id="analyser" x={40} y={396} w={640} h={64} title="The analyser" note="waveform · spectrum · loudness · bass, mid, treble · brightness · onsets · loudest pitch · the twelve notes" strong />
    <Arrow x1={360} y1={460} x2={360} y2={500} />
    <Box id="canvases" x={40} y={500} w={640} h={64} title="Thirteen canvases" note="each one draws a real relation from that data, and says how closely" />
  </svg>
  {hover && tip && (
    <Tooltip isOpen placement="above" content={<><strong>{tip.name}.</strong> {tip.text}</>}>
      <span className="article__marker" style={{ left: hover.box.left, top: hover.box.top, width: hover.box.width, height: hover.box.height }} />
    </Tooltip>
  )}
  </>
  );
};
