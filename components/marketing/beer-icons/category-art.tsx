import type { ComponentType, ReactNode } from "react";

import { BeerIconFrame } from "./doodle";

export type CategoryArtComponent = ComponentType<{ className?: string }>;

/**
 * UR3.9 v4 category vessels — one hand-drawn representative per lane so the
 * L1 carousel never mixes system emoji with brand art (designer v4 review:
 * mixed rows read as "unfinished"). Generic vessels, not brand likenesses,
 * so they live outside the brand pipeline (`beer-icon` skill: photo-first
 * drawing is for recognisable shelf livery, not for a wine glass).
 * Same language as BeerMugDoodle: themed ink strokes + wobble filter,
 * canonical fixed fills. No typeLabel — the lane card prints the name.
 */

function CatFrame({
  id,
  label,
  className,
  children,
}: {
  id: string;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <BeerIconFrame filterId={id} label={label} className={className}>
      {children}
    </BeerIconFrame>
  );
}

/** 啤酒 — mini mug, gold pour, foam cap. */
export function CatBeerArt({ className }: { className?: string }) {
  return (
    <CatFrame id="cat-beer-wobble" label="啤酒" className={className}>
      <path
        d="M 38 52 L 36 118 Q 36 128 46 128 L 74 128 Q 84 128 84 118 L 82 52 Z"
        fill="var(--card)"
      />
      <path d="M 34 52 Q 32 34 48 32 Q 53 24 62 29 Q 72 22 80 30 Q 88 32 86 52 Z" fill="#fffdf5" />
      <path
        d="M 37 74 L 36 116 Q 36 124 46 124 L 74 124 Q 82 124 82 116 L 81 74 Z"
        fill="#e6a817"
        strokeWidth="2"
      />
      <path d="M 84 70 Q 100 70 100 86 Q 100 102 84 102" />
      <circle cx="52" cy="96" r="4" fill="#fffdf5" strokeWidth="1.5" />
      <circle cx="66" cy="108" r="5" fill="#fffdf5" strokeWidth="1.5" />
      <path d="M 46 40 Q 49 35 54 38 M 64 37 Q 68 32 73 36" strokeWidth="1.5" />
    </CatFrame>
  );
}

/** 紅酒 — bordeaux glass, deep red pour. */
export function CatRedArt({ className }: { className?: string }) {
  return (
    <CatFrame id="cat-red-wobble" label="紅酒" className={className}>
      <path
        d="M 40 22 Q 40 78 60 84 Q 80 78 80 22 Z"
        fill="var(--card)"
      />
      <path d="M 43 44 Q 44 72 60 77 Q 76 72 77 44 Z" fill="#7b1e26" strokeWidth="2" />
      <path d="M 60 84 L 60 128" />
      <path d="M 44 134 L 76 134" strokeWidth="3" />
      <path d="M 49 50 Q 50 64 56 70" stroke="#fffdf5" strokeWidth="2" opacity="0.6" />
      <circle cx="88" cy="40" r="3" fill="var(--accent)" stroke="none" />
    </CatFrame>
  );
}

/** 白酒 — narrow white-wine glass, pale straw pour. */
export function CatWhiteArt({ className }: { className?: string }) {
  return (
    <CatFrame id="cat-white-wobble" label="白酒" className={className}>
      <path d="M 44 22 L 44 66 Q 44 88 60 92 Q 76 88 76 66 L 76 22 Z" fill="var(--card)" />
      <path d="M 47 48 L 47 65 Q 47 83 60 86 Q 73 83 73 65 L 73 48 Z" fill="#ecd27a" strokeWidth="2" />
      <path d="M 60 92 L 60 128" />
      <path d="M 46 134 L 74 134" strokeWidth="3" />
      <path d="M 53 54 L 53 70" stroke="#fffdf5" strokeWidth="2" opacity="0.7" />
    </CatFrame>
  );
}

