import { BeerIconFrame } from "./doodle";

type CaribIconProps = {
  className?: string;
};

/**
 * Batch4 Carib Lager — ocean-blue label, white CARIB, gold sun-over-wave.
 * Stylised likeness, not the trademark artwork.
 */
export function CaribIcon({ className }: CaribIconProps) {
  return (
    <BeerIconFrame typeLabel="淡拉格" filterId="carib-wobble" label="Carib Lager" className={className}>
      <path d="M 52 16 L 68 16 L 68 26 L 52 26 Z" fill="#1c4f9c" />
      <path d="M 53 26 L 53 58 Q 53 66 46 70 L 42 74 L 42 134 Q 42 144 52 144 L 68 144 Q 78 144 78 134 L 78 74 L 74 70 Q 67 66 67 58 L 67 26 Z" fill="#7a3f14" />
      <path d="M 61 72 L 74 70 Q 78 74 78 78 L 78 134 Q 78 144 68 144 L 61 144 Z" fill="#5a2d0c" stroke="none" opacity="0.9" />
      {/* Ocean-blue label */}
      <path d="M 42 76 L 78 76 L 78 136 L 42 136 Z" fill="#1666a8" stroke="none" />
      {/* Gold sun over wave */}
      <circle cx="60" cy="94" r="6" fill="#f2c230" stroke="none" />
      <path d="M 60 84 L 60 87 M 51 94 L 54 94 M 66 94 L 69 94" stroke="#f2c230" strokeWidth="1.4" />
      <path d="M 46 102 Q 52 99 60 102 Q 68 105 74 102 L 74 106 Q 68 109 60 106 Q 52 103 46 106 Z" fill="#ffffff" stroke="none" />
      <path d="M 46 108 Q 52 105 60 108 Q 68 111 74 108 L 74 111 Q 68 114 60 111 Q 52 108 46 111 Z" fill="#9fc4e8" stroke="none" />
      <text x="60" y="124" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="800" stroke="none" className="font-hand">
        CARIB
      </text>
      <text x="60" y="132" textAnchor="middle" fill="#f2c230" fontSize="5" fontWeight="700" stroke="none" className="font-hand">
        LAGER · TRINIDAD
      </text>
      <path d="M 94 60 L 94 70 M 89 65 L 99 65" strokeWidth="1.5" />
      <path d="M 24 108 L 24 116 M 20 112 L 28 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
