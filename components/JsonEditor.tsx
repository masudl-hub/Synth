import type React from 'react';
import { useCallback, useMemo, useRef } from 'react';

export interface JsonEditorProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}

// Strings, numbers, literals, punctuation. A string followed by a colon is a key.
const TOKEN =
  /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+\.?\d*(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}[\],:])|(\/\/.*$|\/\*[\s\S]*?\*\/)/gmu;

// The class for each capture group after the string and its colon, in the order TOKEN lists them.
const GROUP_CLASS = ['json__num', 'json__lit', 'json__punct', 'json__comment'];

const classOf = ([, str, colon, ...rest]: RegExpMatchArray) => {
  if (str) {
    return colon ? 'json__key' : 'json__str';
  }
  return GROUP_CLASS[rest.findIndex(Boolean)] ?? '';
};

function highlight(source: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const m of source.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) {
      out.push(source.slice(last, at));
    }
    const [text] = m;
    out.push(
      <span key={n++} className={classOf(m)}>
        {text}
      </span>,
    );
    last = at + text.length;
  }
  if (last < source.length) {
    out.push(source.slice(last));
  }
  return out;
}

/** A JSON editor with syntax colour: a transparent textarea over a painted copy of its text. */
export const JsonEditor: React.FC<JsonEditorProps> = ({ label, value, onChange, rows = 24 }) => {
  const paint = useRef<HTMLPreElement>(null);
  const nodes = useMemo(() => highlight(value), [value]);
  const onInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value), [onChange]);
  const onScroll = useCallback((e: React.UIEvent<HTMLTextAreaElement>) => {
    if (!paint.current) {
      return;
    }
    paint.current.scrollTop = e.currentTarget.scrollTop;
    paint.current.scrollLeft = e.currentTarget.scrollLeft;
  }, []);
  return (
    <div className="json" style={{ ['--rows' as string]: rows }}>
      <pre ref={paint} className="json__paint" aria-hidden="true">
        {nodes}
        {'\n'}
      </pre>
      <textarea
        className="json__input"
        aria-label={label}
        value={value}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        wrap="off"
        onChange={onInput}
        onScroll={onScroll}
      />
    </div>
  );
};
