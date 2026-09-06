import { BeerIconFrame } from "./doodle";

type SnowIconProps = {
  className?: string;
};

/**
 * Batch1 Snow（雪花勇闯天涯）— from the real bottle photo: brown glass, blue
 * label with white 雪花 + SNOW + 勇闯天涯, snowflake + climber, blue neck wrap.
 */
export function SnowIcon({ className }: SnowIconProps) {
  return (
    <BeerIconFrame typeLabel="淡拉格" filterId="snow-wobble" label="Snow" className={className}>
      {/* Cap */}
      <path d="M 52 16 L 68 16 L 68 26 L 52 26 Z" fill="#8a8f96" />
      {/* Neck + brown body */}
      <path d="M 53 26 L 53 58 Q 53 66 46 70 L 42 74 L 42 134 Q 42 144 52 144 L 68 144 Q 78 144 78 134 L 78 74 L 74 70 Q 67 66 67 58 L 67 26 Z" fill="#8a4d1c" />
      <path d="M 61 72 L 74 70 Q 78 74 78 78 L 78 134 Q 78 144 68 144 L 61 144 Z" fill="#5e320e" stroke="none" opacity="0.9" />
      {/* Blue neck wrap */}
      <path d="M 53 32 L 67 32 L 67 52 L 53 52 Z" fill="#1c5fb8" stroke="none" />
      <text
        x="60" y="45" textAnchor="middle" fill="#ffffff" fontSize="7"
        fontWeight="800" stroke="none" className="font-hand"
        transform="rotate(90 60 42)"
      >
        雪花
      </text>
      {/* Blue label */}
      <path d="M 42 86 L 78 86 L 78 128 L 42 128 Z" fill="#1c5fb8" />
      {/* Snowflake */}
      <path d="M 48 94 L 48 102 M 44 96 L 52 96 M 45 98 L 51 98" stroke="#ffffff" strokeWidth="1.4" />
      <circle cx="48" cy="98" r="4.5" fill="none" stroke="#ffffff" strokeWidth="1.2" />
      <text
        x="62" y="104" textAnchor="middle" fill="#ffffff" fontSize="13"
        fontWeight="800" stroke="none" className="font-hand"
      >
        雪花
      </text>
      <text
        x="62" y="114" textAnchor="middle" fill="#ffffff" fontSize="7"
        fontWeight="800" stroke="none" className="font-hand"
      >
        SNOW 勇闯天涯
      </text>
      {/* Climber dot */}
      <circle cx="71" cy="92" r="1.8" fill="#ffffff" stroke="none" />
      <path d="M 71 94 L 71 98 M 71 95 L 68 97 M 71 95 L 74 97" stroke="#ffffff" strokeWidth="1.2" />
      {/* Glass shine */}
      <path d="M 47 76 L 47 84" stroke="#ffffff" strokeWidth="2.5" opacity="0.6" />
      {/* Sparkles */}
      <path d="M 94 60 L 94 70 M 89 65 L 99 65" strokeWidth="1.5" />
      <path d="M 24 108 L 24 116 M 20 112 L 28 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
