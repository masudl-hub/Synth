import React, { useMemo, useRef } from 'react';

interface JsonEditorProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}

// Strings, numbers, literals, punctuation. A string followed by a colon is a key.
const TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+\.?\d*(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}[\],:])|(\/\/.*$|\/\*[\s\S]*?\*\/)/gm;

function highlight(source: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const m of source.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) out.push(source.slice(last, at));
    const [text, str, colon, num, lit, punct, comment] = m;
    const cls = str ? (colon ? 'json__key' : 'json__str') : num ? 'json__num' : lit ? 'json__lit' : punct ? 'json__punct' : comment ? 'json__comment' : '';
    out.push(<span key={n++} className={cls}>{text}</span>);
    last = at + text.length;
  }
  if (last < source.length) out.push(source.slice(last));
  return out;
}

/** A JSON editor with syntax colour: a transparent textarea over a painted copy of its text. */
export const JsonEditor: React.FC<JsonEditorProps> = ({ label, value, onChange, rows = 24 }) => {
  const paint = useRef<HTMLPreElement>(null);
  const nodes = useMemo(() => highlight(value), [value]);
  return (
    <div className="json" style={{ ['--rows' as string]: rows }}>
      <pre ref={paint} className="json__paint" aria-hidden="true">{nodes}{'\n'}</pre>
      <textarea
        className="json__input"
        aria-label={label}
        value={value}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        wrap="off"
        onChange={(e) => onChange(e.target.value)}
        onScroll={(e) => {
          if (!paint.current) return;
          paint.current.scrollTop = e.currentTarget.scrollTop;
          paint.current.scrollLeft = e.currentTarget.scrollLeft;
        }}
      />
    </div>
  );
};
