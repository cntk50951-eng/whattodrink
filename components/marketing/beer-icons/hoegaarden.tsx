import { BeerIconFrame } from "./doodle";

type HoegaardenIconProps = {
  className?: string;
};

/**
 * UR2.4 v3 Hoegaarden — from the real glass photo: faceted hexagonal tumbler,
 * cloudy honey-gold witbier, white foam with lacing, white gothic script with
 * navy outline + small navy/gold crest.
 */
export function HoegaardenIcon({ className }: HoegaardenIconProps) {
  return (
    <BeerIconFrame typeLabel="小麥白啤" filterId="hoegaarden-wobble" label="Hoegaarden" className={className}>
      {/* Faceted hex glass */}
      <path
        d="M 36 58 L 45 48 L 75 48 L 84 58 L 80 132 Q 79.6 142 69 142 L 51 142 Q 40.4 142 40 132 Z"
        fill="#eef3f6"
      />
      {/* Facet lines */}
      <path d="M 50 50 L 48 140 M 70 50 L 72 140" strokeWidth="1.2" opacity="0.5" />
      {/* Cloudy honey beer */}
      <path
        d="M 39 76 L 45 68 L 75 68 L 81 76 L 78 130 Q 77.7 138 68 138 L 52 138 Q 42.3 138 42 130 Z"
        fill="#e0a83e"
        stroke="none"
      />
      {/* Foam + lacing */}
      <path
        d="M 39 74 Q 37 62 47 60 Q 50 52 60 54 Q 70 50 73 60 Q 83 62 81 74 Q 70 70 60 72 Q 50 70 39 74 Z"
        fill="#fffdf5"
      />
      <circle cx="44" cy="78" r="1.6" fill="#fffdf5" stroke="none" />
      <circle cx="76" cy="80" r="1.4" fill="#fffdf5" stroke="none" />
      <circle cx="52" cy="56" r="2.6" fill="#fffdf5" stroke="none" />
      {/* White script, navy outline */}
      <text
        x="61" y="104" textAnchor="middle" fill="#fffdf5" stroke="#1c4f9c"
        strokeWidth="3" fontSize="13" fontWeight="800" fontStyle="italic"
        paintOrder="stroke" className="font-hand"
      >
        Hoegaarden
      </text>
      {/* Small crest */}
      <path d="M 40 84 L 46 84 L 46 94 L 43 96 L 40 94 Z" fill="#1c4f9c" strokeWidth="1.4" />
      <path d="M 43 86 L 43 93" stroke="#d9a521" strokeWidth="1.4" />
      {/* Wheat stalk */}
      <path d="M 90 118 L 97 90" stroke="#c9a227" strokeWidth="2" />
      <ellipse cx="93.5" cy="103" rx="3.2" ry="5.6" fill="#e3b93a" strokeWidth="1.8" transform="rotate(22 93.5 103)" />
      <ellipse cx="96.5" cy="94" rx="3" ry="5.2" fill="#e3b93a" strokeWidth="1.8" transform="rotate(22 96.5 94)" />
      {/* Orange slice on rim */}
      <circle cx="41" cy="54" r="6.5" fill="#f2994a" />
      <path d="M 41 47.5 L 41 60.5 M 34.5 54 L 47.5 54" stroke="#fffdf5" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
