import { BeerIconFrame } from "./doodle";

type AndesIconProps = {
  className?: string;
};

/**
 * Batch3 Andes Origen Rubia — white label, red ANDES, minimalist black
 * ridgeline + snow (Mendoza). Stylised likeness, not the trademark artwork.
 */
export function AndesIcon({ className }: AndesIconProps) {
  return (
    <BeerIconFrame typeLabel="淡拉格" filterId="andes-wobble" label="Andes Origen" className={className}>
      <path d="M 52 16 L 68 16 L 68 26 L 52 26 Z" fill="#5a2d0c" />
      <path d="M 53 26 L 53 58 Q 53 66 46 70 L 42 74 L 42 134 Q 42 144 52 144 L 68 144 Q 78 144 78 134 L 78 74 L 74 70 Q 67 66 67 58 L 67 26 Z" fill="#7a3f14" />
      <path d="M 61 72 L 74 70 Q 78 74 78 78 L 78 134 Q 78 144 68 144 L 61 144 Z" fill="#5a2d0c" stroke="none" opacity="0.9" />
      {/* White label */}
      <path d="M 42 76 L 78 76 L 78 136 L 42 136 Z" fill="#fffdf5" stroke="none" />
      {/* Minimalist ridgeline + snow */}
      <path d="M 44 100 L 52 90 L 58 96 L 64 86 L 76 100" fill="none" stroke="#1a1a1a" strokeWidth="1.8" />
      <circle cx="52" cy="90" r="1.4" fill="#1a1a1a" stroke="none" />
      <circle cx="64" cy="86" r="1.4" fill="#1a1a1a" stroke="none" />
      <circle cx="70" cy="94" r="1" fill="#9fc4e8" stroke="none" />
      <circle cx="48" cy="95" r="1" fill="#9fc4e8" stroke="none" />
      <text x="60" y="116" textAnchor="middle" fill="#c8102e" fontSize="10" fontWeight="800" stroke="none" className="font-hand">
        ANDES
      </text>
      <text x="60" y="126" textAnchor="middle" fill="#1a1a1a" fontSize="5.5" fontWeight="700" stroke="none" className="font-hand">
        ORIGEN · RUBIA
      </text>
      <path d="M 47 78 L 47 88" stroke="#ffffff" strokeWidth="2" opacity="0.5" />
      <path d="M 94 60 L 94 70 M 89 65 L 99 65" strokeWidth="1.5" />
      <path d="M 24 108 L 24 116 M 20 112 L 28 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
