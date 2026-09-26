import { BeerIconFrame } from "./doodle";

type KaiserIconProps = {
  className?: string;
};

/**
 * Batch3 Kaiser — 473ml can: silver body, red band, big grey K with red text,
 * gold trim (post-2019 clean identity: gold = quality). Stylised, no trademark.
 */
export function KaiserIcon({ className }: KaiserIconProps) {
  return (
    <BeerIconFrame typeLabel="淡拉格" filterId="kaiser-wobble" label="Kaiser" className={className}>
      {/* Silver can body */}
      <path d="M 38 34 L 38 132 Q 38 142 48 142 L 72 142 Q 82 142 82 132 L 82 34 Z" fill="#c9ced6" />
      <path d="M 70 34 L 82 34 L 82 132 Q 82 142 72 142 L 70 142 Z" fill="#a7adb8" stroke="none" />
      <ellipse cx="60" cy="34" rx="22" ry="6" fill="#e8eaee" />
      <ellipse cx="60" cy="32" rx="14" ry="3.5" fill="#c9ced6" />
      {/* Red band + gold rules */}
      <path d="M 38 52 L 82 52 L 82 124 L 38 124 Z" fill="#c8102e" stroke="none" />
      <path d="M 38 52 L 82 52 M 38 124 L 82 124" stroke="#d9a521" strokeWidth="1.6" />
      {/* Giant K */}
      <text x="60" y="104" textAnchor="middle" fill="#5a5f6a" fontSize="44" fontWeight="800" fontStyle="italic" stroke="none" className="font-hand">
        K
      </text>
      <text x="60" y="64" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="800" stroke="none" className="font-hand">
        KAISER
      </text>
      <text x="60" y="136" textAnchor="middle" fill="#333333" fontSize="6.5" fontWeight="700" stroke="none" className="font-hand">
        473ml
      </text>
      <path d="M 44 56 L 44 128" stroke="#ffffff" strokeWidth="2.5" opacity="0.7" />
      <path d="M 96 52 L 96 62 M 91 57 L 101 57" strokeWidth="1.5" />
      <path d="M 24 108 L 24 116 M 20 112 L 28 112" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
