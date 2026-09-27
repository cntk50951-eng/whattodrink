import { BeerIconFrame } from "./doodle";

type TonaIconProps = {
  className?: string;
};

/**
 * Batch4 Toña — white rounded-square label, red curved TOÑA, green palms +
 * three volcanoes + rail perspective, brown bottle. Stylised, no trademark copy.
 */
export function TonaIcon({ className }: TonaIconProps) {
  return (
    <BeerIconFrame typeLabel="淡拉格" filterId="tona-wobble" label="Tona" className={className}>
      <path d="M 52 16 L 68 16 L 68 26 L 52 26 Z" fill="#fffdf5" />
      <path d="M 53 26 L 53 58 Q 53 66 46 70 L 42 74 L 42 134 Q 42 144 52 144 L 68 144 Q 78 144 78 134 L 78 74 L 74 70 Q 67 66 67 58 L 67 26 Z" fill="#7a3f14" />
      <path d="M 61 72 L 74 70 Q 78 74 78 78 L 78 134 Q 78 144 68 144 L 61 144 Z" fill="#5a2d0c" stroke="none" opacity="0.9" />
      {/* Rounded-square white label */}
      <path d="M 44 78 L 76 78 Q 78 78 78 82 L 78 130 Q 78 134 74 134 L 46 134 Q 42 134 42 130 L 42 82 Q 42 78 46 78 Z" fill="#fffdf5" stroke="#2e7d46" strokeWidth="1.4" />
      {/* Three volcanoes */}
      <path d="M 48 104 L 53 96 L 58 104 Z M 57 104 L 62 94 L 67 104 Z M 66 104 L 70 98 L 74 104 Z" fill="#2e7d46" stroke="none" />
      {/* Palms */}
      <path d="M 48 104 L 48 96 M 48 98 Q 45 96 44 97 M 48 98 Q 51 96 52 97" stroke="#2e7d46" strokeWidth="1.2" />
      <path d="M 72 104 L 72 96 M 72 98 Q 69 96 68 97 M 72 98 Q 75 96 76 97" stroke="#2e7d46" strokeWidth="1.2" />
      <text x="60" y="118" textAnchor="middle" fill="#c8102e" fontSize="10" fontWeight="800" stroke="none" className="font-hand">
        TOÑA
      </text>
      <text x="60" y="128" textAnchor="middle" fill="#2e7d46" fontSize="5" fontWeight="700" stroke="none" className="font-hand">
        NICARAGUA · 1977
      </text>
      <path d="M 94 60 L 94 70 M 89 65 L 99 65" strokeWidth="1.5" />
      <path d="M 24 108 L 24 116 M 20 112 L 28 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
