import { BeerIconFrame } from "./doodle";

type SapporoIconProps = {
  className?: string;
};

/**
 * Batch1 Sapporo（札幌 Draft）— silver can, gold star, black "SAPPORO"
 * wordmark, "DRAFT BEER" micro. The polar-star shelf read.
 */
export function SapporoIcon({ className }: SapporoIconProps) {
  return (
    <BeerIconFrame typeLabel="拉格" filterId="sapporo-wobble" label="Sapporo" className={className}>
      {/* Silver can */}
      <path
        d="M 38 34 L 38 132 Q 38 142 48 142 L 72 142 Q 82 142 82 132 L 82 34 Z"
        fill="#cfd3d8"
      />
      <path d="M 70 34 L 82 34 L 82 132 Q 82 142 72 142 L 70 142 Z" fill="#adb2b9" stroke="none" />
      {/* Lid */}
      <ellipse cx="60" cy="34" rx="22" ry="6" fill="#e8eaee" />
      <ellipse cx="60" cy="32" rx="14" ry="3.5" fill="#cfd3d8" />
      {/* Gold star */}
      <path
        d="M 60 48 L 62.4 55 L 69.8 55.2 L 63.8 59.4 L 65.9 66.4 L 60 62.4 L 54.1 66.4 L 56.2 59.4 L 50.2 55.2 L 57.6 55 Z"
        fill="#e8b923" strokeWidth="1.6"
      />
      {/* Black wordmark */}
      <text
        x="60" y="88" textAnchor="middle" fill="#1a1a1a" fontSize="13"
        fontWeight="800" stroke="none" className="font-hand"
      >
        SAPPORO
      </text>
      <text
        x="60" y="100" textAnchor="middle" fill="#1a1a1a" fontSize="9"
        fontWeight="800" stroke="none" className="font-hand"
      >
        生
      </text>
      {/* Blue band */}
      <path d="M 38 110 L 82 110 L 82 124 L 38 124 Z" fill="#1e3a6e" stroke="none" />
      <text
        x="60" y="120" textAnchor="middle" fill="#ffffff" fontSize="7.5"
        fontWeight="800" stroke="none" className="font-hand"
      >
        DRAFT BEER
      </text>
      {/* Shine */}
      <path d="M 44 70 L 44 106" stroke="#ffffff" strokeWidth="2.5" opacity="0.8" />
      {/* Sparkles */}
      <path d="M 96 52 L 96 62 M 91 57 L 101 57" strokeWidth="1.5" />
      <path d="M 24 108 L 24 116 M 20 112 L 28 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
