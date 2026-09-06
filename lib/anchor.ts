/**
 * UR2.1 anchored pin card geometry — pure, unit tested.
 *
 * The card floats next to the tapped pin (no Leaflet Popup: stuffing React
 * portals into Leaflet DOM fights the doodle skin and the portal z-index
 * rule — see .memory/2026-09-06-dropdown-portal-above-leaflet.md).
 * All inputs are px numbers so the component stays a thin projector of
 * `latLngToContainerPoint` + this function.
 */

export type AnchorPlacement = {
  /** Panel left edge, px from the map container's left. */
  left: number;
  /** Panel top edge, px from the map container's top. */
  top: number;
  /** True when flipped below the pin (no room above). */
  below: boolean;
  /** Tail nub x, px relative to the panel's left (points at the pin). */
  tailX: number;
};

/** Default panel width; the caller shrinks it on narrow containers. */
export const ANCHOR_PANEL_W = 300;
/** Gap between pin point and panel edge. */
export const ANCHOR_GAP_PX = 12;
/** Minimum clearance from the container edges. */
const ANCHOR_EDGE_PX = 12;
/** Tail nub inset from the panel's side edges. */
const TAIL_INSET_PX = 18;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/**
 * Place a panelW×panelH card next to the pin at (pinX, pinY).
 * Above the pin by default; flips below when the top would clip;
 * clamps into the container on all sides.
 */
export function anchorPanel(
  pinX: number,
  pinY: number,
  panelW: number,
  panelH: number,
  containerW: number,
  containerH: number,
): AnchorPlacement {
  const left = clamp(
    pinX - panelW / 2,
    ANCHOR_EDGE_PX,
    Math.max(ANCHOR_EDGE_PX, containerW - panelW - ANCHOR_EDGE_PX),
  );
  const aboveTop = pinY - ANCHOR_GAP_PX - panelH;
  const below = aboveTop < ANCHOR_EDGE_PX;
  const top = clamp(
    below ? pinY + ANCHOR_GAP_PX : aboveTop,
    ANCHOR_EDGE_PX,
    Math.max(ANCHOR_EDGE_PX, containerH - panelH - ANCHOR_EDGE_PX),
  );
  const tailX = clamp(pinX - left, TAIL_INSET_PX, panelW - TAIL_INSET_PX);
  return { left, top, below, tailX };
}
