import { BeerIconFrame } from "./doodle";

type AntarcticaIconProps = {
  className?: string;
};

/**
 * Batch3 Antarctica Original — yellow label, red ANTARCTICA tab, white panel
 * with teal frame + diagonal stripe, blue PILSEN diamond, two-penguin badge.
 * Stylised likeness, not the trademark artwork.
 */
export function AntarcticaIcon({ className }: AntarcticaIconProps) {
  return (
    <BeerIconFrame typeLabel="淡拉格" filterId="antarctica-wobble" label="Antarctica Original" className={className}>
      {/* Open mouth + brown bottle */}
      <path d="M 52 16 L 68 16 L 68 26 L 52 26 Z" fill="#5a2d0c" />
      <path d="M 53 26 L 53 58 Q 53 66 46 70 L 42 74 L 42 134 Q 42 144 52 144 L 68 144 Q 78 144 78 134 L 78 74 L 74 70 Q 67 66 67 58 L 67 26 Z" fill="#7a3f14" />
      <path d="M 61 72 L 74 70 Q 78 74 78 78 L 78 134 Q 78 144 68 144 L 61 144 Z" fill="#5a2d0c" stroke="none" opacity="0.9" />
      {/* Yellow label field */}
      <path d="M 42 76 L 78 76 L 78 136 L 42 136 Z" fill="#f6c231" stroke="none" />
      {/* Red header tab */}
      <path d="M 42 76 L 78 76 L 78 88 L 42 88 Z" fill="#d93030" stroke="none" />
      <text x="60" y="85" textAnchor="middle" fill="#ffffff" fontSize="7" fontWeight="800" stroke="none" className="font-hand">
        ANTARCTICA
      </text>
      {/* White panel + teal frame + diagonal stripe */}
      <path d="M 46 92 L 74 92 L 74 132 L 46 132 Z" fill="#ffffff" stroke="#0b8d8f" strokeWidth="1.6" />
      <path d="M 46 96 L 74 126" stroke="#0b8d8f" strokeWidth="3" />
      <text x="60" y="108" textAnchor="middle" fill="#d93030" fontSize="9" fontWeight="800" stroke="none" className="font-hand">
        ORIGINAL
      </text>
      {/* Blue PILSEN diamond */}
      <path d="M 60 112 L 67 119 L 60 126 L 53 119 Z" fill="#1c4f9c" stroke="none" />
      <text x="60" y="121.5" textAnchor="middle" fill="#ffffff" fontSize="3.6" fontWeight="800" stroke="none" className="font-hand">
        PILSEN
      </text>
      {/* Penguin badge */}
      <circle cx="70" cy="128" r="3" fill="#d93030" stroke="none" />
      <circle cx="69" cy="127.4" r="1" fill="#ffffff" stroke="none" />
      <circle cx="71" cy="127.4" r="1" fill="#1a1a1a" stroke="none" />
      {/* Shine + sparkles */}
      <path d="M 47 78 L 47 88" stroke="#ffffff" strokeWidth="2" opacity="0.7" />
      <path d="M 94 60 L 94 70 M 89 65 L 99 65" strokeWidth="1.5" />
      <path d="M 24 108 L 24 116 M 20 112 L 28 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
