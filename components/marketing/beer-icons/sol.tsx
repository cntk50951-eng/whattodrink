import { BeerIconFrame } from "./doodle";

type SolIconProps = {
  className?: string;
};

/**
 * Batch2 Sol（太阳）— from the real bottle photo: small CLEAR bottle, gold
 * beer, red "Sol" script on the neck, white/gold sunburst label with big
 * red "Sol" + "CERVECERIA MOCTEZUMA".
 */
export function SolIcon({ className }: SolIconProps) {
  return (
    <BeerIconFrame typeLabel="淡拉格" filterId="sol-wobble" label="Sol" className={className}>
      {/* Open mouth */}
      <path d="M 52 16 L 68 16 L 68 24 L 52 24 Z" fill="#e8d9a0" />
      {/* Clear bottle + gold beer */}
      <path d="M 53 24 L 53 58 Q 53 66 46 70 L 42 74 L 42 134 Q 42 144 52 144 L 68 144 Q 78 144 78 134 L 78 74 L 74 70 Q 67 66 67 58 L 67 24 Z" fill="#fdf6e3" opacity="0.95" />
      <path d="M 55 66 Q 55 70 49 74 L 46 77 L 46 132 Q 46 140 54 140 L 66 140 Q 74 140 74 132 L 74 77 L 71 74 Q 65 70 65 66 Z" fill="#f0b429" stroke="none" />
      {/* Red neck script */}
      <text
        x="56" y="46" textAnchor="middle" fill="#c8102e" fontSize="9"
        fontWeight="800" fontStyle="italic" stroke="none" className="font-hand"
      >
        Sol
      </text>
      {/* Sunburst label */}
      <path d="M 42 88 L 78 88 L 78 126 L 42 126 Z" fill="#fffdf5" />
      <path
        d="M 60 88 L 63 96 L 71 92 L 68 100 L 78 100 L 70 104 L 74 112 L 65 108 L 63 117 L 60 108 L 57 117 L 55 108 L 46 112 L 50 104 L 42 100 L 52 100 L 49 92 L 57 96 Z"
        fill="none" stroke="#d9a521" strokeWidth="1.2"
      />
      <text
        x="60" y="112" textAnchor="middle" fill="#c8102e" fontSize="14"
        fontWeight="800" fontStyle="italic" stroke="none" className="font-hand"
      >
        Sol
      </text>
      <text
        x="60" y="121" textAnchor="middle" fill="#5c430a" fontSize="4.5"
        fontWeight="800" stroke="none" className="font-hand"
      >
        CERVECERIA MOCTEZUMA
      </text>
      {/* Glass shine */}
      <path d="M 47 78 L 47 86" stroke="#ffffff" strokeWidth="2" opacity="0.9" />
      {/* Sparkles */}
      <path d="M 94 60 L 94 70 M 89 65 L 99 65" strokeWidth="1.5" />
      <path d="M 24 108 L 24 116 M 20 112 L 28 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
