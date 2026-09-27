import { BeerIconFrame } from "./doodle";

type RegionalIconProps = {
  className?: string;
};

/**
 * Batch4 Regional Pilsen — amber bottle, red/white label, big 5° mark
 * (the only 5-degree Pilsen). Reference is thin (official product page only),
 * kept generic-honest. Stylised, no trademark copy.
 */
export function RegionalIcon({ className }: RegionalIconProps) {
  return (
    <BeerIconFrame typeLabel="淡拉格" filterId="regional-wobble" label="Regional Pilsen" className={className}>
      <path d="M 52 16 L 68 16 L 68 26 L 52 26 Z" fill="#5a2d0c" />
      <path d="M 53 26 L 53 58 Q 53 66 46 70 L 42 74 L 42 134 Q 42 144 52 144 L 68 144 Q 78 144 78 134 L 78 74 L 74 70 Q 67 66 67 58 L 67 26 Z" fill="#8a4a16" />
      <path d="M 61 72 L 74 70 Q 78 74 78 78 L 78 134 Q 78 144 68 144 L 61 144 Z" fill="#5a2d0c" stroke="none" opacity="0.9" />
      {/* White label, red frame */}
      <path d="M 42 76 L 78 76 L 78 136 L 42 136 Z" fill="#fffdf5" stroke="#c8102e" strokeWidth="1.6" />
      <text x="60" y="90" textAnchor="middle" fill="#c8102e" fontSize="7.5" fontWeight="800" stroke="none" className="font-hand">
        REGIONAL
      </text>
      {/* Big 5° medallion */}
      <circle cx="60" cy="106" r="10" fill="none" stroke="#c8102e" strokeWidth="2" />
      <text x="60" y="111" textAnchor="middle" fill="#c8102e" fontSize="12" fontWeight="800" stroke="none" className="font-hand">
        5°
      </text>
      <text x="60" y="126" textAnchor="middle" fill="#1a1a1a" fontSize="5.5" fontWeight="700" stroke="none" className="font-hand">
        PILSEN · MARACAIBO
      </text>
      <path d="M 47 78 L 47 88" stroke="#ffffff" strokeWidth="2" opacity="0.5" />
      <path d="M 94 60 L 94 70 M 89 65 L 99 65" strokeWidth="1.5" />
      <path d="M 24 108 L 24 116 M 20 112 L 28 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
