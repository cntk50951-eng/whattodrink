"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Flag, Send } from "lucide-react";

import {
  gameChatTextValid,
  GAME_QUICK_KEYS,
  mergeGameChat,
  parseGameChatMessage,
  parseGameReportCat,
  type GameChatMessage,
  type GameReportCat,
} from "@/lib/gameChat";
import { gameSocialErrorKey } from "@/lib/gameRoom";

type QuickKey = (typeof GAME_QUICK_KEYS)[number];

function quickText(t: (k: string) => string, key: string | null): string {
  if (key === null) return "…";
  const map: Record<string, string> = {
    ready: "gqReady",
    hurry: "gqHurry",
    again: "gqAgain",
    drink: "gqDrink",
    cheers_all: "gqCheersAll",
    nice: "gqNice",
    oops: "gqOops",
    good_luck: "gqGoodLuck",
    well_played: "gqWellPlayed",
    rematch: "gqRematch",
    brb: "gqBrb",
    waiting: "gqWaiting",
    go_go: "gqGoGo",
    haha: "gqHaha",
    wow: "gqWow",
    cheer_up: "gqCheerUp",
    my_turn: "gqMyTurn",
    your_turn: "gqYourTurn",
    toast_host: "gqToastHost",
    thanks: "gqThanks",
    sorry: "gqSorry",
    gj: "gqGj",
    lol: "gqLol",
    cheers_back: "gqCheersBack",
  };
  const k = map[key];
  return k !== undefined ? t(k) : "…";
}

const REPORT_CATS: { v: GameReportCat; title: string; hint: string }[] = [
  { v: "harassment", title: "grHarass", hint: "grHintHarass" },
  { v: "cheating", title: "grCheat", hint: "grHintCheat" },
  { v: "inappropriate", title: "grBad", hint: "grHintBad" },
  { v: "other", title: "grOther", hint: "grHintOther" },
  { v: "safety", title: "grSafety", hint: "grHintSafety" },
];

/**
 * UR G.10c 房內聊天＋舉報（v2-only；掛房間 Sheet 內）。
 * 4s 輪詢全量＋客戶端合并（200 封頂）；快捷語 24 宮＋文字 60 字（client_msg_id 幂等）；
 * 逐行舉報（五類＋描述，message_id 附帶）；撤回行統一提示。
 */
