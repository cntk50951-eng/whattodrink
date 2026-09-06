import { BeerIconFrame } from "./doodle";

type DosEquisIconProps = {
  className?: string;
};

/**
 * Batch2 Dos Equis（双 X）— from the table photo: brown bottle, GOLD label
 * with giant red "XX", "CERVEZA DOS EQUIS" header, gold neck tag with red XX.
 */
export function DosEquisIcon({ className }: DosEquisIconProps) {
  return (
    <BeerIconFrame typeLabel="淡拉格" filterId="dosequis-wobble" label="Dos Equis" className={className}>
      {/* Open mouth */}
      <path d="M 52 16 L 68 16 L 68 24 L 52 24 Z" fill="#3d1e0c" />
      {/* Brown body */}
      <path d="M 53 24 L 53 58 Q 53 66 46 70 L 42 74 L 42 134 Q 42 144 52 144 L 68 144 Q 78 144 78 134 L 78 74 L 74 70 Q 67 66 67 58 L 67 24 Z" fill="#7a3f14" />
      <path d="M 61 72 L 74 70 Q 78 74 78 78 L 78 134 Q 78 144 68 144 L 61 144 Z" fill="#542a0c" stroke="none" opacity="0.9" />
      {/* Gold neck tag */}
      <path d="M 53 32 L 67 32 L 67 50 L 53 50 Z" fill="#d9a521" stroke="none" />
      <text
        x="60" y="44" textAnchor="middle" fill="#c8102e" fontSize="9"
        fontWeight="800" stroke="none" className="font-hand"
      >
        XX
      </text>
      {/* Gold body label */}
      <path d="M 42 86 L 78 86 L 78 128 L 42 128 Z" fill="#d9a521" />
      <text
        x="60" y="94" textAnchor="middle" fill="#5c430a" fontSize="5"
        fontWeight="800" stroke="none" className="font-hand"
      >
        CERVEZA DOS EQUIS
      </text>
      {/* Giant red XX */}
      <text
        x="60" y="116" textAnchor="middle" fill="#c8102e" fontSize="22"
        fontWeight="800" stroke="none" className="font-hand"
      >
        XX
      </text>
      {/* Glass shine */}
      <path d="M 47 76 L 47 84" stroke="#ffffff" strokeWidth="2.5" opacity="0.5" />
      {/* Sparkles */}
      <path d="M 94 60 L 94 70 M 89 65 L 99 65" strokeWidth="1.5" />
      <path d="M 24 108 L 24 116 M 20 112 L 28 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
