import React from 'react';

/** How much of the stream shows; the rest has scrolled away. */
const TAIL_CHARS = 1400;

interface StreamReadoutProps {
  /** What the model has written so far; null when nothing is streaming. */
  text: string | null;
}

/** A faint, fixed readout of the reply as it streams. It takes no layout space and no clicks. */
export const StreamReadout: React.FC<StreamReadoutProps> = ({ text }) => (
  <div className="stream" data-live={text !== null} aria-hidden="true">
    <pre className="stream__text">{(text ?? '').slice(-TAIL_CHARS)}<span className="stream__caret" /></pre>
  </div>
);
