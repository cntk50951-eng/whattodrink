import { BeerIconFrame } from "./doodle";

type GuinnessDraughtIconProps = {
  className?: string;
};

/**
 * Batch3a Guinness Draught — from the official livery: black 440ml can,
 * gold harp (straight edge left), white GUINNESS arc, gold DRAUGHT line.
 * Stylised likeness, not the trademark artwork.
 */
export function GuinnessDraughtIcon({ className }: GuinnessDraughtIconProps) {
  return (
    <BeerIconFrame typeLabel="世濤" filterId="guinness-wobble" label="Guinness Draught" className={className}>
      {/* Black can body */}
      <path
        d="M 38 34 L 38 132 Q 38 142 48 142 L 72 142 Q 82 142 82 132 L 82 34 Z"
        fill="#161616"
      />
      <path d="M 70 34 L 82 34 L 82 132 Q 82 142 72 142 L 70 142 Z" fill="#000000" stroke="none" />
      {/* Lid */}
      <ellipse cx="60" cy="34" rx="22" ry="6" fill="#c9ced6" />
      <ellipse cx="60" cy="32" rx="14" ry="3.5" fill="#e8eaee" />
      {/* Gold collar + base bands */}
      <path d="M 38 42 L 82 42" stroke="#d9a521" strokeWidth="2.5" />
      <path d="M 40 134 L 80 134" stroke="#d9a521" strokeWidth="2" />
      {/* White wordmark */}
      <text
        x="60" y="58" textAnchor="middle" fill="#f6f1e2" fontSize="10"
        fontWeight="800" stroke="none" className="font-hand"
      >
        GUINNESS
      </text>
      {/* Gold harp — pillar left, arched neck, three strings, curved base */}
      <path d="M 52 66 L 52 106" stroke="#d9a521" strokeWidth="3" />
      <path d="M 52 66 Q 74 68 72 94" fill="none" stroke="#d9a521" strokeWidth="3" />
      <path d="M 57 71 L 57 99 M 61 72 L 61 98 M 65 74 L 65 96" stroke="#d9a521" strokeWidth="1.2" />
      <path d="M 47 106 Q 60 113 73 104" fill="none" stroke="#d9a521" strokeWidth="3" />
      {/* Gold DRAUGHT line */}
      <text
        x="60" y="124" textAnchor="middle" fill="#d9a521" fontSize="8"
        fontWeight="800" stroke="none" className="font-hand"
      >
        DRAUGHT
      </text>
      <text
        x="60" y="131" textAnchor="middle" fill="#8f8f8f" fontSize="5.5"
        fontWeight="700" stroke="none" className="font-hand"
      >
        440ml
      </text>
      {/* Shine */}
      <path d="M 44 60 L 44 128" stroke="#ffffff" strokeWidth="2" opacity="0.25" />
      {/* Sparkles */}
      <path d="M 96 52 L 96 62 M 91 57 L 101 57" strokeWidth="1.5" />
      <path d="M 24 108 L 24 116 M 20 112 L 28 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
