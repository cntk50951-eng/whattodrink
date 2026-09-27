import { BeerIconFrame } from "./doodle";

type PolarIconProps = {
  className?: string;
};

/**
 * Batch4 Cerveza Polar — blue/white label, polar-bear mascot (Pedroso),
 * snow dots. Stylised likeness, not the trademark artwork.
 */
export function PolarIcon({ className }: PolarIconProps) {
  return (
    <BeerIconFrame typeLabel="淡拉格" filterId="polar-wobble" label="Cerveza Polar" className={className}>
      <path d="M 52 16 L 68 16 L 68 26 L 52 26 Z" fill="#1c3f7d" />
      <path d="M 53 26 L 53 58 Q 53 66 46 70 L 42 74 L 42 134 Q 42 144 52 144 L 68 144 Q 78 144 78 134 L 78 74 L 74 70 Q 67 66 67 58 L 67 26 Z" fill="#7a3f14" />
      <path d="M 61 72 L 74 70 Q 78 74 78 78 L 78 134 Q 78 144 68 144 L 61 144 Z" fill="#5a2d0c" stroke="none" opacity="0.9" />
      {/* Blue label, white chief */}
      <path d="M 42 76 L 78 76 L 78 136 L 42 136 Z" fill="#1c4f9c" stroke="none" />
      <path d="M 42 76 L 78 76 L 78 88 L 42 88 Z" fill="#fffdf5" stroke="none" />
      <text x="60" y="85" textAnchor="middle" fill="#1c4f9c" fontSize="8.5" fontWeight="800" stroke="none" className="font-hand">
        POLAR
      </text>
      {/* Bear: round body + head + ears */}
      <ellipse cx="60" cy="108" rx="9" ry="11" fill="#fffdf5" stroke="none" />
      <circle cx="60" cy="96" r="6" fill="#fffdf5" stroke="none" />
      <circle cx="55.5" cy="91.5" r="1.8" fill="#fffdf5" stroke="none" />
      <circle cx="64.5" cy="91.5" r="1.8" fill="#fffdf5" stroke="none" />
      <circle cx="58" cy="96" r="1" fill="#1a1a1a" stroke="none" />
      <circle cx="62" cy="96" r="1" fill="#1a1a1a" stroke="none" />
      <ellipse cx="60" cy="99" rx="1.8" ry="1.4" fill="#1a1a1a" stroke="none" />
      {/* Snow dots */}
      <circle cx="48" cy="118" r="1.2" fill="#9fc4e8" stroke="none" />
      <circle cx="72" cy="114" r="1.2" fill="#9fc4e8" stroke="none" />
      <text x="60" y="130" textAnchor="middle" fill="#ffffff" fontSize="5.5" fontWeight="700" stroke="none" className="font-hand">
        PILSEN · 1941
      </text>
      <path d="M 94 60 L 94 70 M 89 65 L 99 65" strokeWidth="1.5" />
      <path d="M 24 108 L 24 116 M 20 112 L 28 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
