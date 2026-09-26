"use client";

import { useEffect, useState } from "react";

import type { Beer } from "@/lib/beers";
// vitest 無 @/ alias（見 memory），被 BeerIcon.test.ts 直引的本檔一律相對路徑。
import { iconForDrinkName, iconForPickId } from "../marketing/beer-icons/wall";
import { WallIcon } from "../marketing/beer-icons/doodle";

/**
 * UR A.4-rev2 酒圖兩級（本地圖退場）：API 自畫圖（`icon_url`）＞ emoji。
 * UR A.14 冒泡加载態：有 `icon_url` 且未 `onLoad` 時先顯 3 枚上升氣泡
 *   skeleton（3:4 固幅、`bg-[var(--muted)]`），就緒後 300ms 淡入，壞圖回退 emoji。
 * UR A.20 本地優先：已畫品牌（`iconForPickId` 按目錄 id，`iconForDrinkName`
 *   按展示名兜底）走本地 SVG 組件（themed 描邊＋瞬時零加載態），無本地圖
 *   才走 `icon_url`＞emoji 舊鏈。DB／API 零動。
 */
export function toBeerIconWrapperClass(imgClassName: string): string {
  return imgClassName
    .replaceAll("w-auto", "aspect-[3/4]")
    .replaceAll("object-cover", "")
    .replaceAll(/\s{2,}/g, " ")
    .trim();
}

export function BeerIcon({
  beer,
  imgClassName,
  emojiClassName,
}: {
  beer: Beer;
  imgClassName: string;
  emojiClassName: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [imgBroken, setImgBroken] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- icon_url 切換時重置加載態為必要同步
    setLoaded(false);
    setImgBroken(false);
  }, [beer.icon_url]);

  // UR A.20：本地圖優先（瞬時渲染，無 skeleton／重掛需求；key 由調用方保）。
  // size-full 見 V2Home BeerImg 註：躲 shadcn Button 的 svg size-4 reset。
  const Local = iconForPickId(beer.id) ?? iconForDrinkName(beer.name);
  if (Local !== null) {
    return (
      <span className={toBeerIconWrapperClass(imgClassName)} aria-hidden>
        <WallIcon Icon={Local} className="size-full" />
      </span>
    );
  }

  const hasIcon =
    beer.icon_url !== undefined &&
    beer.icon_url !== null &&
    beer.icon_url !== "" &&
    !imgBroken;

  if (!hasIcon) {
    return (
      <span className={emojiClassName} aria-hidden>
        {beer.emoji}
      </span>
    );
  }

  // skeleton 與 wrapper 同尺寸：w-auto → aspect-[3/4] 固寬，避免空圖塌陷
  const wrapperClass = toBeerIconWrapperClass(imgClassName);

  return (
    <span
      className={`relative inline-block overflow-hidden ${wrapperClass}`}
      aria-hidden={loaded ? undefined : true}
    >
      {!loaded && (
        <span
          className="absolute inset-0 flex items-end justify-center bg-[var(--muted)]"
          aria-hidden
        >
          <span
            className="beer-bubble absolute bottom-1 h-2 w-2 rounded-full border bg-[var(--card)]"
            style={{ left: "22%", borderColor: "var(--border)", animationDelay: "0s" } as React.CSSProperties}
          />
          <span
            className="beer-bubble absolute bottom-1 h-1.5 w-1.5 rounded-full border bg-white"
            style={{ left: "48%", borderColor: "var(--border)", animationDelay: "0.35s" } as React.CSSProperties}
          />
          <span
            className="beer-bubble absolute bottom-1 h-2.5 w-2.5 rounded-full border bg-[var(--card)]"
            style={{ left: "71%", borderColor: "var(--border)", animationDelay: "0.18s" } as React.CSSProperties}
          />
        </span>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={beer.icon_url!}
        alt=""
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setImgBroken(true)}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
      <style>{`@keyframes beer-bubble{0%{transform:translateY(0) scale(1);opacity:.85}100%{transform:translateY(-52px) scale(.65);opacity:0}}.beer-bubble{animation:beer-bubble 1.6s ease-in infinite}@media(prefers-reduced-motion:reduce){.beer-bubble{animation:none;opacity:.55;transform:none}}`}</style>
    </span>
  );
}
