import { BeerIconFrame } from "./doodle";

type KakuHighballIconProps = {
  className?: string;
};

/**
 * Batch3a Kaku Highball — from the official livery: square Kakubin bottle
 * (tortoise-shell Kame-wa emboss, yellow label, black cap) + a small highball
 * serve with ice and lemon. Bottle carries no 角 mark in reality; the yellow
 * square silhouette is the recognition cue. Stylised, no trademark copy.
 */
export function KakuHighballIcon({ className }: KakuHighballIconProps) {
  return (
    <BeerIconFrame typeLabel="高球" filterId="kaku-wobble" label="Kaku Highball" className={className}>
      {/* Black cap + short neck */}
      <path d="M 32 30 L 52 30 L 52 46 L 32 46 Z" fill="#1a1a1a" />
      <path d="M 36 46 L 36 58 L 48 58 L 48 46 Z" fill="#8a4a16" />
      {/* Square bottle body */}
      <path d="M 28 58 L 56 58 L 56 136 Q 56 144 48 144 L 36 144 Q 28 144 28 136 Z" fill="#c47b1e" />
      <path d="M 48 58 L 56 58 L 56 136 Q 56 144 48 144 L 48 144 Z" fill="#9a5f14" stroke="none" />
      {/* Tortoise-shell emboss hint */}
      <path d="M 28 70 L 56 70 M 28 132 L 56 132 M 30 60 L 30 142 M 54 60 L 54 142" stroke="#f2c230" strokeWidth="1" opacity="0.55" />
      {/* Yellow label */}
      <path d="M 31 82 L 53 82 L 53 124 L 31 124 Z" fill="#f2c230" stroke="none" />
      <text
        x="42" y="93" textAnchor="middle" fill="#1a1a1a" fontSize="5"
        fontWeight="800" stroke="none" className="font-hand"
      >
        SUNTORY
      </text>
      <text
        x="42" y="101" textAnchor="middle" fill="#1a1a1a" fontSize="6.5"
        fontWeight="800" stroke="none" className="font-hand"
      >
        WHISKY
      </text>
      {/* Founder signature squiggle */}
      <path d="M 34 106 Q 38 103 42 106 Q 46 109 50 105" fill="none" stroke="#1a1a1a" strokeWidth="1.2" />
      {/* Serve: highball tumbler with ice + lemon */}
      <path
        d="M 66 96 L 94 96 L 90 138 Q 90 143 85 143 L 75 143 Q 70 143 70 138 Z"
        fill="#f6f1e2"
        opacity="0.9"
      />
      <path d="M 68 104 L 92 104 L 89 136 Q 89 140 85 140 L 75 140 Q 71 140 71 136 Z" fill="#e8b64c" stroke="none" />
      <path d="M 72 110 L 80 110 L 78 120 L 71 118 Z" fill="#fffdf5" stroke="none" />
      <path d="M 80 114 L 88 112 L 87 121 L 79 122 Z" fill="#fffdf5" stroke="none" />
      <path d="M 88 96 Q 94 90 98 94 Q 96 101 89 101 Z" fill="#f2d230" stroke="none" />
      {/* Sparkles */}
      <path d="M 20 70 L 20 80 M 15 75 L 25 75" strokeWidth="1.5" />
    </BeerIconFrame>
  );
}
