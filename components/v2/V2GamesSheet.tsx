"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Dices } from "lucide-react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { gameSocialErrorKey, normalizeRoomCode, parseGameRoom, parseJoinOutcome } from "@/lib/gameRoom";
import styles from "./v2.module.css";

type Mode = "face" | "online";

/**
 * UR G.10a 遊戲入口（v2-only；pills 遊戲 pill＋底部 Sheet）。
 * 建房（面對面 deal_only／線上 standard）＋輸碼加入（200 直入／202 等批，沿 H.2）＋
 * 我的房恢復（GET active）。進房後交 V2GameRoomSheet。
 */
export function V2GamesSheet({
  open,
  onClose,
  onEnter,
}: {
  open: boolean;
  onClose: () => void;
  onEnter: (roomId: string) => void;
}) {
  const t = useTranslations("v2");
  const [mode, setMode] = useState<Mode>("face");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const errText = useCallback(
    (status: number, j: { error?: { code?: string; message?: string } } | null): string => {
      const c = typeof j?.error?.code === "string" ? j.error.code : null;
      if (status === 401) return t("gameErrAuth");
      const key = gameSocialErrorKey(c);
      if (key !== null) return t(key);
      return j?.error?.message ?? t("gameErrOther");
    },
    [t],
  );

  const loadActive = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/games/rooms/active", { cache: "no-store", credentials: "include" });
      if (!res.ok) return;
      const j = (await res.json().catch(() => null)) as { room_id?: string | null } | null;
      if (j !== null && typeof j.room_id === "string" && j.room_id !== "") setActiveId(j.room_id);
    } catch {}
  }, []);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 開 sheet 即拉屬 props-sync（沿 V2NewsSheet 口径）
      setErr(null);
      void loadActive();
    }
  }, [open, loadActive]);

  async function create(): Promise<void> {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/v1/games/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ game: "liars", rules: { mode: mode === "face" ? "deal_only" : "standard" } }),
      });
      const j = (await res.json().catch(() => null)) as { room?: unknown; error?: { code?: string; message?: string } } | null;
      if (res.status !== 201 || j === null) throw new Error(errText(res.status, j));
      const room = parseGameRoom(j.room);
      if (room === null) throw new Error(t("gameErrOther"));
      onEnter(room.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("gameErrOther"));
    } finally {
      setBusy(false);
    }
  }

  async function join(): Promise<void> {
    const c = normalizeRoomCode(code);
    if (c === null) {
      setErr(t("gameCodeBad"));
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/v1/games/rooms/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: c }),
      });
      const j = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
      if (res.status !== 200 && res.status !== 202) throw new Error(errText(res.status, j));
      const out = parseJoinOutcome(res.status, j);
      if (out === null) throw new Error(t("gameErrOther"));
      if (out.kind === "joined") onEnter(out.roomId);
      else onEnter(`pending:${out.requestId}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("gameErrOther"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className={`${styles.v2scope} max-h-[70svh] gap-4 overflow-y-auto rounded-t-2xl p-4 sm:mx-auto sm:w-full sm:max-w-md`}
      >
        <SheetHeader>
          <SheetTitle>{t("gameTitle")}</SheetTitle>
          <SheetDescription className="sr-only">{t("gameTitle")}</SheetDescription>
        </SheetHeader>
        {err !== null && (
          <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-2 text-sm">
            {err}
          </p>
        )}
        {activeId !== null && (
          <button
            type="button"
            onClick={() => onEnter(activeId)}
            className="w-full rounded-xl border border-primary px-3 py-2 text-sm font-bold text-primary"
          >
            {t("gameResume")}
          </button>
        )}
        <div className="flex flex-col gap-2">
          <p className="text-sm font-bold">{t("gameCreate")}</p>
          <div className="flex gap-2" role="radiogroup" aria-label={t("gameCreate")}>
            {(["face", "online"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
                className={`flex-1 rounded-xl border p-2 text-left ${mode === m ? "border-primary" : ""}`}
              >
                <span className="block text-sm font-bold">{m === "face" ? t("gameFace") : t("gameOnline")}</span>
                <span className="block text-xs text-muted-foreground">{m === "face" ? t("gameFaceHint") : t("gameOnlineHint")}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void create()}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            <Dices size={16} aria-hidden />
            {t("gameCreateGo")}
          </button>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-bold">{t("gameJoin")}</p>
          <div className="flex gap-2">
            <input
              value={code}
              maxLength={12}
              placeholder={t("gameCodePh")}
              onChange={(e) => setCode(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm uppercase"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void join()}
              className="shrink-0 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              {t("gameJoinGo")}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
