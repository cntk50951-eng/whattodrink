import { BeerIconFrame } from "./doodle";

type ClubColombiaIconProps = {
  className?: string;
};

/**
 * Batch3 Club Colombia Dorada — slim premium bottle, red label with gold
 * Mompox-filigree border, gold wordmark + medal (Monde Selection golds).
 * Stylised likeness, not the trademark artwork.
 */
export function ClubColombiaIcon({ className }: ClubColombiaIconProps) {
  return (
    <BeerIconFrame typeLabel="淡拉格" filterId="clubcolombia-wobble" label="Club Colombia Dorada" className={className}>
      {/* Slim neck + shoulders */}
      <path d="M 54 14 L 66 14 L 66 30 L 54 30 Z" fill="#8a0f22" />
      <path d="M 55 30 L 55 56 Q 55 64 48 68 L 45 71 L 45 134 Q 45 144 54 144 L 66 144 Q 75 144 75 134 L 75 71 L 72 68 Q 65 64 65 56 L 65 30 Z" fill="#7a3f14" />
      <path d="M 64 70 L 72 72 Q 75 75 75 79 L 75 134 Q 75 144 66 144 L 64 144 Z" fill="#5a2d0c" stroke="none" opacity="0.9" />
      {/* Red label + gold filigree border */}
      <path d="M 47 78 L 73 78 L 73 136 L 47 136 Z" fill="#a80f24" stroke="none" />
      <path d="M 49 80 L 71 80 L 71 134 L 49 134 Z" fill="none" stroke="#d9a521" strokeWidth="1.2" />
      <path d="M 49 80 Q 52 84 49 88 M 71 80 Q 68 84 71 88 M 49 134 Q 52 130 49 126 M 71 134 Q 68 130 71 126" fill="none" stroke="#d9a521" strokeWidth="1" />
      <text x="60" y="98" textAnchor="middle" fill="#f2c230" fontSize="6.5" fontWeight="800" stroke="none" className="font-hand">
        CLUB
      </text>
      <text x="60" y="108" textAnchor="middle" fill="#f2c230" fontSize="6" fontWeight="800" stroke="none" className="font-hand">
        COLOMBIA
      </text>
      {/* Gold medal */}
      <circle cx="60" cy="120" r="6" fill="none" stroke="#f2c230" strokeWidth="1.6" />
      <circle cx="60" cy="120" r="2" fill="#f2c230" stroke="none" />
      <text x="60" y="133" textAnchor="middle" fill="#f2c230" fontSize="5" fontWeight="800" stroke="none" className="font-hand">
        DORADA
      </text>
      <path d="M 94 60 L 94 70 M 89 65 L 99 65" strokeWidth="1.5" />
      <path d="M 26 108 L 26 116 M 22 112 L 30 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
