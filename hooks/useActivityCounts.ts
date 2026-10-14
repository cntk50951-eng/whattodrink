"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * UR G.7 動態計數（v2-only；沿 useCheersInbox 口径：登入才拉，hidden 不拉，focus 回焦重拉）。
 * 單次 `GET /me/counters` 取四數（碰杯未读＋邀約待回＋好友請求＋酒局通知未读）；
 * toast 仍由各舊 hook 驅動，這裡只給紅點＋動態中心行數。
 */
export type ActivityCounts = {
  cheers: number;
  invites: number;
  requests: number;
  notices: number;
};

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

export function useActivityCounts(enabled: boolean): { counts: ActivityCounts; refresh: () => void } {
  const [counts, setCounts] = useState<ActivityCounts>({ cheers: 0, invites: 0, requests: 0, notices: 0 });
  const enabledRef = useRef(enabled);
  useEffect(() => {
    enabledRef.current = enabled;
  });

  const refresh = useCallback(() => {
    if (!enabledRef.current) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    void fetch("/api/v1/me/counters", { cache: "no-store", credentials: "include" })
      .then(async (res) => {
        if (!res.ok) return;
        const j = (await res.json()) as unknown;
        if (typeof j !== "object" || j === null) return;
        const r = j as Record<string, unknown>;
        setCounts({
          cheers: num(r.cheers_unread),
          invites: num(r.invites_pending),
          requests: num(r.friend_requests_pending),
          notices: num(r.notices_unread),
        });
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

  return { counts, refresh };
}
