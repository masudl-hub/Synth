import React from 'react';

/* Two ways in, one analyser, thirteen canvases. Colours come from the theme so it follows light and dark. */
const LINE = 'var(--color-border)';
const INK = 'var(--color-text-primary)';
const SOFT = 'var(--color-text-secondary)';
const FILL = 'var(--color-background-card-raised)';

interface BoxProps { x: number; y: number; w: number; h: number; title: string; note?: string; strong?: boolean }

const Box: React.FC<BoxProps> = ({ x, y, w, h, title, note, strong }) => (
  <g>
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

export const SignalDiagram: React.FC = () => (
  <svg viewBox="0 0 720 580" role="img" aria-labelledby="signal-title signal-desc" className="article__diagram" fontFamily="var(--font-family-body)">
    <title id="signal-title">How sound reaches the canvases</title>
    <desc id="signal-desc">
      On the synth path, your words, image or voice go to the Gemini model through Theorem, which returns a JSON patch. The browser's
      audio engine plays the patch. On the microphone path, sound goes straight in. Both reach one analyser, which feeds thirteen canvases.
    </desc>
    <defs>
      <marker id="signal-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 z" fill={SOFT} />
      </marker>
    </defs>

    <Label x={170} y={22}>Path one · AI synth</Label>
    <Label x={550} y={22}>Path two · Microphone</Label>

    <Box x={40} y={40} w={260} h={56} title="You" note="words, an image, or your voice" />
    <Arrow x1={170} y1={96} x2={170} y2={128} />
    <Box x={40} y={128} w={260} h={56} title="Gemini, through Theorem" note="reads the request, composes" />
    <Arrow x1={170} y1={184} x2={170} y2={216} />
    <Box x={40} y={216} w={260} h={56} title="A JSON patch" note="a score written as data" strong />
    <Arrow x1={170} y1={272} x2={170} y2={304} />
    <Box x={40} y={304} w={260} h={56} title="The synth engine" note="oscillators · filter · drums · reverb" />
    <Label x={312} y={338} anchor="start">+ speakers</Label>

    <Box x={420} y={40} w={260} h={56} title="Microphone" note="any sound in the room" />
    <Arrow x1={550} y1={96} x2={550} y2={396} dashed />
    <Label x={566} y={236} anchor="start">no patch</Label>

    <Arrow x1={170} y1={360} x2={170} y2={396} />
    <Box x={40} y={396} w={640} h={64} title="The analyser" note="waveform · spectrum · loudness · bass, mid, treble · brightness · onsets · loudest pitch · the twelve notes" strong />
    <Arrow x1={360} y1={460} x2={360} y2={500} />
    <Box x={40} y={500} w={640} h={64} title="Thirteen canvases" note="each one draws a real relation from that data, and says how closely" />
  </svg>
);
