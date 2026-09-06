import { BeerIconFrame } from "./doodle";

type HeinekenIconProps = {
  className?: string;
};

/**
 * UR2.4 v3 Heineken — from the real bottle photo: open crimped lip (no cap),
 * red star + vertical white "Heineken" on the neck, big OVAL green label
 * (HEINEKEN ORIGINAL arch, red star on white medallion, white Heineken on
 * dark ribbon, PURE MALT LAGER arch, EST. 1873).
 */
export function HeinekenIcon({ className }: HeinekenIconProps) {
  return (
    <BeerIconFrame filterId="heineken-wobble" label="Heineken" className={className}>
      {/* Open crimped lip */}
      <path d="M 52 16 L 68 16 L 68 22 L 52 22 Z" fill="#0a5c2e" />
      <path d="M 52 25 L 68 25 M 52 28 L 68 28" strokeWidth="1.4" />
      {/* Neck + body */}
      <path d="M 53 30 L 53 58 Q 53 66 46 70 L 42 74 L 42 134 Q 42 144 52 144 L 68 144 Q 78 144 78 134 L 78 74 L 74 70 Q 67 66 67 58 L 67 30 Z" fill="#0e7a3d" />
      <path d="M 61 30 L 67 30 L 67 58 Q 67 66 74 70 L 78 74 L 78 134 Q 78 144 68 144 L 61 144 Z" fill="#0a5c2e" stroke="none" opacity="0.85" />
      {/* Red star on neck */}
      <path
        d="M 53 34 L 54.4 38 L 58.6 38.2 L 55.2 40.6 L 56.4 44.6 L 53 42.4 L 49.6 44.6 L 50.8 40.6 L 47.4 38.2 L 51.6 38 Z"
        fill="#e1251b" strokeWidth="1.2"
      />
      {/* Vertical neck type */}
      <text
        x="62" y="58" textAnchor="middle" fill="#ffffff" fontSize="8"
        fontWeight="800" stroke="none" className="font-hand"
        transform="rotate(90 62 44)"
      >
        Heineken
      </text>
      {/* Oval green label */}
      <ellipse cx="60" cy="106" rx="20" ry="26" fill="#0b5c2c" />
      <ellipse cx="60" cy="106" rx="17.5" ry="23.5" fill="none" stroke="#e8eaee" strokeWidth="1.4" />
      <text
        x="60" y="90" textAnchor="middle" fill="#e8eaee" fontSize="5.5"
        fontWeight="800" stroke="none" className="font-hand"
      >
        HEINEKEN ORIGINAL
      </text>
      {/* White medallion + red star */}
      <ellipse cx="60" cy="99" rx="9" ry="8" fill="#fffdf5" stroke="none" />
      <path
        d="M 60 93.5 L 61.5 97.5 L 65.8 97.7 L 62.4 100.2 L 63.6 104.2 L 60 101.9 L 56.4 104.2 L 57.6 100.2 L 54.2 97.7 L 58.5 97.5 Z"
        fill="#e1251b" strokeWidth="1"
      />
      {/* Dark ribbon + white Heineken */}
      <path d="M 43 106 L 77 106 L 77 116 L 43 116 Z" fill="#083d1f" stroke="none" />
      <text
        x="60" y="114" textAnchor="middle" fill="#ffffff" fontSize="9"
        fontWeight="800" stroke="none" className="font-hand"
      >
        Heineken
      </text>
      <text
        x="60" y="123" textAnchor="middle" fill="#e8eaee" fontSize="5.5"
        fontWeight="800" stroke="none" className="font-hand"
      >
        PURE MALT LAGER
      </text>
      {/* Glass shine */}
      <path d="M 47 76 L 47 86" stroke="#ffffff" strokeWidth="2.5" opacity="0.7" />
      {/* Sparkles */}
      <path d="M 94 60 L 94 70 M 89 65 L 99 65" strokeWidth="1.5" />
      <path d="M 24 108 L 24 116 M 20 112 L 28 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
