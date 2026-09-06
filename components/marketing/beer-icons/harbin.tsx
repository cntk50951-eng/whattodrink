import { BeerIconFrame } from "./doodle";

type HarbinIconProps = {
  className?: string;
};

/**
 * Batch1 Harbin（哈尔滨 1900 臻藏）— from the real bottle photo: green glass,
 * dark-green label with gold 哈尔滨啤酒 + gold HARBIN + "1900 臻藏" + wheat
 * ears + medallions, "Since 1900".
 */
export function HarbinIcon({ className }: HarbinIconProps) {
  return (
    <BeerIconFrame typeLabel="拉格" filterId="harbin-wobble" label="Harbin" className={className}>
      {/* Cap */}
      <path d="M 52 16 L 68 16 L 68 26 L 52 26 Z" fill="#0b5c2c" />
      {/* Green body */}
      <path d="M 53 26 L 53 58 Q 53 66 46 70 L 42 74 L 42 134 Q 42 144 52 144 L 68 144 Q 78 144 78 134 L 78 74 L 74 70 Q 67 66 67 58 L 67 26 Z" fill="#146b35" />
      <path d="M 61 72 L 74 70 Q 78 74 78 78 L 78 134 Q 78 144 68 144 L 61 144 Z" fill="#0b4d22" stroke="none" opacity="0.9" />
      {/* Dark-green + gold label */}
      <path d="M 42 84 L 78 84 L 78 128 L 42 128 Z" fill="#0e3d20" />
      <path d="M 42 84 L 78 84 L 78 128 L 42 128 Z" fill="none" stroke="#c9a227" strokeWidth="1.6" />
      <text
        x="60" y="92" textAnchor="middle" fill="#c9a227" fontSize="5"
        fontWeight="700" stroke="none" className="font-hand"
      >
        Since 1900
      </text>
      <text
        x="60" y="103" textAnchor="middle" fill="#e8c85a" fontSize="9"
        fontWeight="800" stroke="none" className="font-hand"
      >
        哈尔滨啤酒
      </text>
      <text
        x="60" y="114" textAnchor="middle" fill="#e8c85a" fontSize="9"
        fontWeight="800" stroke="none" className="font-hand"
      >
        HARBIN
      </text>
      {/* Wheat ears */}
      <path d="M 46 118 L 44 124 M 74 118 L 76 124" stroke="#c9a227" strokeWidth="1.4" />
      <ellipse cx="45" cy="120" rx="1.8" ry="3" fill="#c9a227" stroke="none" />
      <ellipse cx="75" cy="120" rx="1.8" ry="3" fill="#c9a227" stroke="none" />
      <text
        x="60" y="124" textAnchor="middle" fill="#e8c85a" fontSize="5.5"
        fontWeight="800" stroke="none" className="font-hand"
      >
        1900 臻藏
      </text>
      {/* Glass shine */}
      <path d="M 47 76 L 47 82" stroke="#ffffff" strokeWidth="2.5" opacity="0.6" />
      {/* Sparkles */}
      <path d="M 94 60 L 94 70 M 89 65 L 99 65" strokeWidth="1.5" />
      <path d="M 24 108 L 24 116 M 20 112 L 28 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
