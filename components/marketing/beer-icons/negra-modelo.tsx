import { BeerIconFrame } from "./doodle";

type NegraModeloIconProps = {
  className?: string;
};

/**
 * Batch2 Negra Modelo（莫德罗黑啤）— from the real bottle photo: brown glass,
 * black neck foil + black neck tag (gold seal, white "Negra" script), big
 * BLACK body label (white "Modelo", gold CERVEZA arch + lions + 1925 ribbon,
 * white "Negra" script).
 */
export function NegraModeloIcon({ className }: NegraModeloIconProps) {
  return (
    <BeerIconFrame typeLabel="深色拉格" filterId="negramodelo-wobble" label="Negra Modelo" className={className}>
      {/* Open mouth */}
      <path d="M 52 16 L 68 16 L 68 24 L 52 24 Z" fill="#3d1e0c" />
      {/* Brown body */}
      <path d="M 53 24 L 53 58 Q 53 66 46 70 L 42 74 L 42 134 Q 42 144 52 144 L 68 144 Q 78 144 78 134 L 78 74 L 74 70 Q 67 66 67 58 L 67 24 Z" fill="#5e2f12" />
      <path d="M 61 72 L 74 70 Q 78 74 78 78 L 78 134 Q 78 144 68 144 L 61 144 Z" fill="#3d1e0c" stroke="none" opacity="0.9" />
      {/* Black neck foil + tag */}
      <path d="M 53 24 L 67 24 L 67 52 L 53 52 Z" fill="#1a1a1a" stroke="none" />
      <circle cx="60" cy="38" r="5" fill="none" stroke="#d9a521" strokeWidth="1.4" />
      <text
        x="60" y="50" textAnchor="middle" fill="#fffdf5" fontSize="5.5"
        fontWeight="700" fontStyle="italic" stroke="none" className="font-hand"
      >
        Negra
      </text>
      {/* Black body label, gold frame */}
      <path d="M 42 86 L 78 86 L 78 128 L 42 128 Z" fill="#1a1a1a" />
      <path d="M 42 86 L 78 86 M 42 128 L 78 128" stroke="#d9a521" strokeWidth="1.8" />
      <text
        x="60" y="94" textAnchor="middle" fill="#d9a521" fontSize="5"
        fontWeight="800" stroke="none" className="font-hand"
      >
        CERVEZA
      </text>
      <text
        x="60" y="108" textAnchor="middle" fill="#fffdf5" fontSize="11"
        fontWeight="800" stroke="none" className="font-hand"
      >
        Modelo
      </text>
      {/* Gold lions */}
      <ellipse cx="46" cy="104" rx="2.4" ry="4.4" fill="#d9a521" stroke="none" />
      <ellipse cx="74" cy="104" rx="2.4" ry="4.4" fill="#d9a521" stroke="none" />
      <text
        x="60" y="118" textAnchor="middle" fill="#d9a521" fontSize="6"
        fontWeight="800" stroke="none" className="font-hand"
      >
        ★ 1925 ★
      </text>
      <text
        x="60" y="125" textAnchor="middle" fill="#fffdf5" fontSize="7"
        fontWeight="700" fontStyle="italic" stroke="none" className="font-hand"
      >
        Negra
      </text>
      {/* Glass shine */}
      <path d="M 47 76 L 47 84" stroke="#ffffff" strokeWidth="2.5" opacity="0.5" />
      {/* Sparkles */}
      <path d="M 94 60 L 94 70 M 89 65 L 99 65" strokeWidth="1.5" />
      <path d="M 24 108 L 24 116 M 20 112 L 28 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
