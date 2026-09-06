import { BeerIconFrame } from "./doodle";

type TecateIconProps = {
  className?: string;
};

/**
 * Batch2 Tecate（特卡特）— from the real bottle photo: brown glass, RED label
 * + red neck band, white "TECATE", black eagle-T crest.
 */
export function TecateIcon({ className }: TecateIconProps) {
  return (
    <BeerIconFrame typeLabel="淡拉格" filterId="tecate-wobble" label="Tecate" className={className}>
      {/* Open mouth */}
      <path d="M 52 16 L 68 16 L 68 24 L 52 24 Z" fill="#3d1e0c" />
      {/* Brown body */}
      <path d="M 53 24 L 53 58 Q 53 66 46 70 L 42 74 L 42 134 Q 42 144 52 144 L 68 144 Q 78 144 78 134 L 78 74 L 74 70 Q 67 66 67 58 L 67 24 Z" fill="#6b3410" />
      <path d="M 61 72 L 74 70 Q 78 74 78 78 L 78 134 Q 78 144 68 144 L 61 144 Z" fill="#47220a" stroke="none" opacity="0.9" />
      {/* Red neck band + crest */}
      <path d="M 53 32 L 67 32 L 67 50 L 53 50 Z" fill="#c8102e" stroke="none" />
      <path d="M 53 32 L 67 32 M 53 50 L 67 50" stroke="#f6c90e" strokeWidth="1.2" />
      <path d="M 56 41 L 64 41 L 62 47 L 58 47 Z" fill="#1a1a1a" strokeWidth="1.2" />
      <text
        x="60" y="44.5" textAnchor="middle" fill="#ffffff" fontSize="5"
        fontWeight="800" stroke="none" className="font-hand"
      >
        T
      </text>
      {/* Red body label */}
      <path d="M 42 86 L 78 86 L 78 128 L 42 128 Z" fill="#c8102e" />
      {/* Eagle crest */}
      <path d="M 55 92 L 65 92 L 63 99 L 57 99 Z" fill="#1a1a1a" strokeWidth="1.2" />
      <text
        x="60" y="97.5" textAnchor="middle" fill="#ffffff" fontSize="5"
        fontWeight="800" stroke="none" className="font-hand"
      >
        T
      </text>
      <text
        x="60" y="114" textAnchor="middle" fill="#ffffff" fontSize="12"
        fontWeight="800" stroke="none" className="font-hand"
      >
        TECATE
      </text>
      <path d="M 48 120 L 72 120" stroke="#f6c90e" strokeWidth="1.4" />
      {/* Glass shine */}
      <path d="M 47 76 L 47 84" stroke="#ffffff" strokeWidth="2.5" opacity="0.5" />
      {/* Sparkles */}
      <path d="M 94 60 L 94 70 M 89 65 L 99 65" strokeWidth="1.5" />
      <path d="M 24 108 L 24 116 M 20 112 L 28 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
