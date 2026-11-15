import type { AppLocale } from "@/i18n/routing";

import introCopy from "./copy.json";

export type SceneId = "capture" | "edit" | "publish" | "map" | "ivy" | "dice" | "party" | "trail" | "meet" | "tonight" | "cheers" | "home" | "cocktail";
export type SceneCopy = { eyebrow: string; title: string; accent: string; sub: string; detail: string; focus: string };
export type IntroCopy = {
  tagline: string;
  title: string;
  description: string;
  nav: string;
  compare: string;
  language: string;
  soon: string;
  downloadSoon: string;
  play: string;
  pause: string;
  gallery: string;
  screenshotNote: string;
  responsible: string;
  hero: { eyebrow: string; title: string; accent: string; sub: string; post: string; ivy: string };
  end: { eyebrow: string; title: string; accent: string; sub: string };
  scenes: Record<SceneId, SceneCopy>;
};

// Three-language copy lives in one editable JSON file; no component edits needed.
export const INTRO_COPY: Record<AppLocale, IntroCopy> = introCopy;

export type IntroBasePath = "intro" | "intro-next";
type IntroPath = IntroBasePath | `${IntroBasePath}/artwork` | "intro-backup";

export function introHref(locale: AppLocale, page: IntroPath = "intro-next"): string {
  return locale === "zh-Hant" ? `/${page}` : `/${locale}/${page}`;
}

/** Explicit prefixes override NEXT_LOCALE even when returning to the default locale. */
export function introLanguageHref(locale: AppLocale, page: IntroPath = "intro-next"): string {
  return `/${locale}/${page}`;
}
