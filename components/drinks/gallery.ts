import type { StaticImageData } from "next/image";

import splash1 from "./sapporo_commercial_9x16_no_loop.gif";
import splash2 from "./budweiser_commercial_9x16_no_loop.gif";
import splash3 from "./tsingtao_commercial_9x16_no_loop.gif";

export type RevealPhoto = {
  src: StaticImageData;
  /** i18n key in the `v2` namespace for the photo alt text. */
  altKey: string;
};

/**
 * UR C.22 揭曉照片池——加照片只 append 此陣列（`{src, altKey}`＋v2 三語 key），零改碼。
 * 現 1 筆（驗證用）；照片多了之後的真抽籤另開 UR。
 */
const PHOTOS: RevealPhoto[] = [
  { src: splash1, altKey: "revealPhotoAlt1" },
  { src: splash2, altKey: "revealPhotoAlt2" },
  { src: splash3, altKey: "revealPhotoAlt3" },
];

export function revealPhotoCount(): number {
  return PHOTOS.length;
}

export function revealPhotoAt(index: number): RevealPhoto {
  return PHOTOS[index] ?? (PHOTOS[0] as RevealPhoto);
}
