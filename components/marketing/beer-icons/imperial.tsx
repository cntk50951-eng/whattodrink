import { BeerIconFrame } from "./doodle";

type ImperialIconProps = {
  className?: string;
};

/**
 * Batch4 Imperial (Costa Rica) — yellow/black/red label, spread Aguilita eagle,
 * yellow cap. Aliases avoid bare "aguila" (that's the Colombian beer).
 * Stylised likeness, not the trademark artwork.
 */
export function ImperialIcon({ className }: ImperialIconProps) {
  return (
    <BeerIconFrame typeLabel="淡拉格" filterId="imperial-wobble" label="Imperial Costa Rica" className={className}>
      <path d="M 52 16 L 68 16 L 68 26 L 52 26 Z" fill="#f2c230" />
      <path d="M 53 26 L 53 58 Q 53 66 46 70 L 42 74 L 42 134 Q 42 144 52 144 L 68 144 Q 78 144 78 134 L 78 74 L 74 70 Q 67 66 67 58 L 67 26 Z" fill="#7a3f14" />
      <path d="M 61 72 L 74 70 Q 78 74 78 78 L 78 134 Q 78 144 68 144 L 61 144 Z" fill="#5a2d0c" stroke="none" opacity="0.9" />
      {/* Yellow label, black chief, red base */}
      <path d="M 42 76 L 78 76 L 78 136 L 42 136 Z" fill="#f2c230" stroke="none" />
      <path d="M 42 76 L 78 76 L 78 86 L 42 86 Z" fill="#1a1a1a" stroke="none" />
      <path d="M 42 128 L 78 128 L 78 136 L 42 136 Z" fill="#c8102e" stroke="none" />
      {/* Spread eagle */}
      <path d="M 46 104 Q 52 94 60 97 Q 68 94 74 104 Q 68 102 64 106 Q 62 112 60 112 Q 58 112 56 106 Q 52 102 46 104 Z" fill="#1a1a1a" stroke="none" />
      <circle cx="60" cy="101" r="1.2" fill="#f2c230" stroke="none" />
      <text x="60" y="84" textAnchor="middle" fill="#f2c230" fontSize="6.5" fontWeight="800" stroke="none" className="font-hand">
        IMPERIAL
      </text>
      <text x="60" y="123" textAnchor="middle" fill="#ffffff" fontSize="5" fontWeight="700" stroke="none" className="font-hand">
        DESDE 1924
      </text>
      <path d="M 94 60 L 94 70 M 89 65 L 99 65" strokeWidth="1.5" />
      <path d="M 24 108 L 24 116 M 20 112 L 28 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
