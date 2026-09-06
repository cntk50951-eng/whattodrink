import { BeerIconFrame } from "./doodle";

type TsingtaoIconProps = {
  className?: string;
};

/**
 * UR2.4 v3 Tsingtao Classic — from the real bottle photo: green glass with
 * embossed shoulder, tiny neck tag, big OVAL medallion (gold rim, red ring,
 * green field, "SINCE 1903", blue roundel with white pavilion + waves,
 * arched white "TSINGTAO", white 青島啤酒).
 */
export function TsingtaoIcon({ className }: TsingtaoIconProps) {
  return (
    <BeerIconFrame typeLabel="淡拉格" filterId="tsingtao-wobble" label="Tsingtao Classic" className={className}>
      {/* Open mouth */}
      <path d="M 52 16 L 68 16 L 68 26 L 52 26 Z" fill="#0b5c2c" />
      {/* Neck + body */}
      <path d="M 53 26 L 53 58 Q 53 66 46 70 L 42 74 L 42 134 Q 42 144 52 144 L 68 144 Q 78 144 78 134 L 78 74 L 74 70 Q 67 66 67 58 L 67 26 Z" fill="#12803f" />
      <path d="M 61 72 L 74 70 Q 78 74 78 78 L 78 134 Q 78 144 68 144 L 61 144 Z" fill="#0b5c2c" stroke="none" opacity="0.9" />
      {/* Tiny neck tag */}
      <path d="M 53 34 L 67 34 L 67 46 L 53 46 Z" fill="#0a4d26" stroke="none" />
      <path d="M 53 37 L 67 37" stroke="#c8102e" strokeWidth="1.4" />
      {/* Oval medallion — gold rim + red ring + green field */}
      <ellipse cx="60" cy="106" rx="20" ry="24" fill="#d9a521" />
      <ellipse cx="60" cy="106" rx="18" ry="22" fill="#c8102e" />
      <ellipse cx="60" cy="106" rx="15.5" ry="19.5" fill="#0a4d26" />
      <text
        x="60" y="93" textAnchor="middle" fill="#f6f1e2" fontSize="4.5"
        fontWeight="800" stroke="none" className="font-hand"
      >
        SINCE 1903
      </text>
      {/* Blue roundel — white pavilion + waves */}
      <circle cx="60" cy="100" r="6.5" fill="#1c6fb8" strokeWidth="1.4" />
      <path d="M 56.5 99 L 63.5 99 L 62.5 97 L 57.5 97 Z" fill="#ffffff" stroke="none" />
      <path d="M 55.5 97 L 64.5 97 L 60 94.5 Z" fill="#ffffff" stroke="none" />
      <path d="M 56 102 Q 58 101 60 102 Q 62 103 64 102" stroke="#ffffff" strokeWidth="1" />
      {/* Arched wordmark */}
      <text
        x="60" y="114" textAnchor="middle" fill="#ffffff" fontSize="8.5"
        fontWeight="800" stroke="none" className="font-hand"
      >
        TSINGTAO
      </text>
      <text
        x="60" y="121" textAnchor="middle" fill="#f6f1e2" fontSize="6"
        fontWeight="800" stroke="none" className="font-hand"
      >
        青島啤酒
      </text>
      {/* Glass shine */}
      <path d="M 47 76 L 47 86" stroke="#ffffff" strokeWidth="2.5" opacity="0.7" />
      <path d="M 47 130 L 47 136" stroke="#ffffff" strokeWidth="2.5" opacity="0.5" />
      {/* Sparkles */}
      <path d="M 94 60 L 94 70 M 89 65 L 99 65" strokeWidth="1.5" />
      <path d="M 24 108 L 24 116 M 20 112 L 28 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
