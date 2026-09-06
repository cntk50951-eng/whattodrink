import { BeerIconFrame } from "./doodle";

type PacificoIconProps = {
  className?: string;
};

/**
 * Batch2 Pacifico Clara（太平洋）— from the beach photo: brown bottle, YELLOW
 * label (red "Cerveza del Pacifico", navy "PACIFICO", red "CLARA",
 * lifebuoy + anchor emblem).
 */
export function PacificoIcon({ className }: PacificoIconProps) {
  return (
    <BeerIconFrame typeLabel="皮爾森" filterId="pacifico-wobble" label="Pacifico" className={className}>
      {/* Open mouth */}
      <path d="M 52 16 L 68 16 L 68 24 L 52 24 Z" fill="#3d1e0c" />
      {/* Brown body */}
      <path d="M 53 24 L 53 58 Q 53 66 46 70 L 42 74 L 42 134 Q 42 144 52 144 L 68 144 Q 78 144 78 134 L 78 74 L 74 70 Q 67 66 67 58 L 67 24 Z" fill="#7a3f14" />
      <path d="M 61 72 L 74 70 Q 78 74 78 78 L 78 134 Q 78 144 68 144 L 61 144 Z" fill="#542a0c" stroke="none" opacity="0.9" />
      {/* Yellow label */}
      <path d="M 42 86 L 78 86 L 78 128 L 42 128 Z" fill="#f6c90e" />
      <path d="M 42 86 L 78 86 L 78 128 L 42 128 Z" fill="none" stroke="#c8102e" strokeWidth="1.4" />
      <text
        x="60" y="94" textAnchor="middle" fill="#c8102e" fontSize="5"
        fontWeight="800" stroke="none" className="font-hand"
      >
        Cerveza del Pacifico
      </text>
      <text
        x="60" y="106" textAnchor="middle" fill="#1b2a5e" fontSize="10"
        fontWeight="800" stroke="none" className="font-hand"
      >
        PACIFICO
      </text>
      {/* Lifebuoy */}
      <circle cx="48" cy="114" r="4" fill="none" stroke="#c8102e" strokeWidth="1.8" />
      <circle cx="48" cy="114" r="1.4" fill="#1b2a5e" stroke="none" />
      <text
        x="63" y="118" textAnchor="middle" fill="#c8102e" fontSize="8"
        fontWeight="800" stroke="none" className="font-hand"
      >
        CLARA
      </text>
      {/* Anchor */}
      <path d="M 72 110 L 72 120 M 68 113 L 76 113 M 68 118 Q 72 122 76 118" stroke="#1b2a5e" strokeWidth="1.4" />
      {/* Glass shine */}
      <path d="M 47 76 L 47 84" stroke="#ffffff" strokeWidth="2.5" opacity="0.5" />
      {/* Sparkles */}
      <path d="M 94 60 L 94 70 M 89 65 L 99 65" strokeWidth="1.5" />
      <path d="M 24 108 L 24 116 M 20 112 L 28 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
