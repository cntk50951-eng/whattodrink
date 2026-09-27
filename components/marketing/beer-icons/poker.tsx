import { BeerIconFrame } from "./doodle";

type PokerIconProps = {
  className?: string;
};

/**
 * Batch4 Poker — green label, white POKER, four card-suit pips (naipes theme),
 * red rules. Reference is thin (label blogs only), suits are the core cue.
 * Stylised, no trademark copy.
 */
export function PokerIcon({ className }: PokerIconProps) {
  return (
    <BeerIconFrame typeLabel="淡拉格" filterId="poker-wobble" label="Poker" className={className}>
      <path d="M 52 16 L 68 16 L 68 26 L 52 26 Z" fill="#0b5c2c" />
      <path d="M 53 26 L 53 58 Q 53 66 46 70 L 42 74 L 42 134 Q 42 144 52 144 L 68 144 Q 78 144 78 134 L 78 74 L 74 70 Q 67 66 67 58 L 67 26 Z" fill="#12803f" />
      <path d="M 61 72 L 74 70 Q 78 74 78 78 L 78 134 Q 78 144 68 144 L 61 144 Z" fill="#0b5c2c" stroke="none" opacity="0.9" />
      {/* Green label + red rules */}
      <path d="M 42 76 L 78 76 L 78 136 L 42 136 Z" fill="#0e6b34" stroke="none" />
      <path d="M 42 79 L 78 79 M 42 133 L 78 133" stroke="#c8102e" strokeWidth="1.6" />
      {/* Four suit pips */}
      <path d="M 50 90 Q 47 86 50 84 Q 53 86 50 90 Q 47 94 50 96 Q 53 94 50 90 Z" fill="#ffffff" stroke="none" />
      <path d="M 58 88 L 62 88 L 60 93 Z" fill="#ffffff" stroke="none" />
      <circle cx="66" cy="88" r="2.4" fill="#c8102e" stroke="none" />
      <path d="M 70 88 L 74 88 L 72 93 Z" fill="#ffffff" stroke="none" />
      <text x="60" y="110" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="800" stroke="none" className="font-hand">
        POKER
      </text>
      <path d="M 48 115 L 72 115" stroke="#c8102e" strokeWidth="1.8" />
      <text x="60" y="126" textAnchor="middle" fill="#f6f1e2" fontSize="5.5" fontWeight="700" stroke="none" className="font-hand">
        CERVEZA · PILSEN
      </text>
      <path d="M 47 78 L 47 88" stroke="#ffffff" strokeWidth="2" opacity="0.6" />
      <path d="M 94 60 L 94 70 M 89 65 L 99 65" strokeWidth="1.5" />
      <path d="M 24 108 L 24 116 M 20 112 L 28 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
