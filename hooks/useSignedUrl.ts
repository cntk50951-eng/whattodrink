"use client";

import { useEffect, useState } from "react";

/**
 * UR D.6 簽名 URL 讀緩存（私有桶無直讀口；播時經 `POST /uploads/view`
 * 簽 120s 短鏈，内存緩存同 path 不重簽；tab 關即焚，零持久化）。
 */

const cache = new Map<string, string>();

export function useSignedUrl(
  bucket: "chat-images" | "chat-voice" | null,
  path: string | null,
): string | null {
  const key = bucket !== null && path !== null ? `${bucket}/${path}` : null;
  // 緩存命中即初值（lazy init，render 內不寫 state，沿 purity 門）。
  const [url, setUrl] = useState<string | null>(() =>
    key === null ? null : (cache.get(key) ?? null),
  );
  useEffect(() => {
    if (key === null || cache.has(key)) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/v1/uploads/view", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ bucket, path }),
        });
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as { url?: unknown };
        if (typeof json.url !== "string" || cancelled) return;
        cache.set(key, json.url);
        setUrl(json.url);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [key, bucket, path]);
  return url;
}
