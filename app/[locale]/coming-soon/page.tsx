import type { Metadata } from "next";

import { BeerMugDoodle } from "@/components/marketing/BeerMugDoodle";
import { routing } from "@/i18n/routing";

import s from "./coming-soon.module.css";

/**
 * UR L.1 coming soon 頁（關站時訪客唯一可見頁）。
 * 純靜態 Server Component，零客戶端 JS；沿 intro 奶油底＋塗鴉品牌語言，
 * 文案按 locale 直出（不進 messages，避免全局 key 擾動）。
 * 未上線不收錄：robots noindex。
 */
export const metadata: Metadata = {
  title: "Coming Soon — WhatToDrink",
  description:
    "WhatToDrink is brewing something for Hong Kong drinkers. See you soon.",
  robots: { index: false, follow: false },
};

type Copy = {
  eyebrow: string;
  titleA: string;
  titleB: string;
  lede: string;
  cheers: string;
  storesSoon: string;
  foot: string;
};

const COPY: Record<string, Copy> = {
  "zh-Hant": {
    eyebrow: "即將登場",
    titleA: "COMING",
    titleB: "SOON",
    lede: "我哋釀緊啲好嘢——為香港人而設嘅飲酒好拍檔，好快見。",
    cheers: "乾杯！",
    storesSoon: "即將上架",
    foot: "WhatToDrink · 香港",
  },
  "zh-Hans": {
    eyebrow: "即将登场",
    titleA: "COMING",
    titleB: "SOON",
    lede: "我们正在酝酿——为香港人而设的饮酒好拍档，很快见。",
    cheers: "干杯！",
    storesSoon: "即将上架",
    foot: "WhatToDrink · 香港",
  },
  en: {
    eyebrow: "Almost there",
    titleA: "COMING",
    titleB: "SOON",
    lede: "We're brewing something for Hong Kong drinkers. See you soon.",
    cheers: "Cheers!",
    storesSoon: "Coming to stores",
    foot: "WhatToDrink · Hong Kong",
  },
};

export default async function ComingSoonPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t: Copy =
    COPY[locale] ??
    COPY[routing.defaultLocale as string] ??
    COPY.en!;
  return (
    <div className={s.root}>
      {/* 讀屏／無樣式環境後備文字 */}
      <h1 className="sr-only">WhatToDrink — Coming Soon</h1>
      <p className="sr-only">{t.lede}</p>
      <nav className={s.nav} aria-hidden="true">
        <span className={s.brand}>
          <i />
          <b>WhatToDrink</b>
        </span>
      </nav>
      <main className={s.stage}>
        <div className={s.mug} aria-hidden="true">
          <BeerMugDoodle cheersLabel={t.cheers} />
        </div>
        <p className={s.eyebrow}>{t.eyebrow}</p>
        <p className={`${s.title} font-hand`} aria-hidden="true">
          {t.titleA}
          <br />
          {t.titleB}
        </p>
        <p className={s.lede}>{t.lede}</p>
        <div className={s.stores} aria-label={t.storesSoon}>
          <span className={s.store}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M16.4 12.6c0-2.4 2-3.5 2.1-3.6-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9s-2-.9-3.2-.8c-1.7 0-3.2 1-4.1 2.4-1.7 3-.4 7.5 1.3 10 .8 1.2 1.8 2.5 3.1 2.5 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.5-1-2.5-4.2zM14 5.4c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1.1.1 2.1-.6 2.8-1.4z" />
            </svg>
            <span>App Store</span>
          </span>
          <span className={s.store}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M4 2.5v19l10-9.5L4 2.5zm11.3 8.2 3.2-3.1L6.6 1l8.7 9.7zm0 2.6L6.6 23l11.9-6.6-3.2-3.1zM20 9.8l-2.8 1.6v1.2l2.8 1.6 3-1.7c.9-.5.9-1.4 0-1.9L20 9.8z" />
            </svg>
            <span>Google Play</span>
          </span>
        </div>
        <p className={s.soon}>{t.storesSoon}</p>
        <p className={s.foot}>{t.foot}</p>
      </main>
    </div>
  );
}
