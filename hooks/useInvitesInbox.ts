"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * UR E.16 邀請未读（v2-only；沿 useCheersInbox 口径：登入才拉，hidden 不拉）。
 * - `GET /invites?box=inbox`：pending 全数＋其中好友数（陌生人默认不推送，
 *   只亮入口；toast 只为好友邀约）。
 * - focus 回焦重拉＋好友邀约上跳即 `onNewInvite`。
 */
export function useInvitesInbox(
  enabled: boolean,
  onNewInvite?: () => void,
): { pending: number; refresh: () => void } {
  const [pending, setPending] = useState(0);
  const enabledRef = useRef(enabled);
  useEffect(() => {
    enabledRef.current = enabled;
  });
  const cbRef = useRef(onNewInvite);
  useEffect(() => {
    cbRef.current = onNewInvite;
  });
  const prevFriendRef = useRef(0);

  const refresh = useCallback(() => {
    if (!enabledRef.current) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    void fetch("/api/v1/invites?box=inbox", { cache: "no-store", credentials: "include" })
      .then(async (res) => {
        if (!res.ok) return;
        const j = (await res.json()) as unknown;
        if (typeof j !== "object" || j === null) return;
        const items = (j as Record<string, unknown>).items;
        if (!Array.isArray(items)) return;
        const pend = items.filter(
          (r) =>
            typeof r === "object" &&
            r !== null &&
            (r as Record<string, unknown>).status === "sent",
        );
        const friendPend = pend.filter(
          (r) => (r as Record<string, unknown>).is_friend === true,
        ).length;
        if (friendPend > prevFriendRef.current && friendPend > 0) cbRef.current?.();
        prevFriendRef.current = friendPend;
        setPending(pend.length);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    const onFocus = (): void => refresh();
    window.addEventListener("focus", onFocus);
    // UR E.16 round-2：坐等也亮（30s 一次，hidden 暫停；realtime 另議）。
    const iv = window.setInterval(() => refresh(), 30_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(iv);
    };
  }, [enabled, refresh]);

  return { pending, refresh };
}
