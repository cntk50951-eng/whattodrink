import { BeerIconFrame } from "./doodle";

type IndioIconProps = {
  className?: string;
};

/**
 * Batch2 Indio（印第欧）— from the tray photo: brown bottle, gold-striped
 * label, red "NO RETORNABLE" top band, oval Aztec warrior, dark-green band
 * with white "INDIO".
 */
export function IndioIcon({ className }: IndioIconProps) {
  return (
    <BeerIconFrame typeLabel="深色拉格" filterId="indio-wobble" label="Indio" className={className}>
      {/* Green cap (from photo) */}
      <path d="M 52 16 L 68 16 L 68 26 L 52 26 Z" fill="#0e5a2a" />
      {/* Brown body */}
      <path d="M 53 26 L 53 58 Q 53 66 46 70 L 42 74 L 42 134 Q 42 144 52 144 L 68 144 Q 78 144 78 134 L 78 74 L 74 70 Q 67 66 67 58 L 67 26 Z" fill="#6b3410" />
      <path d="M 61 72 L 74 70 Q 78 74 78 78 L 78 134 Q 78 144 68 144 L 61 144 Z" fill="#47220a" stroke="none" opacity="0.9" />
      {/* Gold label + red top band */}
      <path d="M 42 84 L 78 84 L 78 128 L 42 128 Z" fill="#d9a521" />
      <path d="M 42 84 L 78 84 L 78 92 L 42 92 Z" fill="#c8102e" stroke="none" />
      <text
        x="60" y="90" textAnchor="middle" fill="#ffffff" fontSize="5"
        fontWeight="800" stroke="none" className="font-hand"
      >
        NO RETORNABLE
      </text>
      {/* Warrior oval */}
      <ellipse cx="60" cy="102" rx="9" ry="8" fill="#f6f1e2" stroke="none" />
      <ellipse cx="60" cy="102" rx="9" ry="8" fill="none" stroke="#0e5a2a" strokeWidth="1.4" />
      <circle cx="60" cy="99" r="2.4" fill="#c8102e" stroke="none" />
      <path d="M 57 102 L 63 102 L 62 107 L 58 107 Z" fill="#0e5a2a" stroke="none" />
      {/* Green INDIO band */}
      <path d="M 42 112 L 78 112 L 78 124 L 42 124 Z" fill="#0e5a2a" stroke="none" />
      <text
        x="60" y="121" textAnchor="middle" fill="#ffffff" fontSize="9"
        fontWeight="800" stroke="none" className="font-hand"
      >
        INDIO
      </text>
      {/* Glass shine */}
      <path d="M 47 76 L 47 82" stroke="#ffffff" strokeWidth="2.5" opacity="0.5" />
      {/* Sparkles */}
      <path d="M 94 60 L 94 70 M 89 65 L 99 65" strokeWidth="1.5" />
      <path d="M 24 108 L 24 116 M 20 112 L 28 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
