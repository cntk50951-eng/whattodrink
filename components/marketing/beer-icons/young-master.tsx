import { BeerIconFrame } from "./doodle";

type YoungMasterIconProps = {
  className?: string;
};

/**
 * UR2.4 v3 Young Master Classic — from the official shop packshot: WHITE can,
 * navy arched "YOUNG MASTER", two red-ring 少/爺 circles, the signature RED
 * KUNG-FU PANTS + black cloth shoes, navy "CLASSIC / PALE ALE",
 * "BREWED IN HONG KONG", condensation drops.
 */
export function YoungMasterIcon({ className }: YoungMasterIconProps) {
  return (
    <BeerIconFrame filterId="youngmaster-wobble" label="Young Master" className={className}>
      {/* White can */}
      <path
        d="M 38 34 L 38 132 Q 38 142 48 142 L 72 142 Q 82 142 82 132 L 82 34 Z"
        fill="#f2f3f5"
      />
      <path d="M 70 34 L 82 34 L 82 132 Q 82 142 72 142 L 70 142 Z" fill="#d9dce1" stroke="none" />
      {/* Lid */}
      <ellipse cx="60" cy="34" rx="22" ry="6" fill="#c6cad1" />
      <ellipse cx="60" cy="32" rx="14" ry="3.5" fill="#e3e6ea" />
      {/* Navy arch header */}
      <text
        x="60" y="48" textAnchor="middle" fill="#1e3a6e" fontSize="7"
        fontWeight="800" stroke="none" className="font-hand"
      >
        YOUNG MASTER
      </text>
      {/* Red-ring 少 / 爺 circles */}
      <circle cx="52" cy="58" r="6.5" fill="#fffdf5" stroke="#c8102e" strokeWidth="2" />
      <circle cx="68" cy="58" r="6.5" fill="#fffdf5" stroke="#c8102e" strokeWidth="2" />
      <text
        x="52" y="61" textAnchor="middle" fill="#c8102e" fontSize="8"
        fontWeight="800" stroke="none" className="font-hand"
      >
        少
      </text>
      <text
        x="68" y="61" textAnchor="middle" fill="#c8102e" fontSize="8"
        fontWeight="800" stroke="none" className="font-hand"
      >
        爺
      </text>
      {/* Red kung-fu pants */}
      <path d="M 55 70 L 65 70 L 64 72 L 66 72 L 67 92 Q 67 96 63 95 L 62 96 Q 61 100 57 99 L 56 95 Q 52 96 52 92 L 53 72 L 55 72 Z" fill="#c8102e" strokeWidth="2" />
      <path d="M 55 70 L 65 70 L 65 73 L 55 73 Z" fill="#1e3a6e" stroke="none" />
      {/* Cloth shoes */}
      <ellipse cx="55" cy="101" rx="3" ry="4" fill="#1e3a6e" strokeWidth="1.6" transform="rotate(-12 55 101)" />
      <ellipse cx="63" cy="98" rx="3" ry="4" fill="#1e3a6e" strokeWidth="1.6" transform="rotate(14 63 98)" />
      {/* Navy CLASSIC block */}
      <text
        x="60" y="118" textAnchor="middle" fill="#1e3a6e" fontSize="12"
        fontWeight="800" stroke="none" className="font-hand"
      >
        CLASSIC
      </text>
      <text
        x="60" y="128" textAnchor="middle" fill="#1e3a6e" fontSize="6"
        fontWeight="800" stroke="none" className="font-hand"
      >
        PALE ALE · BREWED IN HONG KONG
      </text>
      {/* Condensation */}
      <circle cx="44" cy="88" r="1.8" fill="#9fc4d8" stroke="none" />
      <circle cx="76" cy="80" r="1.5" fill="#9fc4d8" stroke="none" />
      <circle cx="74" cy="106" r="2" fill="#9fc4d8" stroke="none" />
      <circle cx="45" cy="108" r="1.4" fill="#9fc4d8" stroke="none" />
      {/* Sparkles */}
      <path d="M 96 52 L 96 62 M 91 57 L 101 57" strokeWidth="1.5" />
      <path d="M 24 108 L 24 116 M 20 112 L 28 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
