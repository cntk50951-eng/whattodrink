import { BeerIconFrame } from "./doodle";

type ItaipavaIconProps = {
  className?: string;
};

/**
 * Batch3 Itaipava Pilsen — red-dominant label (post-2024 rebrand: red owns the
 * brand, white = lightness, gold touch), crown-of-three-glasses mark.
 * Stylised likeness, not the trademark artwork.
 */
export function ItaipavaIcon({ className }: ItaipavaIconProps) {
  return (
    <BeerIconFrame typeLabel="淡拉格" filterId="itaipava-wobble" label="Itaipava Pilsen" className={className}>
      <path d="M 52 16 L 68 16 L 68 26 L 52 26 Z" fill="#5a2d0c" />
      <path d="M 53 26 L 53 58 Q 53 66 46 70 L 42 74 L 42 134 Q 42 144 52 144 L 68 144 Q 78 144 78 134 L 78 74 L 74 70 Q 67 66 67 58 L 67 26 Z" fill="#7a3f14" />
      <path d="M 61 72 L 74 70 Q 78 74 78 78 L 78 134 Q 78 144 68 144 L 61 144 Z" fill="#5a2d0c" stroke="none" opacity="0.9" />
      {/* Red label field + gold rules */}
      <path d="M 42 76 L 78 76 L 78 136 L 42 136 Z" fill="#c8102e" stroke="none" />
      <path d="M 42 79 L 78 79 M 42 133 L 78 133" stroke="#d9a521" strokeWidth="1.4" />
      {/* Crown of three glasses */}
      <path d="M 50 88 L 50 96 Q 50 99 53 99 L 55 99 L 55 103 L 65 103 L 65 99 L 67 99 Q 70 99 70 96 L 70 88 Z" fill="#f6c231" stroke="none" />
      <path d="M 54 91 L 54 95 M 60 91 L 60 95 M 66 91 L 66 95" stroke="#c8102e" strokeWidth="1.2" />
      <text x="60" y="116" textAnchor="middle" fill="#ffffff" fontSize="8.5" fontWeight="800" stroke="none" className="font-hand">
        ITAIPAVA
      </text>
      <text x="60" y="125" textAnchor="middle" fill="#f6c231" fontSize="6" fontWeight="800" stroke="none" className="font-hand">
        PILSEN
      </text>
      <path d="M 47 78 L 47 88" stroke="#ffffff" strokeWidth="2" opacity="0.5" />
      <path d="M 94 60 L 94 70 M 89 65 L 99 65" strokeWidth="1.5" />
      <path d="M 24 108 L 24 116 M 20 112 L 28 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
