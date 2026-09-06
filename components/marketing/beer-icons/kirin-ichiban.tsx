import { BeerIconFrame } from "./doodle";

type KirinIconProps = {
  className?: string;
};

/**
 * UR2.4 v3 Kirin Ichiban — from the real can photo: tall slim SILVER can,
 * gold kirin beast under arched "JAPAN'S PRIME BREW", red band with white
 * "KIRIN ICHIBAN", black 一番搾り, red-gold droplet, "FIRST PRESS".
 */
export function KirinIcon({ className }: KirinIconProps) {
  return (
    <BeerIconFrame typeLabel="淡拉格" filterId="kirin-wobble" label="Kirin Ichiban" className={className}>
      {/* Slim silver can */}
      <path
        d="M 42 30 L 42 132 Q 42 142 50 142 L 70 142 Q 78 142 78 132 L 78 30 Z"
        fill="#d5d8dc"
      />
      <path d="M 68 30 L 78 30 L 78 132 Q 78 142 70 142 L 68 142 Z" fill="#b3b7bd" stroke="none" />
      {/* Lid */}
      <ellipse cx="60" cy="30" rx="18" ry="5" fill="#e8eaee" />
      <ellipse cx="60" cy="28.5" rx="11" ry="3" fill="#d5d8dc" />
      {/* Arched gold line */}
      <text
        x="60" y="44" textAnchor="middle" fill="#a87c22" fontSize="6"
        fontWeight="800" stroke="none" className="font-hand"
      >
        JAPAN’S PRIME BREW
      </text>
      {/* Gold kirin beast */}
      <path
        d="M 48 62 Q 50 54 56 53 L 54 57 Q 60 55 64 58 L 70 56 L 67 60 Q 71 62 69 66 L 63 64 Q 60 68 55 67 L 50 68 Z"
        fill="#c9992e" strokeWidth="1.6"
      />
      <path d="M 52 68 L 50 73 M 57 68 L 57 73 M 63 67 L 65 72" strokeWidth="1.6" />
      {/* Red band */}
      <path d="M 42 78 L 78 78 L 78 92 L 42 92 Z" fill="#c8102e" stroke="none" />
      <text
        x="60" y="88" textAnchor="middle" fill="#ffffff" fontSize="8"
        fontWeight="800" stroke="none" className="font-hand"
      >
        KIRIN ICHIBAN
      </text>
      {/* Black 一番搾り */}
      <text
        x="60" y="108" textAnchor="middle" fill="#222222" fontSize="13"
        fontWeight="800" stroke="none" className="font-hand"
      >
        一番搾り
      </text>
      {/* Droplet emblem */}
      <path
        d="M 60 112 Q 64 118 60 122 Q 56 118 60 112 Z"
        fill="#c8102e" strokeWidth="1.4"
      />
      <circle cx="60" cy="118" r="1.4" fill="#d9a521" stroke="none" />
      <text
        x="60" y="133" textAnchor="middle" fill="#a87c22" fontSize="6"
        fontWeight="800" stroke="none" className="font-hand"
      >
        FIRST PRESS
      </text>
      {/* Shine */}
      <path d="M 47 50 L 47 74" stroke="#ffffff" strokeWidth="2.5" opacity="0.8" />
      {/* Sparkles */}
      <path d="M 94 52 L 94 62 M 89 57 L 99 57" strokeWidth="1.5" />
      <path d="M 26 108 L 26 116 M 22 112 L 30 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
