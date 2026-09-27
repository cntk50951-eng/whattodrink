import { BeerIconFrame } from "./doodle";

type BalboaIconProps = {
  className?: string;
};

/**
 * Batch4 Balboa — characteristic red label, gold Vasco Núñez helm bust,
 * white/gold trim, DESDE 1910. Stylised likeness, not the trademark artwork.
 */
export function BalboaIcon({ className }: BalboaIconProps) {
  return (
    <BeerIconFrame typeLabel="淡拉格" filterId="balboa-wobble" label="Balboa" className={className}>
      <path d="M 52 16 L 68 16 L 68 26 L 52 26 Z" fill="#8a0f22" />
      <path d="M 53 26 L 53 58 Q 53 66 46 70 L 42 74 L 42 134 Q 42 144 52 144 L 68 144 Q 78 144 78 134 L 78 74 L 74 70 Q 67 66 67 58 L 67 26 Z" fill="#7a3f14" />
      <path d="M 61 72 L 74 70 Q 78 74 78 78 L 78 134 Q 78 144 68 144 L 61 144 Z" fill="#5a2d0c" stroke="none" opacity="0.9" />
      {/* Red label + gold rules */}
      <path d="M 42 76 L 78 76 L 78 136 L 42 136 Z" fill="#a80f24" stroke="none" />
      <path d="M 42 79 L 78 79 M 42 133 L 78 133" stroke="#d9a521" strokeWidth="1.4" />
      {/* Conquistador helm bust */}
      <path d="M 52 96 Q 52 86 60 86 Q 68 86 68 96 L 66 104 L 54 104 Z" fill="#d9a521" stroke="none" />
      <path d="M 54 92 L 66 92" stroke="#8a6a1c" strokeWidth="1.2" />
      <circle cx="57.5" cy="96" r="1" fill="#1a1a1a" stroke="none" />
      <circle cx="62.5" cy="96" r="1" fill="#1a1a1a" stroke="none" />
      <text x="60" y="116" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="800" stroke="none" className="font-hand">
        BALBOA
      </text>
      <text x="60" y="126" textAnchor="middle" fill="#f2c230" fontSize="5.5" fontWeight="700" stroke="none" className="font-hand">
        DESDE 1910 · PANAMÁ
      </text>
      <path d="M 94 60 L 94 70 M 89 65 L 99 65" strokeWidth="1.5" />
      <path d="M 24 108 L 24 116 M 20 112 L 28 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
