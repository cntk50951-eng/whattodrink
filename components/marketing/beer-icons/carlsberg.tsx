import { BeerIconFrame } from "./doodle";

type CarlsbergIconProps = {
  className?: string;
};

/**
 * Batch1 Carlsberg（嘉士伯）— from the real bottle photo: green glass with
 * embossed "Carlsberg" script on the body, only a tiny neck tag (no body
 * label), green cap.
 */
export function CarlsbergIcon({ className }: CarlsbergIconProps) {
  return (
    <BeerIconFrame typeLabel="皮爾森" filterId="carlsberg-wobble" label="Carlsberg" className={className}>
      {/* Green cap */}
      <path d="M 52 16 L 68 16 L 68 26 L 52 26 Z" fill="#0b5c2c" />
      {/* Neck + body */}
      <path d="M 53 26 L 53 58 Q 53 66 46 70 L 42 74 L 42 134 Q 42 144 52 144 L 68 144 Q 78 144 78 134 L 78 74 L 74 70 Q 67 66 67 58 L 67 26 Z" fill="#1a7a3f" />
      <path d="M 61 72 L 74 70 Q 78 74 78 78 L 78 134 Q 78 144 68 144 L 61 144 Z" fill="#0e5a2a" stroke="none" opacity="0.9" />
      {/* Tiny neck tag */}
      <path d="M 53 32 L 67 32 L 67 48 L 53 48 Z" fill="#f6f1e2" stroke="none" />
      <path d="M 53 35 L 67 35" stroke="#1a7a3f" strokeWidth="1.6" />
      <text
        x="60" y="45" textAnchor="middle" fill="#1a7a3f" fontSize="5"
        fontWeight="800" stroke="none" className="font-hand"
      >
        CARLSBERG
      </text>
      {/* Embossed script on glass */}
      <text
        x="60" y="102" textAnchor="middle" fill="none" stroke="#4cb06a"
        strokeWidth="1.6" fontSize="14" fontWeight="800" fontStyle="italic"
        opacity="0.9" className="font-hand" transform="rotate(-4 60 102)"
      >
        Carlsberg
      </text>
      <text
        x="60" y="118" textAnchor="middle" fill="none" stroke="#4cb06a"
        strokeWidth="1.2" fontSize="7" fontWeight="700"
        opacity="0.8" className="font-hand"
      >
        1847
      </text>
      {/* Glass shine */}
      <path d="M 47 76 L 47 90" stroke="#ffffff" strokeWidth="2.5" opacity="0.7" />
      <path d="M 47 124 L 47 134" stroke="#ffffff" strokeWidth="2.5" opacity="0.5" />
      {/* Sparkles */}
      <path d="M 94 60 L 94 70 M 89 65 L 99 65" strokeWidth="1.5" />
      <path d="M 24 108 L 24 116 M 20 112 L 28 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