/** 威士忌 — rocks tumbler, amber pour, two ice cubes. */
export function CatWhiskyArt({ className }: { className?: string }) {
  return (
    <CatFrame id="cat-whisky-wobble" label="威士忌" className={className}>
      <path d="M 36 60 L 42 128 Q 42 134 48 134 L 72 134 Q 78 134 78 128 L 84 60 Z" fill="var(--card)" />
      <path d="M 39 84 L 43 126 L 77 126 L 81 84 Z" fill="#c47b1e" strokeWidth="2" />
      <rect x="48" y="92" width="18" height="18" fill="#fffdf5" opacity="0.85" strokeWidth="2" transform="rotate(-8 57 101)" />
      <rect x="66" y="98" width="14" height="14" fill="#fffdf5" opacity="0.7" strokeWidth="2" transform="rotate(10 73 105)" />
      <path d="M 36 60 L 84 60" strokeWidth="3" />
    </CatFrame>
  );
}

/** 清酒 — tokkuri bottle + ochoko cup, ceramic with red stamp. */
export function CatSakeArt({ className }: { className?: string }) {
  return (
    <CatFrame id="cat-sake-wobble" label="清酒" className={className}>
      <path
        d="M 52 22 L 68 22 L 66 44 Q 76 56 76 84 L 76 118 Q 76 126 68 126 L 52 126 Q 44 126 44 118 L 44 84 Q 44 56 54 44 Z"
        fill="#f5f1e6"
      />
      <circle cx="60" cy="92" r="9" fill="#b3261e" stroke="none" />
      <path d="M 30 128 L 46 128 L 44 142 Q 37 146 30 142 Z" fill="#f5f1e6" />
      <path d="M 31 131 L 45 131" stroke="#3fa7a0" strokeWidth="2" />
      <circle cx="90" cy="46" r="3" fill="var(--secondary)" stroke="none" />
    </CatFrame>
  );
}

/** 雞尾酒 — coupe, wide shallow bowl, cherry + straw. */
export function CatCocktailArt({ className }: { className?: string }) {
  return (
    <CatFrame id="cat-cocktail-wobble" label="雞尾酒" className={className}>
      <path d="M 28 44 Q 60 44 60 78 Q 60 44 92 44 Z" fill="var(--card)" />
      <path d="M 34 46 Q 60 46 60 70 Q 60 46 86 46 Z" fill="#3fa7a0" stroke="none" opacity="0.85" />
      <path d="M 60 78 L 60 126" />
      <path d="M 46 132 L 74 132" strokeWidth="3" />
      <line x1="72" y1="24" x2="62" y2="52" />
      <circle cx="60" cy="58" r="5" fill="#b3261e" strokeWidth="1.5" />
    </CatFrame>
  );
}

/** 利口酒 — short ume glass, plum-red pour, ume roundel. */
export function CatLiqueurArt({ className }: { className?: string }) {
  return (
    <CatFrame id="cat-liqueur-wobble" label="利口酒" className={className}>
      <path d="M 40 66 L 44 128 Q 44 134 50 134 L 70 134 Q 76 134 76 128 L 80 66 Z" fill="var(--card)" />
      <path d="M 42 88 L 45 126 L 75 126 L 78 88 Z" fill="#a63a4d" strokeWidth="2" />
      <circle cx="60" cy="106" r="8" fill="#d98a94" strokeWidth="1.5" />
      <path d="M 40 66 L 80 66" strokeWidth="3" />
      <path d="M 88 44 L 90 50 L 96 50 L 91 54 L 93 60 L 88 56 L 83 60 L 85 54 L 80 50 L 86 50 Z" fill="var(--primary)" strokeWidth="1.2" />
    </CatFrame>
  );
}

/** Lane id → representative vessel. Every lane covered — L1 never mixes emoji with art. */
export const CATEGORY_ART: Record<string, CategoryArtComponent> = {
  beer: CatBeerArt,
  red: CatRedArt,
  white: CatWhiteArt,
  whisky: CatWhiskyArt,
  sake: CatSakeArt,
  cocktail: CatCocktailArt,
  liqueur: CatLiqueurArt,
};
