import { BeerIconFrame } from "./doodle";

type QuilmesIconProps = {
  className?: string;
};

/**
 * Batch3 Quilmes Clásica — Argentina light-blue + white (national-team colours),
 * field tractor vignette. Stylised likeness, not the trademark artwork.
 */
export function QuilmesIcon({ className }: QuilmesIconProps) {
  return (
    <BeerIconFrame typeLabel="淡拉格" filterId="quilmes-wobble" label="Quilmes Clasica" className={className}>
      <path d="M 52 16 L 68 16 L 68 26 L 52 26 Z" fill="#5a2d0c" />
      <path d="M 53 26 L 53 58 Q 53 66 46 70 L 42 74 L 42 134 Q 42 144 52 144 L 68 144 Q 78 144 78 134 L 78 74 L 74 70 Q 67 66 67 58 L 67 26 Z" fill="#7a3f14" />
      <path d="M 61 72 L 74 70 Q 78 74 78 78 L 78 134 Q 78 144 68 144 L 61 144 Z" fill="#5a2d0c" stroke="none" opacity="0.9" />
      {/* Light-blue label, white chief */}
      <path d="M 42 76 L 78 76 L 78 136 L 42 136 Z" fill="#7fb8e8" stroke="none" />
      <path d="M 42 76 L 78 76 L 78 90 L 42 90 Z" fill="#fffdf5" stroke="none" />
      <text x="60" y="86" textAnchor="middle" fill="#1c4f9c" fontSize="8" fontWeight="800" stroke="none" className="font-hand">
        QUILMES
      </text>
      {/* Tractor vignette */}
      <rect x="50" y="100" width="14" height="9" fill="#1c4f9c" stroke="none" />
      <rect x="52" y="96" width="7" height="5" fill="#1c4f9c" stroke="none" />
      <circle cx="52" cy="112" r="3.4" fill="#1a1a1a" stroke="none" />
      <circle cx="65" cy="113" r="2.2" fill="#1a1a1a" stroke="none" />
      <path d="M 46 118 L 74 118" stroke="#1c4f9c" strokeWidth="1.4" />
      <text x="60" y="130" textAnchor="middle" fill="#ffffff" fontSize="6" fontWeight="800" stroke="none" className="font-hand">
        CLASICA
      </text>
      <path d="M 47 78 L 47 88" stroke="#ffffff" strokeWidth="2" opacity="0.5" />
      <path d="M 94 60 L 94 70 M 89 65 L 99 65" strokeWidth="1.5" />
      <path d="M 24 108 L 24 116 M 20 112 L 28 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
