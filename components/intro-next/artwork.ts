import type { AppLocale } from "@/i18n/routing";

export const ARTWORK_SCREENS = [
  { id: "camera", label: { "zh-Hant": "拍照或選圖", "zh-Hans": "拍照或选图", en: "Capture a photo" } },
  { id: "editor", label: { "zh-Hant": "編輯照片與文字", "zh-Hans": "编辑照片与文字", en: "Edit the photo" } },
  { id: "preview", label: { "zh-Hant": "預覽與發布", "zh-Hans": "预览与发布", en: "Preview and publish" } },
  { id: "map", label: { "zh-Hant": "地圖上的帖子", "zh-Hans": "地图上的帖子", en: "Your post on the map" } },
  { id: "detail", label: { "zh-Hant": "帖子詳情", "zh-Hans": "帖子详情", en: "Photo post details" } },
  { id: "ivy-bar", label: { "zh-Hant": "Ivy 的酒吧", "zh-Hans": "Ivy 的酒吧", en: "Ivy’s bar" } },
  { id: "cocktail-book", label: { "zh-Hant": "整一杯：選酒譜", "zh-Hans": "整一杯：选酒谱", en: "Cocktail book: choose a recipe" } },
  { id: "cocktail-recipe", label: { "zh-Hant": "整一杯：配方與份量", "zh-Hans": "整一杯：配方与份量", en: "Cocktail book: ingredients and servings" } },
  { id: "cocktail-step", label: { "zh-Hant": "整一杯：逐步跟做", "zh-Hans": "整一杯：逐步跟做", en: "Follow along, one step at a time" } },
  { id: "cocktail-done", label: { "zh-Hant": "整一杯：完成與分享", "zh-Hans": "整一杯：完成与分享", en: "Your cocktail, ready to share" } },
  { id: "dice-cups", label: { "zh-Hant": "大話骰：叫骰", "zh-Hans": "大话骰：叫骰", en: "Liar’s Dice: bidding" } },
  { id: "dice-peek", label: { "zh-Hant": "大話骰：偷看", "zh-Hans": "大话骰：偷看", en: "Liar’s Dice: peeking" } },
  { id: "party", label: { "zh-Hant": "酒局：探索今晚", "zh-Hans": "酒局：探索今晚", en: "Parties: explore tonight" } },
  { id: "party-detail", label: { "zh-Hant": "酒局：查看詳情", "zh-Hans": "酒局：查看详情", en: "Parties: details and join" } },
  { id: "trail", label: { "zh-Hant": "我的微醺足跡", "zh-Hans": "我的微醺足迹", en: "Your tipsy trail" } },
  { id: "trail-map", label: { "zh-Hant": "足跡：地圖預覽", "zh-Hans": "足迹：地图预览", en: "Trail: map preview" } },
  { id: "trail-replay", label: { "zh-Hant": "足跡：腳印回放", "zh-Hans": "足迹：脚印回放", en: "Trail: footprint replay" } },
  { id: "meet", label: { "zh-Hant": "遇見：描述與結果", "zh-Hans": "遇见：描述与结果", en: "Meet: search and results" } },
  { id: "tonight", label: { "zh-Hant": "今晚喝什麼", "zh-Hans": "今晚喝什么", en: "What to drink tonight" } },
  { id: "cheers", label: { "zh-Hant": "碰杯與回敬", "zh-Hans": "碰杯与回敬", en: "Cheers and toast back" } },
  { id: "home", label: { "zh-Hant": "主地圖與功能入口", "zh-Hans": "主地图与功能入口", en: "Home map and features" } },
  { id: "profile", label: { "zh-Hant": "個人主頁與口味", "zh-Hans": "个人主页与口味", en: "Your profile and taste" } },
] as const;
export type ArtworkId = (typeof ARTWORK_SCREENS)[number]["id"];

export function artworkSrc(name: ArtworkId, locale: AppLocale): string {
  // Version the curated artwork independently of the untouched original captures.
  // Regenerated flow artwork gets fresh optimizer URLs during local review.
  // cocktail-step is v5: the ask-Ivy pill was removed from the follow-along screen (2026-11-17).
  const version = name === "cocktail-step" ? 5 : name.startsWith("cocktail-") || name.startsWith("trail-") ? 4 : 3;
  return `/intro-next/artwork/${locale}/${name}-v${version}.webp`;
}
