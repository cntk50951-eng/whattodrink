import { BeerIconFrame } from "./doodle";

type VictoriaIconProps = {
  className?: string;
};

/**
 * Batch2 Victoria（维多利亚／墨）— from the beach photo: brown bottle, CREAM
 * label with red "Victoria" script, Gambrinus king emblem, "CERVECERIA MODELO".
 */
export function VictoriaIcon({ className }: VictoriaIconProps) {
  return (
    <BeerIconFrame typeLabel="維也納拉格" filterId="victoria-wobble" label="Victoria" className={className}>
      {/* Open mouth */}
      <path d="M 52 16 L 68 16 L 68 24 L 52 24 Z" fill="#3d1e0c" />
      {/* Brown body */}
      <path d="M 53 24 L 53 58 Q 53 66 46 70 L 42 74 L 42 134 Q 42 144 52 144 L 68 144 Q 78 144 78 134 L 78 74 L 74 70 Q 67 66 67 58 L 67 24 Z" fill="#7a3f14" />
      <path d="M 61 72 L 74 70 Q 78 74 78 78 L 78 134 Q 78 144 68 144 L 61 144 Z" fill="#542a0c" stroke="none" opacity="0.9" />
      {/* Cream label */}
      <path d="M 42 86 L 78 86 L 78 128 L 42 128 Z" fill="#f6f1e2" />
      <path d="M 42 86 L 78 86 L 78 128 L 42 128 Z" fill="none" stroke="#c8102e" strokeWidth="1.2" />
      <text
        x="60" y="101" textAnchor="middle" fill="#c8102e" fontSize="11"
        fontWeight="800" fontStyle="italic" stroke="none" className="font-hand"
      >
        Victoria
      </text>
      {/* Gambrinus king emblem */}
      <circle cx="60" cy="110" r="5" fill="none" stroke="#c9a227" strokeWidth="1.4" />
      <path d="M 57 110 L 63 110 L 62 107 L 58 107 Z" fill="#c9a227" stroke="none" />
      <circle cx="60" cy="108.5" r="1" fill="#c8102e" stroke="none" />
      <path d="M 58 111 L 58 113.5 M 62 111 L 62 113.5" stroke="#c9a227" strokeWidth="1.2" />
      <text
        x="60" y="123" textAnchor="middle" fill="#1b2a5e" fontSize="4.5"
        fontWeight="800" stroke="none" className="font-hand"
      >
        CERVECERIA MODELO
      </text>
      {/* Glass shine */}
      <path d="M 47 76 L 47 84" stroke="#ffffff" strokeWidth="2.5" opacity="0.5" />
      {/* Sparkles */}
      <path d="M 94 60 L 94 70 M 89 65 L 99 65" strokeWidth="1.5" />
      <path d="M 24 108 L 24 116 M 20 112 L 28 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
