"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { LOGOUT_CLEAR_EVENT } from "@/lib/auth/clear";
import { parseMode } from "@/lib/mode";
import type { UserMode } from "@/lib/mode";

/**
 * UR A.16 — 我的可見模式（讀 `GET /me`，寫 `PATCH /me`）。
 * - `enabled=false`（未登入）不拉取，mode 保持 null（匿名不攔，交端點 401）。
 * - 登出事件（`wtd:logout`）自動清 null。
 * - `patchMode` 樂觀更新，失敗回滾。
 */
export function useMyMode(enabled: boolean): {
  mode: UserMode | null;
  refreshMode: () => void;
  patchMode: (next: UserMode) => Promise<boolean>;
} {
  const [mode, setMode] = useState<UserMode | null>(null);
  // patchMode 回滾用：render 內不許寫 ref（react-hooks/refs），改 effect 同步
  const modeRef = useRef<UserMode | null>(null);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const refreshMode = useCallback(() => {
    void fetch("/api/v1/me", { cache: "no-store", credentials: "include" })
      .then(async (res) => {
        if (!res.ok) return;
        const j = (await res.json()) as { me?: { mode?: unknown } };
        const m = parseMode(j.me?.mode);
        if (m !== null) setMode(m);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!enabled) return;
    refreshMode();
  }, [enabled, refreshMode]);

  useEffect(() => {
    const handler = (): void => {
      setMode(null);
    };
    window.addEventListener(LOGOUT_CLEAR_EVENT, handler);
    return () => window.removeEventListener(LOGOUT_CLEAR_EVENT, handler);
  }, []);

  const patchMode = useCallback(async (next: UserMode): Promise<boolean> => {
    const prev = modeRef.current;
    setMode(next);
    try {
      const res = await fetch("/api/v1/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mode: next }),
      });
      if (!res.ok) throw new Error(`me ${res.status}`);
      const j = (await res.json()) as { me?: { mode?: unknown } };
      const m = parseMode(j.me?.mode);
      if (m !== null) setMode(m);
      return true;
    } catch {
      setMode(prev);
      return false;
    }
  }, []);

  return { mode, refreshMode, patchMode };
}
