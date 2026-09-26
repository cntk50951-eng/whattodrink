import { BeerIconFrame } from "./doodle";

type Dassai45IconProps = {
  className?: string;
};

/**
 * Batch3a Dassai 45 — from the official livery: tall slender clear bottle,
 * navy cap, white label with vertical indigo 獺祭 calligraphy, red hanko seal,
 * small DASSAI 45 line. Stylised likeness, not the trademark artwork.
 */
export function Dassai45Icon({ className }: Dassai45IconProps) {
  return (
    <BeerIconFrame typeLabel="大吟釀" filterId="dassai-wobble" label="Dassai 45" className={className}>
      {/* Navy cap + neck */}
      <path d="M 53 12 L 67 12 L 67 28 L 53 28 Z" fill="#1c3f7d" />
      <path d="M 55 28 L 55 50 L 65 50 L 65 28 Z" fill="#cfdcea" />
      {/* Slender body with pale sake fill */}
      <path
        d="M 55 50 Q 54 56 47 59 Q 42 61 42 68 L 42 132 Q 42 144 52 144 L 68 144 Q 78 144 78 132 L 78 68 Q 78 61 73 59 Q 66 56 65 50 Z"
        fill="#cfdcea"
      />
      <path d="M 68 62 L 73 64 Q 78 66 78 71 L 78 132 Q 78 144 68 144 L 66 144 Z" fill="#a9bed6" stroke="none" />
      {/* White label */}
      <path d="M 44 78 L 76 78 L 76 132 L 44 132 Z" fill="#fbfaf5" stroke="none" />
      {/* Vertical indigo calligraphy */}
      <text
        x="55" y="100" textAnchor="middle" fill="#1c4f9c" fontSize="16"
        fontWeight="800" stroke="none" className="font-hand"
      >
        獺
      </text>
      <text
        x="55" y="119" textAnchor="middle" fill="#1c4f9c" fontSize="16"
        fontWeight="800" stroke="none" className="font-hand"
      >
        祭
      </text>
      {/* Red hanko seal */}
      <path d="M 63 84 L 72 84 L 72 93 L 63 93 Z" fill="#c8102e" stroke="none" />
      <path d="M 65 86 L 70 86 M 65 89 L 70 89 M 65 91 L 70 91" stroke="#fbfaf5" strokeWidth="1" />
      {/* Small latin line */}
      <text
        x="68" y="106" textAnchor="middle" fill="#1a1a1a" fontSize="5"
        fontWeight="700" stroke="none" className="font-hand"
      >
        DASSAI
      </text>
      <text
        x="68" y="126" textAnchor="middle" fill="#1a1a1a" fontSize="7"
        fontWeight="800" stroke="none" className="font-hand"
      >
        45
      </text>
      {/* Glass shine */}
      <path d="M 46 62 L 46 74" stroke="#ffffff" strokeWidth="2" opacity="0.8" />
      {/* Sparkles */}
      <path d="M 94 60 L 94 70 M 89 65 L 99 65" strokeWidth="1.5" />
      <path d="M 24 108 L 24 116 M 20 112 L 28 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
