import { BeerIconFrame } from "./doodle";

type CusquenaIconProps = {
  className?: string;
};

/**
 * Batch3 Cusqueña Dorada — white label with gold border, red wordmark, golden
 * Inti sun; bottle shoulders hint the Inca 12-angle stone emboss.
 * Stylised likeness, not the trademark artwork.
 */
export function CusquenaIcon({ className }: CusquenaIconProps) {
  return (
    <BeerIconFrame typeLabel="淡拉格" filterId="cusquena-wobble" label="Cusquena Dorada" className={className}>
      <path d="M 52 16 L 68 16 L 68 26 L 52 26 Z" fill="#8a6a1c" />
      <path d="M 53 26 L 53 58 Q 53 66 46 70 L 42 74 L 42 134 Q 42 144 52 144 L 68 144 Q 78 144 78 134 L 78 74 L 74 70 Q 67 66 67 58 L 67 26 Z" fill="#d9a521" />
      <path d="M 61 72 L 74 70 Q 78 74 78 78 L 78 134 Q 78 144 68 144 L 61 144 Z" fill="#a8841c" stroke="none" />
      {/* Stone-emboss hint on shoulders */}
      <path d="M 46 66 L 52 62 L 58 66 L 64 62 L 70 66" fill="none" stroke="#8a6a1c" strokeWidth="1" opacity="0.7" />
      {/* White label, gold border */}
      <path d="M 44 80 L 76 80 L 76 134 L 44 134 Z" fill="#fffdf5" stroke="#d9a521" strokeWidth="1.6" />
      {/* Golden Inti sun */}
      <circle cx="60" cy="94" r="5" fill="#f2c230" stroke="none" />
      <path d="M 60 85 L 60 88 M 60 100 L 60 103 M 51 94 L 54 94 M 66 94 L 69 94 M 54 88 L 56 90 M 64 98 L 66 100 M 66 88 L 64 90 M 56 98 L 54 100" stroke="#d9a521" strokeWidth="1.2" />
      <text x="60" y="112" textAnchor="middle" fill="#c8102e" fontSize="7.5" fontWeight="800" stroke="none" className="font-hand">
        CUSQUEÑA
      </text>
      <text x="60" y="121" textAnchor="middle" fill="#8a6a1c" fontSize="5.5" fontWeight="800" stroke="none" className="font-hand">
        DORADA
      </text>
      <text x="60" y="130" textAnchor="middle" fill="#1a1a1a" fontSize="4.5" fontWeight="700" stroke="none" className="font-hand">
        MACHU PICCHU
      </text>
      <path d="M 47 78 L 47 88" stroke="#ffffff" strokeWidth="2" opacity="0.6" />
      <path d="M 94 60 L 94 70 M 89 65 L 99 65" strokeWidth="1.5" />
      <path d="M 24 108 L 24 116 M 20 112 L 28 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
