import { BeerIconFrame } from "./doodle";

type RedStripeIconProps = {
  className?: string;
};

/**
 * Batch4 Red Stripe — stubby brown bottle, white painted label, bold diagonal
 * red stripe + heavy RED STRIPE wordmark (1965 stubby identity).
 * Stylised likeness, not the trademark artwork.
 */
export function RedStripeIcon({ className }: RedStripeIconProps) {
  return (
    <BeerIconFrame typeLabel="淡拉格" filterId="redstripe-wobble" label="Red Stripe" className={className}>
      {/* Stubby: short neck + squat body */}
      <path d="M 54 24 L 66 24 L 66 38 L 54 38 Z" fill="#5a2d0c" />
      <path d="M 54 38 Q 54 50 40 56 Q 32 60 32 70 L 32 132 Q 32 144 44 144 L 76 144 Q 88 144 88 132 L 88 70 Q 88 60 80 56 Q 66 50 66 38 Z" fill="#6b3410" />
      <path d="M 68 58 L 78 62 Q 88 65 88 72 L 88 132 Q 88 144 76 144 L 68 144 Z" fill="#4e2408" stroke="none" />
      {/* White painted label */}
      <path d="M 34 74 L 86 74 L 86 136 L 34 136 Z" fill="#fffdf5" stroke="none" />
      {/* Diagonal red stripe */}
      <path d="M 34 116 L 86 88 L 86 100 L 34 128 Z" fill="#c8102e" stroke="none" />
      <text x="60" y="96" textAnchor="middle" fill="#1a1a1a" fontSize="10" fontWeight="800" stroke="none" className="font-hand">
        RED STRIPE
      </text>
      <text x="60" y="106" textAnchor="middle" fill="#ffffff" fontSize="6" fontWeight="800" stroke="none" className="font-hand">
        JAMAICA
      </text>
      <path d="M 94 56 L 94 66 M 89 61 L 99 61" strokeWidth="1.5" />
      <path d="M 24 108 L 24 116 M 20 112 L 28 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
