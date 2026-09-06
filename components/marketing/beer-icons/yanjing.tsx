import { BeerIconFrame } from "./doodle";

type YanjingIconProps = {
  className?: string;
};

/**
 * Batch1 Yanjing（燕京）— from the fridge photo: green "大绿棒子" bottle,
 * cream label with red 燕京啤酒 + black "Yanjing Beer" + gold crest, white
 * neck wrap with red micro + gold ring.
 */
export function YanjingIcon({ className }: YanjingIconProps) {
  return (
    <BeerIconFrame typeLabel="淡拉格" filterId="yanjing-wobble" label="Yanjing" className={className}>
      {/* Red cap */}
      <path d="M 52 16 L 68 16 L 68 26 L 52 26 Z" fill="#c8102e" />
      {/* Green body */}
      <path d="M 53 26 L 53 58 Q 53 66 46 70 L 42 74 L 42 134 Q 42 144 52 144 L 68 144 Q 78 144 78 134 L 78 74 L 74 70 Q 67 66 67 58 L 67 26 Z" fill="#1a7a3f" />
      <path d="M 61 72 L 74 70 Q 78 74 78 78 L 78 134 Q 78 144 68 144 L 61 144 Z" fill="#0e5a2a" stroke="none" opacity="0.9" />
      {/* White neck wrap + gold ring */}
      <path d="M 53 32 L 67 32 L 67 54 L 53 54 Z" fill="#f6f1e2" stroke="none" />
      <path d="M 53 52 L 67 52" stroke="#c9a227" strokeWidth="2" />
      <text
        x="60" y="44" textAnchor="middle" fill="#c8102e" fontSize="5.5"
        fontWeight="800" stroke="none" className="font-hand"
        transform="rotate(90 60 43)"
      >
        燕京啤酒
      </text>
      {/* Cream label */}
      <path d="M 42 86 L 78 86 L 78 126 L 42 126 Z" fill="#f6f1e2" />
      {/* Gold crest */}
      <ellipse cx="60" cy="94" rx="5" ry="4" fill="none" stroke="#c9a227" strokeWidth="1.6" />
      <path d="M 57 94 L 63 94 M 60 91 L 60 97" stroke="#c9a227" strokeWidth="1.4" />
      <text
        x="60" y="106" textAnchor="middle" fill="#c8102e" fontSize="9"
        fontWeight="800" stroke="none" className="font-hand"
      >
        燕京啤酒
      </text>
      <text
        x="60" y="117" textAnchor="middle" fill="#1a1a1a" fontSize="7.5"
        fontWeight="800" fontStyle="italic" stroke="none" className="font-hand"
      >
        Yanjing Beer
      </text>
      {/* Glass shine */}
      <path d="M 47 76 L 47 84" stroke="#ffffff" strokeWidth="2.5" opacity="0.7" />
      {/* Sparkles */}
      <path d="M 94 60 L 94 70 M 89 65 L 99 65" strokeWidth="1.5" />
      <path d="M 24 108 L 24 116 M 20 112 L 28 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
