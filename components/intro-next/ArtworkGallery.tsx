import Image from "next/image";
import Link from "next/link";
import type { ReactElement } from "react";

import type { AppLocale } from "@/i18n/routing";

import { ARTWORK_SCREENS, artworkSrc } from "./artwork";
import { INTRO_COPY, introHref, introLanguageHref, type IntroBasePath } from "./copy";
import s from "./intro-next.module.css";

export function ArtworkGallery({ locale, basePath }: { locale: AppLocale; basePath: IntroBasePath }): ReactElement {
  const copy = INTRO_COPY[locale];
  return (
    <div className={s.root} lang={locale}>
      <div className={s.galleryScroller}>
        <header className={s.galleryHeader}>
          <Link className={s.compare} href={introHref(locale, basePath)}>← {copy.nav}</Link>
          <div className={s.languages} role="group" aria-label={copy.language}>
            {(["zh-Hant", "zh-Hans", "en"] as const).map((language, i) => <a key={language} href={introLanguageHref(language, `${basePath}/artwork`)} hrefLang={language} lang={language} aria-current={locale === language ? "page" : undefined}>{["繁體中文", "简体中文", "English"][i]}</a>)}
          </div>
        </header>
        <main className={s.galleryMain}>
          <h1>{copy.gallery}</h1><p>{copy.tagline} · {copy.screenshotNote}</p>
          <div className={s.galleryGrid}>
            {ARTWORK_SCREENS.map((screen) => <figure key={screen.id} id={screen.id}>
              <figcaption>{screen.label[locale]}</figcaption>
              <a href={artworkSrc(screen.id, locale)} target="_blank" rel="noreferrer" aria-label={screen.label[locale]}><Image src={artworkSrc(screen.id, locale)} alt={screen.label[locale]} width={1170} height={2532} sizes="(max-width: 600px) 85vw, (max-width: 1000px) 43vw, 25vw" /></a>
            </figure>)}
          </div>
        </main>
      </div>
    </div>
  );
}
