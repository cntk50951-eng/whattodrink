"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";

import { FPS, S } from "./kit";
import { CHAPTERS, END_SEC, SCENES, Story, TOTAL_FRAMES } from "./story";
import s from "./intro.module.css";

/** 碰杯幕是黑底：導航文字同步反白（與 CHAPTERS 的 label 對應） */
const darkAt = (sec: number) =>
  CHAPTERS.reduce((a, c) => (sec >= c.from + 0.3 ? c.label : a), CHAPTERS[0].label) === "Cheers";

// 商店鏈接待上架後替換（占位，勿當成正式地址）
const APP_STORE_URL = "#app-store-todo";
const GOOGLE_PLAY_URL = "#google-play-todo";

export default function IntroPlayer() {
  const ref = useRef<PlayerRef>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [dark, setDark] = useState(false);

  // 以容器（100dvh）而不是 innerHeight 量尺寸：手機瀏覽器地址欄伸縮時不抖
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    let t: number;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(() => {
      window.clearTimeout(t);
      t = window.setTimeout(measure, 150);
    });
    ro.observe(el);
    return () => {
      window.clearTimeout(t);
      ro.disconnect();
    };
  }, []);

  // 預載全部截圖，避免播到該幕才開始下載
  useEffect(() => {
    const seen = new Set<string>();
    for (const sc of SCENES) for (const sh of sc.shots) seen.add(sh.src);
    seen.add("/intro/shots/07-chat.jpg");
    seen.add("/intro/shots/18-bump-to-join.jpg");
    for (const src of seen) {
      const img = new Image();
      img.decoding = "async";
      img.src = src;
    }
  }, []);

  // 打開即自動播放、循環；偏好減少動態時停在結尾幕（靜態也完整）
  useEffect(() => {
    const pl = ref.current;
    if (!pl || size.w === 0) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const onFrame = (e: { detail: { frame: number } }) => setDark(darkAt(e.detail.frame / FPS));
    pl.addEventListener("frameupdate", onFrame as never);
    // ?t=<秒>：凍結在指定秒（QA／截圖用）
    const frozen = new URLSearchParams(window.location.search).get("t");
    if (frozen !== null) {
      pl.pause();
      pl.seekTo(S(Number(frozen)));
      // setState 不可同步出現在 effect（lint）：microtask 延後，paint 前執行無閃爍
      const sec = Number(frozen);
      queueMicrotask(() => setDark(darkAt(sec)));
    } else if (reduce) pl.seekTo(S(END_SEC + 3));
    else if (!pl.isPlaying()) pl.play();
    return () => pl.removeEventListener("frameupdate", onFrame as never);
  }, [size.w > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={s.root} data-dark={dark ? "1" : "0"}>
      <nav className={s.nav}>
        <a className={s.brand} href="#top" aria-label="WhatToDrink">
          <i />
          <b>WhatToDrink</b>
        </a>
        <div className={s.navr}>
          <Link className={s.webApp} href="/v2">
            Open web app
          </Link>
          <a className={s.store} href={APP_STORE_URL} aria-label="Download on the App Store">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M16.4 12.6c0-2.4 2-3.5 2.1-3.6-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9s-2-.9-3.2-.8c-1.7 0-3.2 1-4.1 2.4-1.7 3-.4 7.5 1.3 10 .8 1.2 1.8 2.5 3.1 2.5 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.5-1-2.5-4.2zM14 5.4c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1.1.1 2.1-.6 2.8-1.4z" />
            </svg>
            <span>App Store</span>
          </a>
          <a className={s.store} href={GOOGLE_PLAY_URL} aria-label="Get it on Google Play">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M4 2.5v19l10-9.5L4 2.5zm11.3 8.2 3.2-3.1L6.6 1l8.7 9.7zm0 2.6L6.6 23l11.9-6.6-3.2-3.1zM20 9.8l-2.8 1.6v1.2l2.8 1.6 3-1.7c.9-.5.9-1.4 0-1.9L20 9.8z" />
            </svg>
            <span>Google Play</span>
          </a>
        </div>
      </nav>
      <div className={s.stage} ref={stageRef} aria-hidden="true">
        {size.w > 0 && (
          <Player
            ref={ref}
            component={Story as never}
            inputProps={{ mode: "light", w: size.w, h: size.h }}
            durationInFrames={TOTAL_FRAMES}
            fps={FPS}
            compositionWidth={size.w}
            compositionHeight={size.h}
            style={{ width: "100%", height: "100%" }}
            controls={false}
            clickToPlay={false}
            doubleClickToFullscreen={false}
            spaceKeyToPlayOrPause={false}
            loop
            autoPlay={new URLSearchParams(window.location.search).get("t") === null}
          />
        )}
      </div>
    </div>
  );
}
