import type { ReactNode } from "react";

type BeerIconFrameProps = {
  /** Unique per icon — duplicate filter ids break once 10 SVGs share a page. */
  filterId: string;
  label: string;
  className?: string;
  /** Short CN style tag (e.g. 淡拉格/小麥白啤/醬香白酒) printed under the art. */
  typeLabel?: string;
  children: ReactNode;
};

/**
 * UR2.4 shared doodle frame — one product per 120×160 stage.
 * Same wobble + ink language as BeerMugDoodle (feTurbulence displacement,
 * ink border strokes). v1 restricted fills to theme tokens and the icons
 * looked generic — v2 keeps the ink lines themed but paints each product in
 * its real shelf livery (fixed brand hex fills) so the ten read as the
 * actual beers. Likenesses are stylised, not trademark artwork.
 * The optional typeLabel strip (y=153) names the style under every icon so the
 * set stays distinguishable on web and in exported mobile assets alike.
 */
export function BeerIconFrame({
  filterId,
  label,
  className,
  typeLabel,
  children,
}: BeerIconFrameProps) {
  return (
    <svg
      viewBox="0 0 120 160"
      width="100%"
      role="img"
      aria-label={label}
      className={className}
    >
      <defs>
        <filter id={filterId} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.04"
            numOctaves="2"
          />
          <feDisplacementMap in="SourceGraphic" scale="2.5" />
        </filter>
      </defs>
      <g
        filter={`url(#${filterId})`}
        fill="none"
        stroke="var(--border)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </g>
      {typeLabel ? (
        <text
          x="60"
          y="153"
          textAnchor="middle"
          fill="var(--foreground)"
          opacity="0.8"
          fontSize="8.5"
          fontWeight="700"
          stroke="none"
          className="font-hand"
        >
          {typeLabel}
        </text>
      ) : null}
    </svg>
  );
}
