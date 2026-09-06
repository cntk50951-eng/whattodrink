import { BeerIconFrame } from "./doodle";

type ModeloIconProps = {
  className?: string;
};

/**
 * Batch1 Modelo Especial（莫德罗）— from the real bottle photo: squat clear
 * "stubby" bottle, gold foil neck wrap, white label with navy "Modelo",
 * gold lions, red "CERVEZA" header.
 */
export function ModeloIcon({ className }: ModeloIconProps) {
  return (
    <BeerIconFrame typeLabel="淡拉格" filterId="modelo-wobble" label="Modelo Especial" className={className}>
      {/* Clear stubby bottle */}
      <path d="M 50 30 L 50 62 Q 50 70 42 74 L 38 78 L 38 132 Q 38 144 50 144 L 70 144 Q 82 144 82 132 L 82 78 L 78 74 Q 70 70 70 62 L 70 30 Z" fill="#fdf6e3" opacity="0.95" />
      {/* Golden beer */}
      <path d="M 52 78 L 44 84 L 44 130 Q 44 140 52 140 L 68 140 Q 76 140 76 130 L 76 84 L 68 78 Z" fill="#f0b429" stroke="none" />
      {/* Gold foil neck */}
      <path d="M 50 30 L 70 30 L 70 58 L 50 58 Z" fill="#d9a521" stroke="none" />
      <path d="M 50 38 L 70 38 M 50 46 L 70 46" stroke="#a87c22" strokeWidth="1.2" />
      {/* White neck tag */}
      <path d="M 50 58 L 70 58 L 70 68 L 50 68 Z" fill="#fffdf5" stroke="none" />
      <circle cx="60" cy="63" r="3.4" fill="none" stroke="#1b2a5e" strokeWidth="1.2" />
      {/* White body label */}
      <path d="M 38 88 L 82 88 L 82 126 L 38 126 Z" fill="#fffdf5" />
      <text
        x="60" y="96" textAnchor="middle" fill="#c8102e" fontSize="5.5"
        fontWeight="800" stroke="none" className="font-hand"
      >
        CERVEZA
      </text>
      <text
        x="60" y="110" textAnchor="middle" fill="#1b2a5e" fontSize="11"
        fontWeight="800" stroke="none" className="font-hand"
      >
        Modelo
      </text>
      {/* Gold lions */}
      <ellipse cx="45" cy="106" rx="3" ry="5" fill="#d9a521" stroke="none" transform="rotate(-12 45 106)" />
      <ellipse cx="75" cy="106" rx="3" ry="5" fill="#d9a521" stroke="none" transform="rotate(12 75 106)" />
      <text
        x="60" y="120" textAnchor="middle" fill="#1b2a5e" fontSize="6.5"
        fontWeight="700" fontStyle="italic" stroke="none" className="font-hand"
      >
        especial
      </text>
      {/* Glass shine */}
      <path d="M 42 92 L 42 100" stroke="#ffffff" strokeWidth="2" opacity="0.9" />
      {/* Sparkles */}
      <path d="M 94 60 L 94 70 M 89 65 L 99 65" strokeWidth="1.5" />
      <path d="M 24 108 L 24 116 M 20 112 L 28 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
