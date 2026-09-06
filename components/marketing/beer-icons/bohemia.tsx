import { BeerIconFrame } from "./doodle";

type BohemiaIconProps = {
  className?: string;
};

/**
 * Batch2 Bohemia（波西米亚）— from the mug-side photo: brown bottle, silver
 * foil neck with red emblem medallion, DARK label with gold border + gold
 * "Bohemia clásica".
 */
export function BohemiaIcon({ className }: BohemiaIconProps) {
  return (
    <BeerIconFrame typeLabel="皮爾森" filterId="bohemia-wobble" label="Bohemia" className={className}>
      {/* Open mouth */}
      <path d="M 52 16 L 68 16 L 68 24 L 52 24 Z" fill="#3d1e0c" />
      {/* Brown body */}
      <path d="M 53 24 L 53 58 Q 53 66 46 70 L 42 74 L 42 134 Q 42 144 52 144 L 68 144 Q 78 144 78 134 L 78 74 L 74 70 Q 67 66 67 58 L 67 24 Z" fill="#6b3410" />
      <path d="M 61 72 L 74 70 Q 78 74 78 78 L 78 134 Q 78 144 68 144 L 61 144 Z" fill="#47220a" stroke="none" opacity="0.9" />
      {/* Silver foil neck + red medallion */}
      <path d="M 53 24 L 67 24 L 67 54 L 53 54 Z" fill="#c9ced6" stroke="none" />
      <circle cx="60" cy="42" r="5.5" fill="#c8102e" strokeWidth="1.2" />
      <circle cx="60" cy="42" r="2" fill="none" stroke="#f6c90e" strokeWidth="1.2" />
      {/* Dark label, gold border */}
      <path d="M 42 86 L 78 86 L 78 126 L 42 126 Z" fill="#2a1a0c" />
      <path d="M 42 86 L 78 86 L 78 126 L 42 126 Z" fill="none" stroke="#d9a521" strokeWidth="1.6" />
      {/* Red emblem circle */}
      <circle cx="70" cy="96" r="5" fill="#c8102e" strokeWidth="1.2" />
      <circle cx="70" cy="96" r="1.8" fill="none" stroke="#f6c90e" strokeWidth="1" />
      <text
        x="58" y="108" textAnchor="middle" fill="#e8c85a" fontSize="10"
        fontWeight="800" fontStyle="italic" stroke="none" className="font-hand"
      >
        Bohemia
      </text>
      <text
        x="58" y="118" textAnchor="middle" fill="#e8c85a" fontSize="6.5"
        fontWeight="700" fontStyle="italic" stroke="none" className="font-hand"
      >
        clásica
      </text>
      {/* Glass shine */}
      <path d="M 47 76 L 47 84" stroke="#ffffff" strokeWidth="2.5" opacity="0.5" />
      {/* Sparkles */}
      <path d="M 94 60 L 94 70 M 89 65 L 99 65" strokeWidth="1.5" />
      <path d="M 24 108 L 24 116 M 20 112 L 28 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
