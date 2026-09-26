import { BeerIconFrame } from "./doodle";

type CristalIconProps = {
  className?: string;
};

/**
 * Batch3 Cristal (Chile, CCU — not the champagne): green bottle, white label,
 * blue CRISTAL serif, red rule, gold trim, crystal diamond mark.
 * Stylised likeness, not the trademark artwork.
 */
export function CristalIcon({ className }: CristalIconProps) {
  return (
    <BeerIconFrame typeLabel="淡拉格" filterId="cristal-wobble" label="Cristal Chile" className={className}>
      <path d="M 52 16 L 68 16 L 68 26 L 52 26 Z" fill="#0b5c2c" />
      <path d="M 53 26 L 53 58 Q 53 66 46 70 L 42 74 L 42 134 Q 42 144 52 144 L 68 144 Q 78 144 78 134 L 78 74 L 74 70 Q 67 66 67 58 L 67 26 Z" fill="#12803f" />
      <path d="M 61 72 L 74 70 Q 78 74 78 78 L 78 134 Q 78 144 68 144 L 61 144 Z" fill="#0b5c2c" stroke="none" opacity="0.9" />
      {/* White label + gold trim */}
      <path d="M 44 78 L 76 78 L 76 134 L 44 134 Z" fill="#fffdf5" stroke="#d9a521" strokeWidth="1.4" />
      {/* Crystal diamond mark */}
      <path d="M 60 84 L 66 90 L 60 96 L 54 90 Z" fill="#9fc4e8" stroke="none" />
      <path d="M 60 84 L 60 96 M 54 90 L 66 90" stroke="#ffffff" strokeWidth="1" />
      <text x="60" y="110" textAnchor="middle" fill="#1c4f9c" fontSize="9.5" fontWeight="800" stroke="none" className="font-hand">
        CRISTAL
      </text>
      <path d="M 48 115 L 72 115" stroke="#c8102e" strokeWidth="1.8" />
      <text x="60" y="125" textAnchor="middle" fill="#1a1a1a" fontSize="5.5" fontWeight="700" stroke="none" className="font-hand">
        CERVEZA · CHILE
      </text>
      <path d="M 47 78 L 47 88" stroke="#ffffff" strokeWidth="2" opacity="0.7" />
      <path d="M 94 60 L 94 70 M 89 65 L 99 65" strokeWidth="1.5" />
      <path d="M 24 108 L 24 116 M 20 112 L 28 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
