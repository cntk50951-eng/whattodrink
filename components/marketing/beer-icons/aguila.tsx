import { BeerIconFrame } from "./doodle";

type AguilaIconProps = {
  className?: string;
};

/**
 * Batch4 Aguila Original — yellow label, eagle on blue globe, red CERVEZA
 * banner, white AGUILA with red trim, blue wavy banner, DESDE 1913.
 * Stylised likeness, not the trademark artwork.
 */
export function AguilaIcon({ className }: AguilaIconProps) {
  return (
    <BeerIconFrame typeLabel="淡拉格" filterId="aguila-wobble" label="Aguila Original" className={className}>
      <path d="M 52 16 L 68 16 L 68 26 L 52 26 Z" fill="#8a6a1c" />
      <path d="M 53 26 L 53 58 Q 53 66 46 70 L 42 74 L 42 134 Q 42 144 52 144 L 68 144 Q 78 144 78 134 L 78 74 L 74 70 Q 67 66 67 58 L 67 26 Z" fill="#7a3f14" />
      <path d="M 61 72 L 74 70 Q 78 74 78 78 L 78 134 Q 78 144 68 144 L 61 144 Z" fill="#5a2d0c" stroke="none" opacity="0.9" />
      {/* Yellow label field */}
      <path d="M 42 76 L 78 76 L 78 136 L 42 136 Z" fill="#f6c231" stroke="none" />
      {/* Blue globe + eagle */}
      <circle cx="60" cy="94" r="10" fill="#1c4f9c" stroke="none" />
      <path d="M 50 94 Q 60 90 70 94 M 52 99 Q 60 96 68 99" stroke="#9fc4e8" strokeWidth="1" />
      <path d="M 52 92 Q 56 84 60 86 Q 64 82 68 88 Q 64 90 60 89 Q 56 90 52 92 Z" fill="#5a3a1a" stroke="none" />
      <path d="M 55 88 L 65 88" stroke="#f6f1e2" strokeWidth="1.6" />
      {/* Red CERVEZA banner */}
      <path d="M 46 104 L 74 104 L 72 110 L 48 110 Z" fill="#c8102e" stroke="none" />
      <text x="60" y="109" textAnchor="middle" fill="#ffffff" fontSize="5" fontWeight="800" stroke="none" className="font-hand">
        CERVEZA
      </text>
      <text x="60" y="122" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="800" stroke="#c8102e" strokeWidth="0.6" className="font-hand">
        AGUILA
      </text>
      {/* Blue wavy banner */}
      <path d="M 44 126 Q 52 123 60 126 Q 68 129 76 126 L 76 130 Q 68 133 60 130 Q 52 127 44 130 Z" fill="#1c4f9c" stroke="none" />
      <text x="60" y="135" textAnchor="middle" fill="#1a1a1a" fontSize="4.5" fontWeight="700" stroke="none" className="font-hand">
        DESDE 1913
      </text>
      <path d="M 94 60 L 94 70 M 89 65 L 99 65" strokeWidth="1.5" />
      <path d="M 24 108 L 24 116 M 20 112 L 28 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
