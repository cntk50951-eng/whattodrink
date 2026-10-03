"use client";

import { useEffect, useState } from "react";

const cache = new Map<string, string>();

/**
 * UR E.13 地名解析共享钩（v2-only）。
 * 有 `place_name` 直用（零请求）；无则调现成 `/api/v1/places/reverse`
 * （Extra 同源，文案全站一致；无 key 即 Nominatim，429 即坐标兜底——诚实口径，不编地名）。
 * 同坐标会話内只查一次（module 缓存；跨卡跨组件复用）。
 * publish 写死 `place_name: null` 的上游账另议（发布延遲＋措辞待产品拍），本钩只管展示侧。
 */
export function usePlaceName(
  placeName: string | null | undefined,
  lat: number | null | undefined,
  lng: number | null | undefined,
): string | null {
  const [resolved, setResolved] = useState<string | null>(null);
  const key =
    placeName !== null && placeName !== undefined && placeName !== ""
      ? null
      : typeof lat === "number" &&
          Number.isFinite(lat) &&
          typeof lng === "number" &&
          Number.isFinite(lng)
        ? `${lat.toFixed(5)},${lng.toFixed(5)}`
        : null;
  useEffect(() => {
    if (placeName !== null && placeName !== undefined && placeName !== "") return;
    // 同步分支（無坐標／緩存命中）包 microtask，沿 V2Comments 掛載寫口徑，不直寫 effect 本體。
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (key === null) {
        setResolved(null);
        return;
      }
      const hit = cache.get(key);
      if (hit !== undefined) {
        setResolved(hit);
        return;
      }
      void (async () => {
        try {
          const [la, ln] = key.split(",");
          const res = await fetch(`/api/v1/places/reverse?lat=${la}&lng=${ln}`, {
            credentials: "include",
          });
          if (!res.ok || cancelled) return;
          const j = (await res.json()) as { display_name?: unknown };
          const name = typeof j.display_name === "string" && j.display_name !== "" ? j.display_name : null;
          if (name !== null) cache.set(key, name);
          if (!cancelled) setResolved(name);
        } catch {
          if (!cancelled) setResolved(null);
        }
      })();
    });
    return () => {
      cancelled = true;
    };
  }, [placeName, key]);
  if (placeName !== null && placeName !== undefined && placeName !== "") return placeName;
  return resolved;
}
