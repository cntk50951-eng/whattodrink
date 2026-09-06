import { BeerIconFrame } from "./doodle";

type CoorsLightIconProps = {
  className?: string;
};

/**
 * Batch1 Coors Light（酷姿淡啤）— from the real can photo: silver can, red
 * script, blue Rocky mountains, "BORN IN THE ROCKIES", blue "SUPER COLD" tab.
 */
export function CoorsLightIcon({ className }: CoorsLightIconProps) {
  return (
    <BeerIconFrame typeLabel="淡拉格" filterId="coorslight-wobble" label="Coors Light" className={className}>
      {/* Silver can */}
      <path
        d="M 38 34 L 38 132 Q 38 142 48 142 L 72 142 Q 82 142 82 132 L 82 34 Z"
        fill="#d5d8dc"
      />
      <path d="M 70 34 L 82 34 L 82 132 Q 82 142 72 142 L 70 142 Z" fill="#b3b7bd" stroke="none" />
      {/* Lid */}
      <ellipse cx="60" cy="34" rx="22" ry="6" fill="#e8eaee" />
      <ellipse cx="60" cy="32" rx="14" ry="3.5" fill="#d5d8dc" />
      {/* Red script */}
      <text
        x="60" y="66" textAnchor="middle" fill="#c8102e" fontSize="17"
        fontWeight="800" fontStyle="italic" stroke="none" className="font-hand"
      >
        Coors
      </text>
      <text
        x="60" y="80" textAnchor="middle" fill="#333333" fontSize="6.5"
        fontWeight="800" stroke="none" className="font-hand"
      >
        LIGHT · LAGER
      </text>
      {/* Blue Rockies */}
      <path
        d="M 38 108 L 48 92 L 54 100 L 62 88 L 70 102 L 75 96 L 82 108 L 82 124 L 38 124 Z"
        fill="#3a6ea5" stroke="none"
      />
      <path d="M 48 92 L 54 100 M 62 88 L 70 102" stroke="#ffffff" strokeWidth="1.4" />
      {/* Super cold tab */}
      <path d="M 48 126 L 72 126 L 72 134 L 48 134 Z" fill="#1c5fb8" stroke="none" />
      <text
        x="60" y="132" textAnchor="middle" fill="#ffffff" fontSize="5.5"
        fontWeight="800" stroke="none" className="font-hand"
      >
        SUPER COLD
      </text>
      {/* Cold drops */}
      <circle cx="44" cy="88" r="1.6" fill="#9fc4d8" stroke="none" />
      <circle cx="76" cy="84" r="1.4" fill="#9fc4d8" stroke="none" />
      {/* Shine */}
      <path d="M 44 70 L 44 86" stroke="#ffffff" strokeWidth="2.5" opacity="0.8" />
      {/* Sparkles */}
      <path d="M 96 52 L 96 62 M 91 57 L 101 57" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
