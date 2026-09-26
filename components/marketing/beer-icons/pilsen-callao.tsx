import { BeerIconFrame } from "./doodle";

type PilsenCallaoIconProps = {
  className?: string;
};

/**
 * Batch3 Pilsen Callao — green bottle, cream label, green P-i ligature
 * calligraphy, free gold crown (since 1980), 1863. Stylised, no trademark.
 */
export function PilsenCallaoIcon({ className }: PilsenCallaoIconProps) {
  return (
    <BeerIconFrame typeLabel="淡拉格" filterId="pilsencallao-wobble" label="Pilsen Callao" className={className}>
      <path d="M 52 16 L 68 16 L 68 26 L 52 26 Z" fill="#0b5c2c" />
      <path d="M 53 26 L 53 58 Q 53 66 46 70 L 42 74 L 42 134 Q 42 144 52 144 L 68 144 Q 78 144 78 134 L 78 74 L 74 70 Q 67 66 67 58 L 67 26 Z" fill="#1a7a3a" />
      <path d="M 61 72 L 74 70 Q 78 74 78 78 L 78 134 Q 78 144 68 144 L 61 144 Z" fill="#0b5c2c" stroke="none" opacity="0.9" />
      {/* Cream label */}
      <path d="M 44 78 L 76 78 L 76 134 L 44 134 Z" fill="#f6f1e2" stroke="none" />
      {/* Gold crown */}
      <path d="M 52 84 L 54 90 L 58 85 L 60 91 L 62 85 L 66 90 L 68 84 L 68 92 L 52 92 Z" fill="#d9a521" stroke="none" />
      {/* P-i ligature calligraphy */}
      <text x="60" y="110" textAnchor="middle" fill="#0b5c2c" fontSize="13" fontWeight="800" fontStyle="italic" stroke="none" className="font-hand">
        Pilsen
      </text>
      <text x="60" y="121" textAnchor="middle" fill="#0b5c2c" fontSize="7" fontWeight="800" stroke="none" className="font-hand">
        CALLAO
      </text>
      <text x="60" y="130" textAnchor="middle" fill="#8a6a1c" fontSize="5.5" fontWeight="700" stroke="none" className="font-hand">
        DESDE 1863
      </text>
      <path d="M 47 78 L 47 88" stroke="#ffffff" strokeWidth="2" opacity="0.7" />
      <path d="M 94 60 L 94 70 M 89 65 L 99 65" strokeWidth="1.5" />
      <path d="M 24 108 L 24 116 M 20 112 L 28 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
