import { BeerIconFrame } from "./doodle";

type CoronaIconProps = {
  className?: string;
};

/**
 * UR2.4 v3 Corona Extra — from the real bottle photo: clear glass showing
 * gold beer, gold crown cap, split label (white top: navy gothic "Corona
 * Extra"; navy bottom: gold crown + "LA CERVEZA MAS FINA" medallion),
 * lime wedge on the neck (signature serve).
 */
export function CoronaIcon({ className }: CoronaIconProps) {
  return (
    <BeerIconFrame typeLabel="淡拉格" filterId="corona-wobble" label="Corona Extra" className={className}>
      {/* Gold crown cap */}
      <path d="M 52 14 L 68 14 L 68 26 L 52 26 Z" fill="#d9a521" />
      <path d="M 52 18 L 68 18 M 52 22 L 68 22" strokeWidth="1" opacity="0.6" />
      {/* Clear bottle */}
      <path d="M 53 26 L 53 58 Q 53 66 46 70 L 42 74 L 42 134 Q 42 144 52 144 L 68 144 Q 78 144 78 134 L 78 74 L 74 70 Q 67 66 67 58 L 67 26 Z" fill="#fdf6e3" opacity="0.95" />
      {/* Golden beer */}
      <path d="M 55 66 Q 55 70 49 74 L 46 77 L 46 132 Q 46 140 54 140 L 66 140 Q 74 140 74 132 L 74 77 L 71 74 Q 65 70 65 66 Z" fill="#f0b429" stroke="none" />
      {/* Label — white top */}
      <path d="M 42 90 L 78 90 L 78 110 L 42 110 Z" fill="#fffdf5" />
      <text
        x="60" y="101" textAnchor="middle" fill="#1b2a5e" fontSize="12"
        fontWeight="800" stroke="none" className="font-hand"
      >
        Corona
      </text>
      <text
        x="60" y="109" textAnchor="middle" fill="#1b2a5e" fontSize="7"
        fontWeight="800" stroke="none" className="font-hand"
      >
        Extra
      </text>
      {/* Label — navy bottom */}
      <path d="M 42 110 L 78 110 L 78 128 L 42 128 Z" fill="#1b2a5e" stroke="none" />
      {/* Gold crown */}
      <path
        d="M 54 117 L 54 113 L 57 115 L 60 111 L 63 115 L 66 113 L 66 117 Z"
        fill="#d9a521" strokeWidth="1.2"
      />
      {/* Gold medallion */}
      <ellipse cx="60" cy="123" rx="7" ry="4" fill="none" stroke="#d9a521" strokeWidth="1.4" />
      {/* Lime wedge in neck */}
      <path d="M 67 32 A 11 11 0 0 1 78 46 L 67 42 Z" fill="#7bc043" />
      <path d="M 67 32 A 11 11 0 0 1 78 46" stroke="#3e8e2f" strokeWidth="2.5" />
      <path d="M 69 37 L 73 43" stroke="#3e8e2f" strokeWidth="1.2" />
      {/* Glass shine */}
      <path d="M 47 78 L 47 88" stroke="#ffffff" strokeWidth="2.5" opacity="0.9" />
      {/* Sparkles */}
      <path d="M 94 58 L 94 68 M 89 63 L 99 63" strokeWidth="1.5" />
      <path d="M 24 108 L 24 116 M 20 112 L 28 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
