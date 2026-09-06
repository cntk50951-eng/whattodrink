import { BeerIconFrame } from "./doodle";

type MillerLiteIconProps = {
  className?: string;
};

/**
 * Batch1 Miller Lite（米勒淡啤）— from the real can photo: dark navy can,
 * gold oval ring, white "Lite", red "Miller" script on top.
 */
export function MillerLiteIcon({ className }: MillerLiteIconProps) {
  return (
    <BeerIconFrame typeLabel="淡拉格" filterId="millerlite-wobble" label="Miller Lite" className={className}>
      {/* Navy can */}
      <path
        d="M 38 34 L 38 132 Q 38 142 48 142 L 72 142 Q 82 142 82 132 L 82 34 Z"
        fill="#1b2a6b"
      />
      <path d="M 70 34 L 82 34 L 82 132 Q 82 142 72 142 L 70 142 Z" fill="#111c4c" stroke="none" />
      {/* Lid */}
      <ellipse cx="60" cy="34" rx="22" ry="6" fill="#8a90b8" />
      <ellipse cx="60" cy="32" rx="14" ry="3.5" fill="#b3b8d4" />
      {/* Red script */}
      <text
        x="60" y="58" textAnchor="middle" fill="#c8102e" fontSize="11"
        fontWeight="800" fontStyle="italic" stroke="none" className="font-hand"
      >
        Miller
      </text>
      {/* Gold oval + white Lite */}
      <ellipse cx="60" cy="90" rx="19" ry="26" fill="none" stroke="#d9a521" strokeWidth="2.5" />
      <text
        x="60" y="100" textAnchor="middle" fill="#ffffff" fontSize="20"
        fontWeight="800" fontStyle="italic" stroke="none" className="font-hand"
      >
        Lite
      </text>
      <text
        x="60" y="126" textAnchor="middle" fill="#d9c27a" fontSize="6.5"
        fontWeight="700" stroke="none" className="font-hand"
      >
        米勒淡啤
      </text>
      {/* Shine */}
      <path d="M 44 62 L 44 106" stroke="#ffffff" strokeWidth="2.5" opacity="0.4" />
      {/* Sparkles */}
      <path d="M 96 52 L 96 62 M 91 57 L 101 57" strokeWidth="1.5" />
      <path d="M 24 108 L 24 116 M 20 112 L 28 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
