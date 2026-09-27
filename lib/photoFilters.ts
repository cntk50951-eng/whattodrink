/**
 * UR E.1 拍照濾鏡（L0 零依賴檔）。
 * 同一串 css 走兩路：實時掛 `video` style.filter 預覽，抓幀時寫
 * `ctx.filter` 烘焙進圖——所見即所得，預覽與成圖零漂移。
 * IG 級（人臉貼紙跟臉／真磨皮）要 MediaPipe＋模型，另開 E.2，
 * 本文件只做色調級。
 */

export const PHOTO_FILTER_IDS = [
  "none",
  "clear",
  "film",
  "bw",
  "warm",
  "cool",
] as const;

export type PhotoFilterId = (typeof PHOTO_FILTER_IDS)[number];

export const PHOTO_FILTER_CSS: Record<PhotoFilterId, string> = {
  none: "none",
  clear: "contrast(1.06) saturate(1.12)",
  film: "contrast(0.94) saturate(0.82) sepia(0.28)",
  bw: "grayscale(1) contrast(1.05)",
  warm: "sepia(0.35) saturate(1.2) brightness(1.03)",
  cool: "saturate(0.9) hue-rotate(-12deg) brightness(1.02)",
};

/**
 * 「自然美顏」開關（誠實命名：亮度＋對比＋飽和微調，非磨皮；
 * 真磨皮要人臉 mask，E.2 才談）。
 */
export const BEAUTY_CSS = "brightness(1.06) contrast(1.04) saturate(1.08)";

export function isPhotoFilterId(v: unknown): v is PhotoFilterId {
  return (
    typeof v === "string" &&
    (PHOTO_FILTER_IDS as readonly string[]).includes(v)
  );
}

/** 預覽＋烘焙共用（非法 id 回原相機，不拋）。 */
export function photoFilterCss(id: unknown, beauty: boolean): string {
  const base =
    isPhotoFilterId(id) && id !== "none" ? PHOTO_FILTER_CSS[id] : "none";
  if (!beauty) return base;
  return base === "none" ? BEAUTY_CSS : `${base} ${BEAUTY_CSS}`;
}

/** 抓幀下採樣上限（沿 v1 photo-mood ≤1024 口徑，控 localStorage 配額）。 */
export const PHOTO_MAX_DIM = 1024;

/** 按上限等比縮放（已夠小原樣回；純函數可單測）。 */
export function fitPhotoSize(
  w: number,
  h: number,
  maxDim: number = PHOTO_MAX_DIM,
): { w: number; h: number } {
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return { w: 0, h: 0 };
  }
  const scale = Math.min(1, maxDim / Math.max(w, h));
  return { w: Math.round(w * scale), h: Math.round(h * scale) };
}
