import { BeerIconFrame } from "./doodle";

type YebisuIconProps = {
  className?: string;
};

/**
 * UR2.4 v3 Yebisu — from the real lineup photo: GOLD flagship can, arched
 * "YEBISU TRADITIONAL BREW / BORN 1887", Ebisu-sama with fishing rod over
 * the red tai, white "Premium YEBISU / ALL MALT BEER".
 */
export function YebisuIcon({ className }: YebisuIconProps) {
  return (
    <BeerIconFrame filterId="yebisu-wobble" label="Yebisu" className={className}>
      {/* Gold can */}
      <path
        d="M 38 34 L 38 132 Q 38 142 48 142 L 72 142 Q 82 142 82 132 L 82 34 Z"
        fill="#dca92c"
      />
      <path d="M 70 34 L 82 34 L 82 132 Q 82 142 72 142 L 70 142 Z" fill="#b9862f" stroke="none" />
      {/* Lid */}
      <ellipse cx="60" cy="34" rx="22" ry="6" fill="#f0d089" />
      <ellipse cx="60" cy="32" rx="14" ry="3.5" fill="#e3bd63" />
      {/* Arched header */}
      <text
        x="60" y="48" textAnchor="middle" fill="#5c430a" fontSize="6"
        fontWeight="800" stroke="none" className="font-hand"
      >
        YEBISU TRADITIONAL BREW
      </text>
      {/* Ebisu-sama with rod */}
      <circle cx="55" cy="60" r="5.5" fill="none" strokeWidth="2" />
      <path d="M 48 82 Q 49 70 55 68 Q 61 70 62 82 Z" strokeWidth="2" />
      <path d="M 61 72 L 76 56" strokeWidth="2" />
      <path d="M 76 56 L 76 64" strokeWidth="1.5" />
      {/* Red tai on the line */}
      <ellipse cx="76" cy="70" rx="4" ry="6.5" fill="#c8102e" strokeWidth="1.6" />
      <path d="M 76 76.5 L 72.5 81 L 79.5 81 Z" fill="#c8102e" strokeWidth="1.2" />
      <circle cx="76" cy="67.5" r="1" fill="#fffdf5" stroke="none" />
      {/* White wordmark block */}
      <text
        x="60" y="98" textAnchor="middle" fill="#fffdf5" fontSize="8"
        fontWeight="700" fontStyle="italic" stroke="none" className="font-hand"
      >
        Premium
      </text>
      <text
        x="60" y="114" textAnchor="middle" fill="#fffdf5" fontSize="15"
        fontWeight="800" stroke="none" className="font-hand"
      >
        YEBISU
      </text>
      <text
        x="60" y="126" textAnchor="middle" fill="#fffdf5" fontSize="6.5"
        fontWeight="800" stroke="none" className="font-hand"
      >
        ALL MALT BEER
      </text>
      {/* Shine */}
      <path d="M 45 52 L 45 88" stroke="#ffffff" strokeWidth="2.5" opacity="0.55" />
      {/* Sparkles */}
      <path d="M 96 52 L 96 62 M 91 57 L 101 57" strokeWidth="1.5" />
      <path d="M 24 108 L 24 116 M 20 112 L 28 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
