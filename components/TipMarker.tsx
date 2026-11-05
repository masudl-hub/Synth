import { Tooltip } from '@astryxdesign/core/Tooltip';
import type React from 'react';

export interface TipMarkerProps {
  /** The part's name, shown first in bold. */
  name: string;
  text: string;
  /** Where the hovered part is on screen. */
  box: DOMRect;
}

/** A tip held open over an invisible marker laid on the hovered part, so it anchors to the part and not its container. */
export const TipMarker: React.FC<TipMarkerProps> = ({ name, text, box }) => (
  <Tooltip
    isOpen={true}
    placement="above"
    content={
      <>
        <strong>{name}.</strong> {text}
      </>
    }
  >
    <span className="article__marker" style={{ left: box.left, top: box.top, width: box.width, height: box.height }} />
  </Tooltip>
);
