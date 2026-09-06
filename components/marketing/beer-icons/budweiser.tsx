import { BeerIconFrame } from "./doodle";

type BudweiserIconProps = {
  className?: string;
};

/**
 * Batch1 Budweiser（百威）— from the real can photo: white can, giant black
 * script, red base band with white "ANHEUSER-BUSCH", AB crest medallion.
 */
export function BudweiserIcon({ className }: BudweiserIconProps) {
  return (
    <BeerIconFrame typeLabel="美式拉格" filterId="budweiser-wobble" label="Budweiser" className={className}>
      {/* White can */}
      <path
        d="M 38 34 L 38 132 Q 38 142 48 142 L 72 142 Q 82 142 82 132 L 82 34 Z"
        fill="#f4f2ec"
      />
      <path d="M 70 34 L 82 34 L 82 132 Q 82 142 72 142 L 70 142 Z" fill="#ddd8c8" stroke="none" />
      {/* Lid */}
      <ellipse cx="60" cy="34" rx="22" ry="6" fill="#d8d5c9" />
      <ellipse cx="60" cy="32" rx="14" ry="3.5" fill="#efede4" />
      {/* AB crest medallion */}
      <circle cx="60" cy="58" r="13" fill="none" strokeWidth="2" />
      <circle cx="60" cy="58" r="10" fill="none" strokeWidth="1.2" opacity="0.7" />
      <text
        x="60" y="63" textAnchor="middle" fill="var(--border)" fontSize="10"
        fontWeight="800" stroke="none" className="font-hand"
      >
        AB
      </text>
      {/* Red side tabs */}
      <path d="M 38 66 L 46 66 L 46 72 L 38 72 Z" fill="#c8102e" stroke="none" />
      <path d="M 74 66 L 82 66 L 82 72 L 74 72 Z" fill="#c8102e" stroke="none" />
      {/* Giant black script */}
      <text
        x="60" y="98" textAnchor="middle" fill="#1a1a1a" fontSize="19"
        fontWeight="800" fontStyle="italic" stroke="none" className="font-hand"
      >
        Budweiser
      </text>
      {/* Red base band */}
      <path d="M 38 112 L 82 112 L 82 128 L 38 128 Z" fill="#c8102e" stroke="none" />
      <text
        x="60" y="123" textAnchor="middle" fill="#ffffff" fontSize="7"
        fontWeight="800" stroke="none" className="font-hand"
      >
        ANHEUSER-BUSCH
      </text>
      {/* Shine */}
      <path d="M 44 76 L 44 108" stroke="#ffffff" strokeWidth="2.5" opacity="0.9" />
      {/* Sparkles */}
      <path d="M 96 52 L 96 62 M 91 57 L 101 57" strokeWidth="1.5" />
      <path d="M 24 108 L 24 116 M 20 112 L 28 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
