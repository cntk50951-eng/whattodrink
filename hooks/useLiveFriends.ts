"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { parseLiveFriendsResponse } from "@/lib/presence";
import type { LiveFriend } from "@/lib/presence";
import { HEARTBEAT_MS } from "./useHeartbeat";

/**
 * UR A.21 在線好友輪詢：登入＋非隱身＋頁面可見才拉（stealth 由 enabled
 * 門擋＋server 回 [] 雙保險）；30s 一次，失敗靜默保舊值。
 * UR A.21 Realtime 切換口：EPIC B 落地後在此訂閱頻道，`refresh`
 * 改由事件驅動，本輪詢退為斷線降級（接口不變）。
 */
export function useLiveFriends(enabled: boolean): {
  friends: LiveFriend[];
  refresh: () => void;
} {
  const [friends, setFriends] = useState<LiveFriend[]>([]);
  const enabledRef = useRef(enabled);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const refresh = useCallback(() => {
    if (!enabledRef.current) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }
    void fetch("/api/v1/friends/live", { cache: "no-store", credentials: "include" })
      .then(async (res) => {
        if (!res.ok) return;
        const j = (await res.json()) as unknown;
        setFriends(parseLiveFriendsResponse(j));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    const id = window.setInterval(refresh, HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [enabled, refresh]);

  // 失能即空（讀時派生，不寫 state；重開 refresh 即回新值，舊值永不渲染）。
  return { friends: enabled ? friends : [], refresh };
}
