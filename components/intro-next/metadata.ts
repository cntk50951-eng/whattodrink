import type { Metadata } from "next";

import type { AppLocale } from "@/i18n/routing";

import { INTRO_BRAND } from "./brand";
import { INTRO_COPY } from "./copy";

const OG_LOCALE: Record<AppLocale, string> = { "zh-Hant": "zh_HK", "zh-Hans": "zh_CN", en: "en_US" };
/** Square dark-background brand card; the transparent opening art would render on white in link previews. */
const OG_IMAGE = { url: "/intro-next/brand/hi-drink-opening-preview-v1.png", width: 1400, height: 1400, alt: INTRO_BRAND.label };

/** Share-card metadata for the intro pages; `indexable` is false on the preview route. */
export function introMetadata(locale: AppLocale, indexable: boolean): Metadata {
  const copy = INTRO_COPY[locale];
  return {
    title: copy.title,
    description: copy.description,
    robots: { index: indexable, follow: indexable },
    openGraph: { type: "website", siteName: INTRO_BRAND.label, locale: OG_LOCALE[locale], title: copy.title, description: copy.description, images: [OG_IMAGE] },
    twitter: { card: "summary", title: copy.title, description: copy.description, images: [OG_IMAGE.url] },
  };
}
