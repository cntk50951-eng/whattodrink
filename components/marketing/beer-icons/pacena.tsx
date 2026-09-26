import { BeerIconFrame } from "./doodle";

type PacenaIconProps = {
  className?: string;
};

/**
 * Batch3 Paceña — red aluminium cap (620cc La Paz seal), red/white label with
 * gold medal, Bolivian tricolor band, Illimani triangle. Stylised, no trademark.
 */
export function PacenaIcon({ className }: PacenaIconProps) {
  return (
    <BeerIconFrame typeLabel="淡拉格" filterId="pacena-wobble" label="Pacena" className={className}>
      {/* Red cap + brown bottle */}
      <path d="M 52 14 L 68 14 L 68 28 L 52 28 Z" fill="#c8102e" />
      <path d="M 53 28 L 53 58 Q 53 66 46 70 L 42 74 L 42 134 Q 42 144 52 144 L 68 144 Q 78 144 78 134 L 78 74 L 74 70 Q 67 66 67 58 L 67 28 Z" fill="#7a3f14" />
      <path d="M 61 72 L 74 70 Q 78 74 78 78 L 78 134 Q 78 144 68 144 L 61 144 Z" fill="#5a2d0c" stroke="none" opacity="0.9" />
      {/* White label, red frame */}
      <path d="M 42 76 L 78 76 L 78 136 L 42 136 Z" fill="#fffdf5" stroke="#c8102e" strokeWidth="1.6" />
      {/* Tricolor band */}
      <path d="M 42 78 L 78 78 L 78 82.5 L 42 82.5 Z" fill="#c8102e" stroke="none" />
      <path d="M 42 82.5 L 78 82.5 L 78 87 L 42 87 Z" fill="#f2c230" stroke="none" />
      <path d="M 42 87 L 78 87 L 78 91.5 L 42 91.5 Z" fill="#2e7d46" stroke="none" />
      {/* Illimani triangle + wordmark */}
      <path d="M 48 108 L 56 96 L 64 108 Z" fill="#1c4f9c" stroke="none" />
      <path d="M 48 108 L 56 96 L 60 101 L 58 108 Z" fill="#ffffff" stroke="none" />
      <text x="64" y="106" textAnchor="middle" fill="#c8102e" fontSize="8" fontWeight="800" stroke="none" className="font-hand">
        PACEÑA
      </text>
      {/* Gold medal */}
      <circle cx="60" cy="120" r="7" fill="none" stroke="#d9a521" strokeWidth="1.8" />
      <path d="M 56 120 L 64 120 M 60 116 L 60 124" stroke="#d9a521" strokeWidth="1.2" />
      <text x="60" y="133" textAnchor="middle" fill="#1a1a1a" fontSize="5" fontWeight="700" stroke="none" className="font-hand">
        DESDE 1886
      </text>
      <path d="M 94 60 L 94 70 M 89 65 L 99 65" strokeWidth="1.5" />
      <path d="M 24 108 L 24 116 M 20 112 L 28 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
