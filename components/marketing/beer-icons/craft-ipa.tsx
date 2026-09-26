import { BeerIconFrame } from "./doodle";

type CraftIpaIconProps = {
  className?: string;
};

/**
 * Batch3a Craft IPA — generic pour (no single brand owns「本地精釀 IPA」):
 * tulip glass, amber-copper body, white foam cap, green hop-cone mark.
 * Marked 演繹版 in the backlog note; stylised, no trademark.
 */
export function CraftIpaIcon({ className }: CraftIpaIconProps) {
  return (
    <BeerIconFrame typeLabel="印度淡艾" filterId="ipa-wobble" label="Craft IPA" className={className}>
      {/* Stem + foot */}
      <path d="M 57 96 L 57 128 M 63 96 L 63 128" strokeWidth="2.5" />
      <ellipse cx="60" cy="134" rx="18" ry="5" fill="#eef0f3" />
      {/* Tulip bowl outline */}
      <path
        d="M 46 36 L 74 36 Q 72 44 70 50 Q 80 60 78 74 Q 76 90 60 96 Q 44 90 42 74 Q 40 60 50 50 Q 48 44 46 36 Z"
        fill="#f6f1e2"
        opacity="0.55"
      />
      {/* Amber pour */}
      <path
        d="M 49 52 Q 43 62 44 74 Q 45 88 60 93 Q 75 88 76 74 Q 77 62 71 52 Z"
        fill="#d97b29"
        stroke="none"
      />
      <path
        d="M 66 54 Q 72 62 72 74 Q 72 86 62 91 Q 70 88 74 78 Q 76 66 70 54 Z"
        fill="#a85a17"
        stroke="none"
      />
      {/* Foam cap */}
      <ellipse cx="60" cy="50" rx="13" ry="6" fill="#fffdf5" stroke="none" />
      <circle cx="52" cy="46" r="4" fill="#fffdf5" stroke="none" />
      <circle cx="68" cy="46" r="3.4" fill="#fffdf5" stroke="none" />
      {/* Hop-cone mark on the bowl */}
      <path
        d="M 60 62 Q 68 70 66 80 Q 64 88 60 90 Q 56 88 54 80 Q 52 70 60 62 Z"
        fill="#3f7d2c"
        strokeWidth="1.6"
      />
      <path d="M 60 62 L 60 90 M 55 70 L 65 70 M 54 77 L 66 77 M 56 84 L 64 84" stroke="#2c5a1f" strokeWidth="1.2" />
      <path d="M 60 62 Q 60 58 63 56" stroke="#3f7d2c" strokeWidth="1.6" />
      {/* Rising bubbles */}
      <circle cx="52" cy="84" r="1.4" fill="#f6f1e2" stroke="none" />
      <circle cx="68" cy="80" r="1.2" fill="#f6f1e2" stroke="none" />
      <circle cx="60" cy="72" r="1" fill="#f6f1e2" stroke="none" />
      {/* Sparkles */}
      <path d="M 94 60 L 94 70 M 89 65 L 99 65" strokeWidth="1.5" />
      <path d="M 24 108 L 24 116 M 20 112 L 28 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
