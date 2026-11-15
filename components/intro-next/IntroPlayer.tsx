"use client";

import { Player, type PlayerRef } from "@remotion/player";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactElement } from "react";

import type { AppLocale } from "@/i18n/routing";

import { FPS, S } from "../intro/kit";
import { previewFrame } from "./playback";
import { preloadIntroArtwork } from "./preload";
import { INTRO_COPY, introHref, introLanguageHref, type IntroBasePath, type IntroCopy } from "./copy";
import { CAPTURE_NAMES, captureImageProps, END_SEC, Story, TOTAL_FRAMES } from "./story";
import s from "./intro-next.module.css";

const OPENING_CAPTURES = ["ivy-bar", "detail", "camera"] as const;

function StoreBadge({ platform, copy }: { platform: "apple" | "google"; copy: IntroCopy }): ReactElement {
  const apple = platform === "apple";
  // Store addresses have not been supplied. A disabled badge avoids a fake download link.
  return (
    <span className={`${s.store} ${s.unavailable}`} role="link" aria-disabled="true" aria-label={`${apple ? "App Store" : "Google Play"} — ${copy.soon}`} title={copy.downloadSoon}>
      <svg width="17" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        {apple ? <path d="M16.4 12.6c0-2.4 2-3.5 2.1-3.6-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9s-2-.9-3.2-.8c-1.7 0-3.2 1-4.1 2.4-1.7 3-.4 7.5 1.3 10 .8 1.2 1.8 2.5 3.1 2.5 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.5-1-2.5-4.2zM14 5.4c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1.1.1 2.1-.6 2.8-1.4z" /> : <path d="M4 2.5v19l10-9.5L4 2.5zm11.3 8.2 3.2-3.1L6.6 1l8.7 9.7zm0 2.6L6.6 23l11.9-6.6-3.2-3.1zM20 9.8l-2.8 1.6v1.2l2.8 1.6 3-1.7c.9-.5.9-1.4 0-1.9L20 9.8z" />}
      </svg>
      <span className={s.storeWords}><small>{copy.soon}</small><b>{apple ? "App Store" : "Google Play"}</b></span>
    </span>
  );
}

export default function IntroPlayer({ locale, basePath }: { locale: AppLocale; basePath: IntroBasePath }): ReactElement {
  const copy = INTRO_COPY[locale];
  // State follows the actual ref attachment, including a delayed Player mount.
  const [player, setPlayer] = useState<PlayerRef | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [loadedLocale, setLoadedLocale] = useState<AppLocale | null>(null);
  const [playing, setPlaying] = useState(false);
  const ready = size.w > 0 && size.h > 0 && loadedLocale === locale;

  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    let timer: number;
    const measure = (): void => setSize({ w: Math.round(element.clientWidth), h: Math.round(element.clientHeight) });
    measure();
    const observer = new ResizeObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(measure, 120);
    });
    observer.observe(element);
    return () => { window.clearTimeout(timer); observer.disconnect(); };
  }, []);

  useEffect(() => {
    return preloadIntroArtwork({
      opening: OPENING_CAPTURES.map((name) => captureImageProps(name, locale)),
      remaining: CAPTURE_NAMES.filter((name) => !OPENING_CAPTURES.some((opening) => opening === name)).map((name) => captureImageProps(name, locale)),
      onReady: () => setLoadedLocale(locale),
    });
  }, [locale]);

  useEffect(() => {
    const current = player;
    if (!current || !ready) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onPlay = (): void => setPlaying(true);
    const onPause = (): void => setPlaying(false);
    const onPreference = (): void => {
      if (preference.matches) { current.pause(); current.seekTo(S(END_SEC + 2)); }
    };
    current.addEventListener("play", onPlay);
    current.addEventListener("pause", onPause);
    preference.addEventListener("change", onPreference);
    const frozen = previewFrame(new URLSearchParams(window.location.search).get("t"), FPS, TOTAL_FRAMES);
    if (frozen !== null) { current.pause(); current.seekTo(frozen); }
    else if (preference.matches) onPreference();
    else current.play();
    return () => {
      current.removeEventListener("play", onPlay);
      current.removeEventListener("pause", onPause);
      preference.removeEventListener("change", onPreference);
    };
  }, [ready, player]);

  return (
    <div className={s.root} lang={locale}>
      <nav className={s.nav} aria-label={copy.nav}>
        <Link className={s.brand} href={introHref(locale, basePath)} aria-label="WhatToDrink">
          <svg className={s.brandMark} viewBox="0 0 34 40" fill="none" aria-hidden="true"><path d="M7 8h20l-2 22c-.3 3-2 5-5 5h-6c-3 0-4.7-2-5-5L7 8Z" stroke="currentColor" strokeWidth="1.5" /><path d="M10 20h14l-1 9c-.2 2-1 3-3 3h-6c-2 0-2.8-1-3-3l-1-9Z" fill="currentColor" /><path d="m15 4 7 9M12 2l2 4M26 1l-3 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          <b>WhatToDrink</b><em>{copy.tagline}</em>
        </Link>
        <div className={s.navr}>
          <div className={s.languages} role="group" aria-label={copy.language}>
            {(["zh-Hant", "zh-Hans", "en"] as const).map((language, i) => <a key={language} href={introLanguageHref(language, basePath)} hrefLang={language} lang={language} aria-current={language === locale ? "page" : undefined} aria-label={["繁體中文", "简体中文", "English"][i]}>{["繁", "简", "EN"][i]}</a>)}
          </div>
          <button className={s.playButton} type="button" onClick={(event) => player?.toggle(event)} aria-label={playing ? copy.pause : copy.play} aria-pressed={!playing} disabled={!ready || !player}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">{playing ? <path d="M2 1h3v10H2zm5 0h3v10H7z" /> : <path d="M3 1v10l8-5z" />}</svg>
          </button>
          <StoreBadge platform="apple" copy={copy} /><StoreBadge platform="google" copy={copy} />
        </div>
      </nav>
      <div className={s.stage} ref={stage} aria-hidden="true">
        {ready ? <Player ref={setPlayer} component={Story} inputProps={{ w: size.w, h: size.h, locale }} durationInFrames={TOTAL_FRAMES} fps={FPS} compositionWidth={size.w} compositionHeight={size.h} className={s.player} controls={false} clickToPlay={false} doubleClickToFullscreen={false} spaceKeyToPlayOrPause={false} loop autoPlay={false} /> : <div className={s.loading}>WhatToDrink<small>{copy.tagline}</small></div>}
      </div>
      <footer className={s.footerNote}>
        <Link className={s.compare} href={introHref(locale, "intro-backup")}>{copy.compare} ↗</Link>
        <Link className={s.compare} href={introHref(locale, `${basePath}/artwork`)}>{copy.gallery} ↗</Link>
        <span>{copy.screenshotNote}</span><span>{copy.responsible}</span>
      </footer>
    </div>
  );
}
