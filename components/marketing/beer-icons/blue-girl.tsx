import { BeerIconFrame } from "./doodle";

type BlueGirlIconProps = {
  className?: string;
};

/**
 * UR2.4 v3 Blue Girl（藍妹）— corrected from the real can photo: it is a
 * CREAM can with gold pinstripes (not blue), oval navy-ring medallion
 * ("PILSENER LAGER BIER") with the classical maiden, blue base band with
 * white "BLUE GIRL", "IMPORTED" collar.
 */
export function BlueGirlIcon({ className }: BlueGirlIconProps) {
  return (
    <BeerIconFrame typeLabel="皮爾森" filterId="bluegirl-wobble" label="Blue Girl" className={className}>
      {/* Cream can body */}
      <path
        d="M 38 34 L 38 132 Q 38 142 48 142 L 72 142 Q 82 142 82 132 L 82 34 Z"
        fill="#f6f1e2"
      />
      <path d="M 70 34 L 82 34 L 82 132 Q 82 142 72 142 L 70 142 Z" fill="#e2d9bf" stroke="none" />
      {/* Gold pinstripes */}
      <path d="M 38 56 L 82 56 M 38 60 L 82 60" stroke="#c9a227" strokeWidth="1" opacity="0.8" />
      {/* Lid */}
      <ellipse cx="60" cy="34" rx="22" ry="6" fill="#d8d5c9" />
      <ellipse cx="60" cy="32" rx="14" ry="3.5" fill="#efede4" />
      {/* Collar */}
      <text
        x="60" y="48" textAnchor="middle" fill="#1c4f9c" fontSize="8"
        fontWeight="800" stroke="none" className="font-hand"
      >
        IMPORTED
      </text>
      {/* Oval medallion — gold + navy rings */}
      <ellipse cx="60" cy="84" rx="21" ry="28" fill="#c9a227" />
      <ellipse cx="60" cy="84" rx="18.5" ry="25.5" fill="#1c4f9c" />
      <ellipse cx="60" cy="84" rx="14.5" ry="21.5" fill="#f6f1e2" />
      {/* Ring text */}
      <text
        x="60" y="68" textAnchor="middle" fill="#f6f1e2" fontSize="5.5"
        fontWeight="800" stroke="none" className="font-hand"
      >
        PILSENER
      </text>
      <text
        x="60" y="103" textAnchor="middle" fill="#f6f1e2" fontSize="5.5"
        fontWeight="800" stroke="none" className="font-hand"
      >
        LAGER BIER
      </text>
      {/* Sunburst */}
      <path
        d="M 60 74 L 60 70 M 54 76 L 51 73 M 66 76 L 69 73 M 52 82 L 48 82 M 68 82 L 72 82"
        stroke="#c9a227" strokeWidth="1.2"
      />
      {/* Classical maiden */}
      <circle cx="60" cy="78" r="3" fill="none" strokeWidth="1.8" />
      <path d="M 57 81 Q 60 79.5 63 81 L 62.5 90 Q 60 92 57.5 90 Z" strokeWidth="1.8" />
      <path d="M 57.5 84 L 53 80 M 62.5 84 L 66 79" strokeWidth="1.6" />
      <path d="M 58.5 90 L 58 96 M 61.5 90 L 62 96" strokeWidth="1.6" />
      <circle cx="66" cy="77" r="1.6" fill="#c9a227" stroke="none" />
      {/* Blue base band */}
      <path d="M 38 114 L 82 114 L 82 130 L 38 130 Z" fill="#1c4f9c" stroke="none" />
      <text
        x="60" y="126" textAnchor="middle" fill="#ffffff" fontSize="10"
        fontWeight="800" stroke="none" className="font-hand"
      >
        BLUE GIRL
      </text>
      {/* Shine */}
      <path d="M 44 62 L 44 110" stroke="#ffffff" strokeWidth="2.5" opacity="0.8" />
      {/* Sparkles */}
      <path d="M 96 52 L 96 62 M 91 57 L 101 57" strokeWidth="1.5" />
      <path d="M 24 108 L 24 116 M 20 112 L 28 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
