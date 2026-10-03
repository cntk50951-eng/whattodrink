"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { sumUnread } from "@/lib/chat";

/**
 * UR D.5 好友列表 pill 角标（v2-only）：全局未读汇总＋新消息即时感知。
 * - 总数：`GET /conversations` 各行 unread 求和（`sumUnread` 纯函数；坏行按 0）。
 * - 即时：全局订阅 `messages` INSERT（RLS 只放行我能读的行，沿 B.2 口径；
 *   Publication 沿 D.3 `messages` 同一条，不新增表不新增 publication）。
 *   到行且发件人非我 → 重算总数＋调 `onNewMessage`（调用方走 flashNote）。
 * - 门禁：`enabled` 假（匿名）即不拉不订，返回总数恒 0；
 *  用户定案 2026-10-03：任何模式（公开／好友／隐身）都提醒，模式不挡 Bell
 * （心跳／live 好友仍走 presence 门，不动）；hidden 页不拉取；卸载拆频道。
 */
export function useChatBell(
  enabled: boolean,
  onNewMessage?: () => void,
): { total: number; refresh: () => void } {
  const [total, setTotal] = useState(0);
  const enabledRef = useRef(enabled);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);
  const cbRef = useRef(onNewMessage);
  useEffect(() => {
    cbRef.current = onNewMessage;
  }, [onNewMessage]);
  const myIdRef = useRef<string | null>(null);

  const refresh = useCallback(() => {
    if (!enabledRef.current) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }
    void fetch("/api/v1/conversations?limit=50", { cache: "no-store", credentials: "include" })
      .then(async (res) => {
        if (!res.ok) return;
        const j = (await res.json()) as unknown;
        if (typeof j !== "object" || j === null) return;
        setTotal(sumUnread((j as Record<string, unknown>).conversations));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    void (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (cancelled) return;
        myIdRef.current = data.user?.id ?? null;
        const channel = supabase
          .channel("chat-bell")
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "messages" },
            (payload) => {
              const row = payload.new as { sender_id?: unknown };
              if (typeof row.sender_id !== "string") return;
              // 自己发的（多端同步）不扰（总数重算即灭，无需提示）。
              if (myIdRef.current !== null && row.sender_id === myIdRef.current) {
                refresh();
                return;
              }
              refresh();
              cbRef.current?.();
            },
          )
          .subscribe();
        unsubscribe = () => {
          channel.unsubscribe();
        };
      } catch {
        // Publication 未开／断线：总数停在上次值，降级不炸（沿 D.3 口径）。
      }
    })();
    return () => {
      cancelled = true;
      try {
        unsubscribe?.();
      } catch {}
    };
  }, [enabled, refresh]);

  return { total: enabled ? total : 0, refresh };
}
