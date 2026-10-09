import type { StaticImageData } from "next/image";

import sapporoBeer from "./Sapporo_beer_6s.gif";
import cocktail from "./Cocktail2_6s.gif";
import champagne from "./champagne_non_loop-2.gif";
import redWine from "./red_wine_6s.gif";
import whisky from "./whisky_6s.gif";
import whiteWine from "./white_wine_6s.gif";

export type RevealPhoto = {
  src: StaticImageData;
  /** i18n key in the `v2` namespace for the photo alt text. */
  altKey: string;
};

/**
 * UR C.22 揭曉照片池——加照片只 append 此陣列（`{src, altKey}`＋v2 三語 key），零改碼。
 * 2026-10-09：舊 3 張 commercial GIF 退役，換 6 張 6s 酒款（Sapporo／cocktail／香檳／紅酒／威士忌／白酒）。
 */
const PHOTOS: RevealPhoto[] = [
  { src: sapporoBeer, altKey: "revealPhotoAlt1" },
  { src: cocktail, altKey: "revealPhotoAlt2" },
  { src: champagne, altKey: "revealPhotoAlt3" },
  { src: redWine, altKey: "revealPhotoAlt4" },
  { src: whisky, altKey: "revealPhotoAlt5" },
  { src: whiteWine, altKey: "revealPhotoAlt6" },
];

export function revealPhotoCount(): number {
  return PHOTOS.length;
}

export function revealPhotoAt(index: number): RevealPhoto {
  return PHOTOS[index] ?? (PHOTOS[0] as RevealPhoto);
}
