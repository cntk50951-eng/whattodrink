"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * UR E.14 被敬未读（v2-only；沿 useChatBell 口径：登入才拉，hidden 不拉，卸载无订阅）。
 * - 总数：`GET /cheers/inbox?limit=1` 的 unread（行列表只在面板用，这里只要数）。
 * - 即时：focus 回焦重拉＋上跳即 `onNewCheers`（toast 🍻，调用方 flashNote）；
 *   Realtime 不另开 publication（沿 E.13 定案，轮询即够）。
 * - 标已读调用方做（开自己面板 PATCH /cheers/seen 后调 refresh）。
 */
export function useCheersInbox(
  enabled: boolean,
  onNewCheers?: () => void,
): { unread: number; refresh: () => void } {
  const [unread, setUnread] = useState(0);
  const enabledRef = useRef(enabled);
  useEffect(() => {
    enabledRef.current = enabled;
  });
  const cbRef = useRef(onNewCheers);
  useEffect(() => {
    cbRef.current = onNewCheers;
  });
  const prevRef = useRef(0);

  const refresh = useCallback(() => {
    if (!enabledRef.current) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    void fetch("/api/v1/cheers/inbox?limit=1", { cache: "no-store", credentials: "include" })
      .then(async (res) => {
        if (!res.ok) return;
        const j = (await res.json()) as unknown;
        if (typeof j !== "object" || j === null) return;
        const n = (j as Record<string, unknown>).unread;
        if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return;
        const v = Math.floor(n);
        if (v > prevRef.current && v > 0) cbRef.current?.();
        prevRef.current = v;
        setUnread(v);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    const onFocus = (): void => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [enabled, refresh]);

  return { unread, refresh };
}
