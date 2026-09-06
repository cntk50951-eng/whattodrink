import { BeerIconFrame } from "./doodle";

type SkolIconProps = {
  className?: string;
};

/**
 * Batch2 Skol（斯库尔）— from the beach-table photo: silver/white can, gold
 * ring medallion with big red "SKOL" script, "DESCE REDONDO" header.
 */
export function SkolIcon({ className }: SkolIconProps) {
  return (
    <BeerIconFrame typeLabel="皮爾森" filterId="skol-wobble" label="Skol" className={className}>
      {/* Silver can */}
      <path
        d="M 38 34 L 38 132 Q 38 142 48 142 L 72 142 Q 82 142 82 132 L 82 34 Z"
        fill="#e3e6ea"
      />
      <path d="M 70 34 L 82 34 L 82 132 Q 82 142 72 142 L 70 142 Z" fill="#c2c6cd" stroke="none" />
      {/* Gold lid */}
      <ellipse cx="60" cy="34" rx="22" ry="6" fill="#d9a521" />
      <ellipse cx="60" cy="32" rx="14" ry="3.5" fill="#e8c85a" />
      <text
        x="60" y="52" textAnchor="middle" fill="#5c430a" fontSize="5.5"
        fontWeight="800" stroke="none" className="font-hand"
      >
        DESCE REDONDO
      </text>
      {/* Gold-ring medallion + red script */}
      <ellipse cx="60" cy="86" rx="20" ry="28" fill="none" stroke="#c9a227" strokeWidth="2.5" />
      <ellipse cx="60" cy="86" rx="17" ry="25" fill="none" stroke="#c9a227" strokeWidth="1" opacity="0.7" />
      <text
        x="60" y="96" textAnchor="middle" fill="#c8102e" fontSize="19"
        fontWeight="800" fontStyle="italic" stroke="none" className="font-hand"
      >
        SKOL
      </text>
      <text
        x="60" y="108" textAnchor="middle" fill="#5c430a" fontSize="5.5"
        fontWeight="800" stroke="none" className="font-hand"
      >
        CERVEJA PILSEN
      </text>
      {/* Shine */}
      <path d="M 44 58 L 44 110" stroke="#ffffff" strokeWidth="2.5" opacity="0.8" />
      {/* Sparkles */}
      <path d="M 96 52 L 96 62 M 91 57 L 101 57" strokeWidth="1.5" />
      <path d="M 24 108 L 24 116 M 20 112 L 28 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
