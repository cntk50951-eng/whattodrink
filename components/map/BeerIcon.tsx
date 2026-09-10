"use client";

import { useState } from "react";

import type { Beer } from "@/lib/beers";

/**
 * UR A.4-rev2 酒圖兩級（本地圖退場）：API 自畫圖（`icon_url`）＞ emoji。
 * 內建手繪組件不再是產品渲染路徑（設計管線／preview 頁保留）。
 * `<img>` 壞圖 onError 當場退 emoji，不破版。
 */
export function BeerIcon({
  beer,
  imgClassName,
  emojiClassName,
}: {
  beer: Beer;
  imgClassName: string;
  emojiClassName: string;
}) {
  const [imgBroken, setImgBroken] = useState(false);
  if (
    beer.icon_url !== undefined &&
    beer.icon_url !== null &&
    !imgBroken
  ) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={beer.icon_url}
        alt=""
        loading="lazy"
        onError={() => setImgBroken(true)}
        className={imgClassName}
      />
    );
  }
  return (
    <span className={emojiClassName} aria-hidden>
      {beer.emoji}
    </span>
  );
}
