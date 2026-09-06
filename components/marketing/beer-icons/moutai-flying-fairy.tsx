import { BeerIconFrame } from "./doodle";

type MoutaiIconProps = {
  className?: string;
};

/**
 * UR2.4 v3 Moutai Flying Fairy — from the real bottle photo: white cylinder
 * with rounded shoulders, TALL red cap, RED label with a diagonal white sash
 * (gold-ring fairy medallion, diagonal "KWEICHOW MOUTAI", big red 贵州茅台酒,
 * distillery line). Stylised likeness, not the trademark artwork.
 */
export function MoutaiIcon({ className }: MoutaiIconProps) {
  return (
    <BeerIconFrame typeLabel="醬香白酒" filterId="moutai-wobble" label="Moutai Flying Fairy" className={className}>
      {/* Tall red cap */}
      <path d="M 50 12 L 70 12 L 70 34 L 50 34 Z" fill="#c8102e" />
      <path d="M 50 19 L 70 19 M 50 26 L 70 26" stroke="#8f0b20" strokeWidth="1.4" />
      {/* White cylinder + shoulders */}
      <path
        d="M 52 34 L 52 50 Q 52 56 40 60 Q 32 63 32 72 L 32 132 Q 32 144 44 144 L 76 144 Q 88 144 88 132 L 88 72 Q 88 63 80 60 Q 68 56 68 50 L 68 34 Z"
        fill="#f8f4ea"
      />
      {/* Red label */}
      <path d="M 34 74 L 86 74 L 86 136 L 34 136 Z" fill="#c8102e" stroke="none" />
      {/* Diagonal white sash */}
      <g transform="rotate(-16 60 105)">
        <rect x="30" y="96" width="60" height="22" fill="#fffdf5" stroke="none" />
        <path d="M 30 99 L 90 99 M 30 115 L 90 115" stroke="#333333" strokeWidth="0.8" />
      </g>
      {/* Fairy medallion */}
      <circle cx="46" cy="86" r="8" fill="none" stroke="#d9a521" strokeWidth="1.8" />
      <circle cx="46" cy="86" r="6" fill="#f6f1e2" stroke="none" />
      <path d="M 42 86 Q 46 82 50 85 M 43 88 Q 47 90 50 87" stroke="#c8102e" strokeWidth="1.4" />
      <circle cx="46" cy="84" r="1.2" fill="#1c4f9c" stroke="none" />
      {/* Diagonal KWEICHOW MOUTAI */}
      <text
        x="60" y="105" textAnchor="middle" fill="#1a1a1a" fontSize="6.5"
        fontWeight="800" stroke="none" className="font-hand"
        transform="rotate(-16 60 105)"
      >
        KWEICHOW MOUTAI
      </text>
      {/* Big red 贵州茅台酒 across sash */}
      <text
        x="60" y="112" textAnchor="middle" fill="#c8102e" fontSize="13"
        fontWeight="800" stroke="none" className="font-hand"
        transform="rotate(-16 60 105)"
      >
        贵州茅台酒
      </text>
      {/* Distillery line */}
      <text
        x="60" y="131" textAnchor="middle" fill="#fffdf5" fontSize="5.5"
        fontWeight="700" stroke="none" className="font-hand"
      >
        MOUTAI DISTILLERY
      </text>
      {/* Sparkles */}
      <path d="M 98 60 L 98 70 M 93 65 L 103 65" strokeWidth="1.5" />
      <path d="M 22 108 L 22 116 M 18 112 L 26 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
