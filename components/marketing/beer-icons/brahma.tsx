import { BeerIconFrame } from "./doodle";

type BrahmaIconProps = {
  className?: string;
};

/**
 * Batch2 Brahma（布拉马 Chopp）— from the brand-cooler photo: white can, gray
 * +gold ring ("CERVEJA TIPO PILSEN"), foam mug emblem, RED ribbon with white
 * "BRAHMA" + "Chopp" script, wheat below, "DESDE 1888".
 */
export function BrahmaIcon({ className }: BrahmaIconProps) {
  return (
    <BeerIconFrame typeLabel="皮爾森" filterId="brahma-wobble" label="Brahma" className={className}>
      {/* White can */}
      <path
        d="M 38 34 L 38 132 Q 38 142 48 142 L 72 142 Q 82 142 82 132 L 82 34 Z"
        fill="#f4f4f2"
      />
      <path d="M 70 34 L 82 34 L 82 132 Q 82 142 72 142 L 70 142 Z" fill="#d9d9d6" stroke="none" />
      {/* Lid */}
      <ellipse cx="60" cy="34" rx="22" ry="6" fill="#c9ced6" />
      <ellipse cx="60" cy="32" rx="14" ry="3.5" fill="#e8eaee" />
      {/* Ring header */}
      <text
        x="60" y="50" textAnchor="middle" fill="#777777" fontSize="5.5"
        fontWeight="800" stroke="none" className="font-hand"
      >
        CERVEJA · PILSEN
      </text>
      {/* Foam mug emblem */}
      <path d="M 53 54 L 67 54 L 66 66 Q 60 69 54 66 Z" fill="#f0b429" strokeWidth="1.8" />
      <path d="M 53 54 Q 53 49 57 50 Q 58 47 61 49 Q 64 47 65 50 Q 68 50 67 54 Z" fill="#fffdf5" strokeWidth="1.4" />
      <path d="M 67 56 Q 71 56 70 61 Q 69 65 66 64" strokeWidth="1.6" />
      {/* Red ribbon */}
      <path d="M 38 72 L 82 72 L 78 84 L 42 84 Z" fill="#c8102e" stroke="none" />
      <text
        x="60" y="81" textAnchor="middle" fill="#ffffff" fontSize="10"
        fontWeight="800" stroke="none" className="font-hand"
      >
        BRAHMA
      </text>
      <text
        x="60" y="94" textAnchor="middle" fill="#c8102e" fontSize="9"
        fontWeight="700" fontStyle="italic" stroke="none" className="font-hand"
      >
        Chopp
      </text>
      {/* Wheat */}
      <path d="M 48 100 L 46 112 M 72 100 L 74 112" stroke="#c9a227" strokeWidth="1.4" />
      <ellipse cx="47" cy="105" rx="1.8" ry="3.2" fill="#c9a227" stroke="none" />
      <ellipse cx="73" cy="105" rx="1.8" ry="3.2" fill="#c9a227" stroke="none" />
      <text
        x="60" y="112" textAnchor="middle" fill="#777777" fontSize="5.5"
        fontWeight="800" stroke="none" className="font-hand"
      >
        DESDE 1888
      </text>
      <text
        x="60" y="126" textAnchor="middle" fill="#777777" fontSize="6.5"
        fontWeight="700" stroke="none" className="font-hand"
      >
        布拉马
      </text>
      {/* Shine */}
      <path d="M 44 88 L 44 108" stroke="#ffffff" strokeWidth="2.5" opacity="0.8" />
      {/* Sparkles */}
      <path d="M 96 52 L 96 62 M 91 57 L 101 57" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
