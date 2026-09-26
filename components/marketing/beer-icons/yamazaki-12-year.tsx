import { BeerIconFrame } from "./doodle";

type Yamazaki12YearIconProps = {
  className?: string;
};

/**
 * Batch3a Yamazaki 12 — from the official livery: solid square-shouldered
 * bottle (pot-still echo top), amber whisky, minimal ivory label with black
 * 山崎 kanji + gold 12 medallion. Stylised likeness, not the trademark artwork.
 */
export function Yamazaki12YearIcon({ className }: Yamazaki12YearIconProps) {
  return (
    <BeerIconFrame typeLabel="單一麥芽" filterId="yamazaki-wobble" label="Yamazaki 12 Year" className={className}>
      {/* Dark cap + neck */}
      <path d="M 52 12 L 68 12 L 68 28 L 52 28 Z" fill="#2b2b2b" />
      <path d="M 55 28 L 55 44 L 65 44 L 65 28 Z" fill="#8a4a16" />
      <path d="M 55 30 L 65 30" stroke="#d9a521" strokeWidth="1.4" />
      {/* Square shoulders + body */}
      <path
        d="M 55 44 Q 54 52 44 56 Q 36 59 36 68 L 36 132 Q 36 144 48 144 L 72 144 Q 84 144 84 132 L 84 68 Q 84 59 76 56 Q 66 52 65 44 Z"
        fill="#b45a1b"
      />
      <path d="M 70 58 L 76 60 Q 84 63 84 70 L 84 132 Q 84 144 72 144 L 70 144 Z" fill="#8a4212" stroke="none" />
      {/* Ivory label */}
      <path d="M 40 76 L 80 76 L 80 130 L 40 130 Z" fill="#f3ead3" stroke="none" />
      {/* Vertical 山崎 kanji */}
      <text
        x="52" y="98" textAnchor="middle" fill="#1a1a1a" fontSize="17"
        fontWeight="800" stroke="none" className="font-hand"
      >
        山
      </text>
      <text
        x="52" y="118" textAnchor="middle" fill="#1a1a1a" fontSize="17"
        fontWeight="800" stroke="none" className="font-hand"
      >
        崎
      </text>
      {/* Right column: maker + 12 medallion */}
      <text
        x="70" y="88" textAnchor="middle" fill="#1a1a1a" fontSize="4.5"
        fontWeight="700" stroke="none" className="font-hand"
      >
        THE YAMAZAKI
      </text>
      <circle cx="70" cy="102" r="9" fill="none" stroke="#d9a521" strokeWidth="1.8" />
      <text
        x="70" y="106" textAnchor="middle" fill="#8a4212" fontSize="10"
        fontWeight="800" stroke="none" className="font-hand"
      >
        12
      </text>
      <text
        x="70" y="122" textAnchor="middle" fill="#1a1a1a" fontSize="4.5"
        fontWeight="700" stroke="none" className="font-hand"
      >
        SINGLE MALT
      </text>
      {/* Glass shine */}
      <path d="M 41 62 L 41 72" stroke="#ffffff" strokeWidth="2" opacity="0.6" />
      {/* Sparkles */}
      <path d="M 96 56 L 96 66 M 91 61 L 101 61" strokeWidth="1.5" />
      <path d="M 22 108 L 22 116 M 18 112 L 26 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
