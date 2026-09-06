import { BeerIconFrame } from "./doodle";

type AsahiIconProps = {
  className?: string;
};

/**
 * UR2.4 v3 Asahi Super Dry — from the real can photo: silver body, black
 * octagonal label frame, GIANT black "Asahi" script, red "SUPER DRY" above,
 * black 生 + red katakana below, "KARAKUCHI" collar, 350ml base.
 */
export function AsahiIcon({ className }: AsahiIconProps) {
  return (
    <BeerIconFrame filterId="asahi-wobble" label="Asahi Super Dry" className={className}>
      {/* Silver can body */}
      <path
        d="M 38 34 L 38 132 Q 38 142 48 142 L 72 142 Q 82 142 82 132 L 82 34 Z"
        fill="#c9ced6"
      />
      <path d="M 70 34 L 82 34 L 82 132 Q 82 142 72 142 L 70 142 Z" fill="#a7adb8" stroke="none" />
      {/* Lid */}
      <ellipse cx="60" cy="34" rx="22" ry="6" fill="#e8eaee" />
      <ellipse cx="60" cy="32" rx="14" ry="3.5" fill="#c9ced6" />
      {/* Collar text */}
      <text
        x="60" y="48" textAnchor="middle" fill="#333333" fontSize="7"
        fontWeight="700" stroke="none" className="font-hand"
      >
        KARAKUCHI
      </text>
      {/* Black octagonal label frame */}
      <path
        d="M 48 52 L 72 52 L 80 60 L 80 122 L 72 130 L 48 130 L 40 122 L 40 60 Z"
        fill="#eef0f3"
      />
      {/* Red SUPER DRY */}
      <text
        x="60" y="70" textAnchor="middle" fill="#c8102e" fontSize="9"
        fontWeight="800" stroke="none" className="font-hand"
      >
        SUPER “DRY”
      </text>
      {/* Giant black script */}
      <text
        x="60" y="96" textAnchor="middle" fill="#1a1a1a" fontSize="24"
        fontWeight="800" fontStyle="italic" stroke="none" className="font-hand"
      >
        Asahi
      </text>
      {/* Black 生 */}
      <text
        x="60" y="114" textAnchor="middle" fill="#1a1a1a" fontSize="17"
        fontWeight="800" stroke="none" className="font-hand"
      >
        生
      </text>
      {/* Red katakana */}
      <text
        x="60" y="126" textAnchor="middle" fill="#c8102e" fontSize="8"
        fontWeight="800" stroke="none" className="font-hand"
      >
        スーパードライ
      </text>
      {/* Base */}
      <text
        x="60" y="139" textAnchor="middle" fill="#333333" fontSize="7"
        fontWeight="700" stroke="none" className="font-hand"
      >
        350ml
      </text>
      {/* Shine */}
      <path d="M 44 56 L 44 128" stroke="#ffffff" strokeWidth="2.5" opacity="0.7" />
      {/* Sparkles */}
      <path d="M 96 52 L 96 62 M 91 57 L 101 57" strokeWidth="1.5" />
      <path d="M 24 108 L 24 116 M 20 112 L 28 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