export function V2GameChatPanel({ roomId, myUserId }: { roomId: string; myUserId: string | null }) {
  const t = useTranslations("v2");
  const [msgs, setMsgs] = useState<GameChatMessage[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [repFor, setRepFor] = useState<{ msgId: string; userId: string } | null>(null);
  const [repCat, setRepCat] = useState<GameReportCat>("harassment");
  const [repDetail, setRepDetail] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let stop = false;
    const tick = async (): Promise<void> => {
      try {
        const res = await fetch(`/api/v1/games/rooms/${encodeURIComponent(roomId)}/messages?limit=50`, {
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok || stop) return;
        const j = (await res.json().catch(() => null)) as { items?: unknown[] } | null;
        const rows: GameChatMessage[] = [];
        for (const x of j !== null && Array.isArray(j.items) ? j.items : []) {
          const m = parseGameChatMessage(x);
          if (m !== null) rows.push(m);
        }
        if (!stop) setMsgs((prev) => mergeGameChat(prev, rows));
      } catch {}
    };
    void tick();
    const id = window.setInterval(() => {
      if (!stop) void tick();
    }, 4000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [roomId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [msgs.length]);

  async function send(kind: "text" | "quick", body: string, quickKey?: QuickKey): Promise<void> {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/v1/games/rooms/${encodeURIComponent(roomId)}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          kind,
          ...(kind === "text" ? { body } : { quick_key: quickKey }),
          client_msg_id: typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${roomId}-${body.length}-${body.slice(0, 8)}`,
        }),
      });
      const j = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
      if (res.status !== 200 && res.status !== 201) {
        const code = typeof j?.error?.code === "string" ? j.error.code : null;
        const key = gameSocialErrorKey(code);
        throw new Error(key !== null ? t(key) : (j?.error?.message ?? t("gameErrOther")));
      }
      setText("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("gameErrOther"));
    } finally {
      setBusy(false);
    }
  }

  async function report(): Promise<void> {
    if (repFor === null) return;
    const cat = parseGameReportCat(repCat);
    if (cat === null) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/v1/games/rooms/${encodeURIComponent(roomId)}/report`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          target_user_id: repFor.userId,
          category: cat,
          ...(repDetail.trim() !== "" ? { detail: repDetail.trim().slice(0, 200) } : {}),
          message_id: repFor.msgId,
        }),
      });
      const j = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
      if (!res.ok) {
        const code = typeof j?.error?.code === "string" ? j.error.code : null;
        const key = gameSocialErrorKey(code);
        throw new Error(key !== null ? t(key) : (j?.error?.message ?? t("gameErrOther")));
      }
      setRepFor(null);
      setRepDetail("");
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("gameErrOther"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border p-3">
      <p className="text-sm font-bold">{t("gameChat")}</p>
      {err !== null && (
        <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-2 text-xs">
          {err}
        </p>
      )}
      <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto" role="log" aria-label={t("gameChat")}>
        {msgs.length === 0 && <p className="text-xs text-muted-foreground">{t("gameChatEmpty")}</p>}
        {msgs.map((m) => {
          const mine = m.user !== null && m.user.id === myUserId;
          const uid = m.user?.id ?? null;
          const uname = m.user?.nickname ?? "";
          return (
            <div key={m.id} className={`flex flex-col gap-0.5 ${mine ? "items-end" : "items-start"}`}>
              <div
                className={`max-w-[85%] rounded-xl px-2.5 py-1.5 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}
              >
                {!mine && uid !== null && <p className="text-xs font-bold opacity-70">{uname}</p>}
                <p className="break-words">
                  {m.removed ? t("gameMsgRemoved") : m.kind === "quick" ? quickText(t, m.quick_key) : (m.body ?? "")}
                </p>
              </div>
              {!mine && !m.removed && uid !== null && uid !== myUserId && (
                <button
                  type="button"
                  onClick={() => {
                    setRepFor({ msgId: m.id, userId: uid });
                    setRepDetail("");
                  }}
                  aria-label={t("gameReport")}
                  className="flex items-center gap-1 text-xs text-muted-foreground"
                >
                  <Flag size={11} aria-hidden />
                  {t("gameReport")}
                </button>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      {repFor !== null && (
        <div className="flex flex-col gap-1.5 rounded-xl border border-destructive/40 p-2">
          <p className="text-xs font-bold">{t("gameReportTitle")}</p>
          <div className="flex flex-wrap gap-1.5">
            {REPORT_CATS.map((c) => (
              <button
                key={c.v}
                type="button"
                onClick={() => setRepCat(c.v)}
                aria-pressed={repCat === c.v}
                title={t(c.hint)}
                className={`rounded-full border px-2.5 py-1 text-xs font-bold ${repCat === c.v ? "border-destructive text-destructive" : ""}`}
              >
                {t(c.title)}
              </button>
            ))}
          </div>
          <input
            value={repDetail}
            maxLength={200}
            placeholder={t("gameReportPh")}
            onChange={(e) => setRepDetail(e.target.value)}
            className="rounded-xl border px-2.5 py-1.5 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void report()}
              className="flex-1 rounded-full bg-destructive px-3 py-1.5 text-xs font-bold text-destructive-foreground disabled:opacity-50"
            >
              {t("gameReportSend")}
            </button>
            <button
              type="button"
              onClick={() => setRepFor(null)}
              className="flex-1 rounded-full border px-3 py-1.5 text-xs font-bold"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {(GAME_QUICK_KEYS as readonly string[]).map((k) => (
          <button
            key={k}
            type="button"
            disabled={busy}
            onClick={() => void send("quick", "", k as QuickKey)}
            className="rounded-full bg-muted px-2.5 py-1 text-xs disabled:opacity-50"
          >
            {quickText(t, k)}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={text}
          maxLength={60}
          placeholder={t("gameChatPh", { n: 60 })}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && gameChatTextValid(text)) void send("text", text.trim());
          }}
          className="min-w-0 flex-1 rounded-full border px-3 py-1.5 text-sm"
        />
        <button
          type="button"
          disabled={busy || !gameChatTextValid(text)}
          onClick={() => void send("text", text.trim())}
          aria-label={t("chatSend")}
          className="shrink-0 rounded-full bg-primary p-2 text-primary-foreground disabled:opacity-50"
        >
          <Send size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}
