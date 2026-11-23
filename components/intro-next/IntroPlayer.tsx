"use client";

import { Player, type PlayerRef } from "@remotion/player";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactElement } from "react";

import type { AppLocale } from "@/i18n/routing";

import { FPS, S } from "../intro/kit";
import { initializePlayback } from "./playback";
import { browseIndexAt, completeSwipe, isHorizontalIntent, seekBrowseStop } from "./browse";
import { preloadIntroArtwork } from "./preload";
import { INTRO_COPY, introHref, introLanguageHref, type IntroBasePath, type IntroCopy } from "./copy";
import { INTRO_BRAND } from "./brand";
import { BRAND_IMAGE_PROPS, BROWSE_STOPS, CAPTURE_NAMES, captureImageProps, END_SEC, Story, TOTAL_FRAMES } from "./story";
import s from "./intro-next.module.css";

const OPENING_CAPTURES = ["ivy-bar", "detail", "camera"] as const;
const BROWSE_CHAPTERS = BROWSE_STOPS.filter((stop) => stop.kind !== "screen" || stop.shotIndex === 0);
type Swipe = { pointerId: number; x: number; y: number; width: number; wasPlaying: boolean; paused: boolean };

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
  const [activeIndex, setActiveIndex] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const swipe = useRef<Swipe | null>(null);
  const keyboardPaused = useRef(false);
  const ready = size.w > 0 && size.h > 0 && loadedLocale === locale;
  const inputProps = useMemo(() => ({ w: size.w, h: size.h, locale }), [size.w, size.h, locale]);
  const activeStop = BROWSE_STOPS[activeIndex];
  const stopLabel = (stop: typeof activeStop): string => stop.kind === "screen" ? copy.scenes[stop.sceneId].eyebrow : copy.browse[stop.kind];

  const goTo = (index: number): void => {
    if (!ready || !player) return;
    const target = seekBrowseStop(player, index, BROWSE_STOPS);
    setActiveIndex(target);
    setAnnouncement(`${stopLabel(BROWSE_STOPS[target])} · ${target + 1} / ${BROWSE_STOPS.length} · ${copy.browse.paused}`);
  };
  const goBy = (direction: -1 | 1): void => {
    if (player) goTo(browseIndexAt(player.getCurrentFrame(), BROWSE_STOPS) + direction);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.target instanceof HTMLElement && event.target.closest("a, input, select, textarea, [contenteditable=true]")) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      goBy(event.key === "ArrowLeft" ? -1 : 1);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      goTo(event.key === "Home" ? 0 : BROWSE_STOPS.length - 1);
    }
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (!player || !ready || !event.isPrimary || event.pointerType === "mouse") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    // Leave the system's edge-back gesture and multi-touch zoom to the browser.
    if (event.clientX - bounds.left < 20 || bounds.right - event.clientX < 20) return;
    swipe.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, width: bounds.width, wasPlaying: player.isPlaying(), paused: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const gesture = swipe.current;
    if (!gesture || gesture.pointerId !== event.pointerId || gesture.paused) return;
    if (isHorizontalIntent(event.clientX - gesture.x, event.clientY - gesture.y)) {
      gesture.paused = true;
      player?.pause();
    }
  };
  const finishSwipe = (event: PointerEvent<HTMLDivElement>, cancelled = false): void => {
    const gesture = swipe.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    swipe.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const result = completeSwipe(event.clientX - gesture.x, event.clientY - gesture.y, gesture.width, cancelled, gesture.paused, gesture.wasPlaying);
    if (result.direction !== null) goBy(result.direction);
    else if (result.resume) player?.play(event);
  };

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
      opening: [BRAND_IMAGE_PROPS, ...OPENING_CAPTURES.map((name) => captureImageProps(name, locale))],
      remaining: CAPTURE_NAMES.filter((name) => !OPENING_CAPTURES.some((opening) => opening === name)).map((name) => captureImageProps(name, locale)),
      onReady: () => setLoadedLocale(locale),
    });
  }, [locale]);

  useEffect(() => {
    const current = player;
    if (!current || !ready) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onPlay = (): void => { keyboardPaused.current = false; setPlaying(true); };
    const syncStep = (): void => setActiveIndex(browseIndexAt(current.getCurrentFrame(), BROWSE_STOPS));
    const onPause = (): void => { setPlaying(false); syncStep(); };
    const onPreference = (): void => {
      if (preference.matches) { current.pause(); current.seekTo(S(END_SEC + 2)); }
    };
    current.addEventListener("play", onPlay);
    current.addEventListener("pause", onPause);
    current.addEventListener("timeupdate", syncStep);
    current.addEventListener("seeked", syncStep);
    preference.addEventListener("change", onPreference);
    initializePlayback(current, {
      search: window.location.search,
      fps: FPS,
      totalFrames: TOTAL_FRAMES,
      reducedMotion: preference.matches,
      reading: keyboardPaused.current,
      readingFrame: BROWSE_STOPS[0].settledFrame,
      reducedFrame: S(END_SEC + 2),
    });
    syncStep();
    return () => {
      current.removeEventListener("play", onPlay);
      current.removeEventListener("pause", onPause);
      current.removeEventListener("timeupdate", syncStep);
      current.removeEventListener("seeked", syncStep);
      preference.removeEventListener("change", onPreference);
    };
  }, [ready, player]);

  return (
    <div className={s.root} lang={locale} role="region" aria-label={copy.nav} tabIndex={0} onKeyDown={onKeyDown} onFocusCapture={(event) => {
      if (event.target instanceof HTMLElement && event.target.matches(":focus-visible")) {
        keyboardPaused.current = true;
        player?.pause();
      }
    }}>
      <nav className={s.nav} aria-label={copy.nav}>
        <Link className={s.brand} href={introHref(locale, basePath)} aria-label={INTRO_BRAND.label}>
          <Image className={s.brandMark} src={INTRO_BRAND.icon} width={34} height={35} alt="" unoptimized />
          <Image className={s.brandWordmark} src={INTRO_BRAND.wordmarks[locale]} width={locale === "en" ? 90 : 55} height={25} alt={locale === "en" ? INTRO_BRAND.en : INTRO_BRAND.zh} unoptimized />
          <em>{copy.tagline}</em>
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
      <div className={s.stage} ref={stage} aria-hidden="true" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={(event) => finishSwipe(event)} onPointerCancel={(event) => finishSwipe(event, true)} onLostPointerCapture={(event) => finishSwipe(event, true)}>
        {/* This composition is silent. Do not let an unresumable AudioContext block its animation clock. */}
        {ready ? <Player ref={setPlayer} component={Story} inputProps={inputProps} durationInFrames={TOTAL_FRAMES} fps={FPS} compositionWidth={size.w} compositionHeight={size.h} className={s.player} controls={false} clickToPlay={false} doubleClickToFullscreen={false} spaceKeyToPlayOrPause={false} initiallyMuted numberOfSharedAudioTags={0} loop autoPlay={false} /> : <div className={s.loading}>{INTRO_BRAND.label}<small>{copy.tagline}</small></div>}
      </div>
      <div className={s.browseControls} role="group" aria-label={copy.browse.controls} onPointerEnter={(event) => { if (event.pointerType === "mouse") player?.pause(); }}>
        <button className={s.browseButton} type="button" aria-label={copy.browse.previous} aria-disabled={activeIndex === 0} onClick={() => { if (activeIndex > 0) goBy(-1); }} disabled={!ready || !player}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m14 5-7 7 7 7" /></svg>
        </button>
        <div className={s.browseCaption}>
          <div className={s.browseTitle}>
            <select aria-label={copy.browse.choose} title={stopLabel(activeStop)} value={activeStop.sceneId ?? activeStop.kind} disabled={!ready || !player} onChange={(event) => goTo(BROWSE_STOPS.findIndex((stop) => (stop.sceneId ?? stop.kind) === event.target.value))}>
              {BROWSE_CHAPTERS.map((stop) => <option key={stop.id} value={stop.sceneId ?? stop.kind}>{stopLabel(stop)}</option>)}
            </select>
            <small aria-hidden="true">{activeIndex + 1} / {BROWSE_STOPS.length}</small>
          </div>
          <span className={s.browseHint}>{playing ? copy.browse.hint : copy.browse.paused}</span>
        </div>
        <button className={s.browseButton} type="button" aria-label={copy.browse.next} aria-disabled={activeIndex === BROWSE_STOPS.length - 1} onClick={() => { if (activeIndex < BROWSE_STOPS.length - 1) goBy(1); }} disabled={!ready || !player}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m10 5 7 7-7 7" /></svg>
        </button>
      </div>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</div>
      <footer className={s.footerNote}>
        <span>{copy.screenshotNote}</span><span>{copy.responsible}</span>
      </footer>
    </div>
  );
}
