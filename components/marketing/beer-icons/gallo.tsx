import { BeerIconFrame } from "./doodle";

type GalloIconProps = {
  className?: string;
};

/**
 * Batch4 Gallo — white label, black-gold rooster head (crest + gold eye),
 * red GALLO, export name Famosa in aliases. Stylised, not the trademark artwork.
 */
export function GalloIcon({ className }: GalloIconProps) {
  return (
    <BeerIconFrame typeLabel="淡拉格" filterId="gallo-wobble" label="Gallo" className={className}>
      <path d="M 52 16 L 68 16 L 68 26 L 52 26 Z" fill="#8a0f22" />
      <path d="M 53 26 L 53 58 Q 53 66 46 70 L 42 74 L 42 134 Q 42 144 52 144 L 68 144 Q 78 144 78 134 L 78 74 L 74 70 Q 67 66 67 58 L 67 26 Z" fill="#7a3f14" />
      <path d="M 61 72 L 74 70 Q 78 74 78 78 L 78 134 Q 78 144 68 144 L 61 144 Z" fill="#5a2d0c" stroke="none" opacity="0.9" />
      {/* White label */}
      <path d="M 42 76 L 78 76 L 78 136 L 42 136 Z" fill="#fffdf5" stroke="none" />
      {/* Rooster head: triangular + crest fan + gold eye */}
      <path d="M 52 100 Q 54 88 60 86 Q 66 88 68 100 Q 64 108 60 110 Q 56 108 52 100 Z" fill="#1a1a1a" stroke="none" />
      <path d="M 54 88 Q 52 82 48 80 M 58 86 Q 58 80 56 76 M 62 86 Q 64 80 66 78" fill="none" stroke="#1a1a1a" strokeWidth="2" />
      <circle cx="60" cy="95" r="2" fill="#d9a521" stroke="none" />
      <path d="M 56 104 L 64 104" stroke="#d9a521" strokeWidth="1.4" />
      <text x="60" y="122" textAnchor="middle" fill="#c8102e" fontSize="10" fontWeight="800" stroke="none" className="font-hand">
        GALLO
      </text>
      <text x="60" y="131" textAnchor="middle" fill="#1a1a1a" fontSize="5" fontWeight="700" stroke="none" className="font-hand">
        DESDE 1896
      </text>
      <path d="M 94 60 L 94 70 M 89 65 L 99 65" strokeWidth="1.5" />
      <path d="M 24 108 L 24 116 M 20 112 L 28 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
