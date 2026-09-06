import { BeerIconFrame } from "./doodle";

type BudLightIconProps = {
  className?: string;
};

/**
 * Batch1 Bud Light（百威淡啤）— from the real can photo: blue can, white
 * block "BUD LIGHT", embossed AB medallion on top.
 */
export function BudLightIcon({ className }: BudLightIconProps) {
  return (
    <BeerIconFrame typeLabel="淡拉格" filterId="budlight-wobble" label="Bud Light" className={className}>
      {/* Blue can */}
      <path
        d="M 38 34 L 38 132 Q 38 142 48 142 L 72 142 Q 82 142 82 132 L 82 34 Z"
        fill="#1b3fa0"
      />
      <path d="M 70 34 L 82 34 L 82 132 Q 82 142 72 142 L 70 142 Z" fill="#122a70" stroke="none" />
      {/* Lid */}
      <ellipse cx="60" cy="34" rx="22" ry="6" fill="#8fa0d0" />
      <ellipse cx="60" cy="32" rx="14" ry="3.5" fill="#b9c4e4" />
      {/* Embossed medallion */}
      <circle cx="60" cy="56" r="10" fill="none" stroke="#8fa0d0" strokeWidth="1.6" opacity="0.9" />
      <text
        x="60" y="60" textAnchor="middle" fill="#8fa0d0" fontSize="8"
        fontWeight="800" stroke="none" className="font-hand"
      >
        AB
      </text>
      {/* White block type */}
      <text
        x="60" y="90" textAnchor="middle" fill="#ffffff" fontSize="16"
        fontWeight="800" stroke="none" className="font-hand"
      >
        BUD
      </text>
      <text
        x="60" y="110" textAnchor="middle" fill="#ffffff" fontSize="16"
        fontWeight="800" stroke="none" className="font-hand"
      >
        LIGHT
      </text>
      <text
        x="60" y="126" textAnchor="middle" fill="#b9c4e4" fontSize="6.5"
        fontWeight="700" stroke="none" className="font-hand"
      >
        百威淡啤
      </text>
      {/* Shine */}
      <path d="M 44 62 L 44 106" stroke="#ffffff" strokeWidth="2.5" opacity="0.5" />
      {/* Sparkles */}
      <path d="M 96 52 L 96 62 M 91 57 L 101 57" strokeWidth="1.5" />
      <path d="M 24 108 L 24 116 M 20 112 L 28 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
