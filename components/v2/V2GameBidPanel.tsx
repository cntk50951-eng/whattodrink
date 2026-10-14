"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { isValidBid } from "@/lib/games/liars";
import { gameSocialErrorKey, type GamePlayer, type GameRound } from "@/lib/gameRoom";

const FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

function faceOf(n: number): string {
  return n >= 1 && n <= 6 ? (FACES[n - 1] as string) : "·";
}

function nick(players: GamePlayer[], id: string | null, me: string | null, t: (k: string) => string): string {
  if (id === null) return t("gameNobody");
  if (id === me) return t("gameYou");
  return players.find((p) => p.user_id === id)?.nickname ?? t("gameNobody");
}

/**
 * UR G.10b 線上叫骰（v2-only；掛房間 Sheet 內，對局中才出現）。
 * 我的骰＋上一口＋輪次倒數＋叫骰面板（合法性預判沿服務端 isValidBid）＋開盅＋
 * 開盅結果＋下一局；deal_only 房只亮骰。最終以服務端為準（422／409 人話透傳）。
 */
export function V2GameBidPanel({
  roomId,
  dealOnly,
  minOpenQty,
  zhaiEnabled,
  round,
  players,
  myUserId,
  expectedVersion,
  onDone,
}: {
  roomId: string;
  dealOnly: boolean;
  minOpenQty: number;
  zhaiEnabled: boolean;
  round: GameRound;
  players: GamePlayer[];
  myUserId: string | null;
  expectedVersion: number;
  onDone: () => Promise<void>;
}) {
  const t = useTranslations("v2");
  const [qty, setQty] = useState(round.last_bid !== null ? round.last_bid.qty : minOpenQty);
  const [face, setFace] = useState(round.last_bid !== null ? round.last_bid.face : 1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [nowMs] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const seq = useRef(0);

  // 倒數 tick（半秒一格累加，免 Date.now purity 門，沿 G.6 口徑）。
  useEffect(() => {
    if (round.turn_deadline === null || round.status !== "bidding") return;
    const id = window.setInterval(() => setElapsed((e) => e + 0.5), 500);
    return () => window.clearInterval(id);
  }, [round.turn_deadline, round.status, round.no]);

  const myTurn = round.current_turn_user !== null && round.current_turn_user === myUserId;
  const prev = round.last_bid !== null ? { qty: round.last_bid.qty, face: round.last_bid.face, zhai: round.last_bid.zhai } : null;
  const check = isValidBid(prev, { qty, face }, { mode: "standard", dice_per_player: 5, min_open_qty: minOpenQty, ones_wild: true, ones_break: false, zhai_enabled: zhaiEnabled, turn_seconds: 30 });
  const bidReason = check.ok ? null : check.reason;

  const deadlineMs = round.turn_deadline !== null ? Date.parse(round.turn_deadline) : NaN;
  const remainSec =
    Number.isFinite(deadlineMs) && round.status === "bidding"
      ? Math.max(0, Math.round(deadlineMs - nowMs - elapsed * 1000) / 1000)
      : null;

  async function send(type: string, payload: Record<string, unknown>): Promise<void> {
    setBusy(true);
    setErr(null);
    try {
      seq.current += 1;
      const actionId =
        typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${roomId}-${seq.current}`;
      const res = await fetch(`/api/v1/games/rooms/${encodeURIComponent(roomId)}/actions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type, payload, expected_version: expectedVersion, client_action_id: actionId }),
      });
      const j = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
      if (!res.ok) {
        const code = typeof j?.error?.code === "string" ? j.error.code : null;
        if (code === "stale_version") {
          await onDone();
          return;
        }
        const key = gameSocialErrorKey(code);
        throw new Error(key !== null ? t(key) : (j?.error?.message ?? t("gameErrOther")));
      }
      await onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("gameErrOther"));
    } finally {
      setBusy(false);
    }
  }

  const rv = round.revealed;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-primary/40 p-3">
      <p className="flex items-center justify-between text-sm font-bold">
        <span>
          {t("gameRound", { n: round.no })}
          {round.status === "revealed" ? ` · ${t("gameRevealed")}` : ""}
        </span>
        {remainSec !== null && <span className="text-muted-foreground">{t("gameCountdown", { n: remainSec })}</span>}
      </p>
      {err !== null && (
        <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-2 text-xs">
          {err}
        </p>
      )}
      {round.my_dice.length > 0 && (
        <p className="text-2xl tracking-wider" aria-label={t("gameMyDice")}>
          {round.my_dice.map((d, i) => (
            <span key={i} aria-hidden>
              {faceOf(d)}
            </span>
          ))}
        </p>
      )}
      {round.last_bid !== null && (
        <p className="text-sm">
          {t("gameLastBid", { n: round.last_bid.qty, f: round.last_bid.face })}
          {round.last_bid.zhai ? ` ${t("gameZhai")}` : ""}
        </p>
      )}
      {round.status === "bidding" && (
        <p className="text-xs text-muted-foreground">
          {t("gameTurn")}{nick(players, round.current_turn_user, myUserId, t)}
        </p>
      )}
      {rv !== null && (
        <div className="flex flex-col gap-1 rounded-xl bg-muted p-2 text-sm">
          <p className="font-bold">
            {t("gameCounted", { n: rv.counted ?? 0 })}
            {rv.bid_met !== null ? (rv.bid_met ? ` · ${t("gameBidMet")}` : ` · ${t("gameBidMiss")}`) : ""}
          </p>
          {rv.loser_id !== null && (
            <p>
              {nick(players, rv.loser_id, myUserId, t)} {t("gameDrink")}
            </p>
          )}
        </div>
      )}
      {round.status === "bidding" && !dealOnly && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold">{t("gameQty")}</span>
            <button type="button" disabled={!myTurn || busy || qty <= 1} onClick={() => setQty(qty - 1)} aria-label={`${t("gameQty")}-`} className="rounded-full border px-2.5 py-1 font-bold disabled:opacity-50">−</button>
            <span className="w-8 text-center font-bold" aria-live="polite">{qty}</span>
            <button type="button" disabled={!myTurn || busy} onClick={() => setQty(qty + 1)} aria-label={`${t("gameQty")}+`} className="rounded-full border px-2.5 py-1 font-bold disabled:opacity-50">＋</button>
            <span className="flex gap-1 pl-2">
              {[1, 2, 3, 4, 5, 6].map((f) => (
                <button
                  key={f}
                  type="button"
                  disabled={!myTurn || busy}
                  onClick={() => setFace(f)}
                  aria-pressed={face === f}
                  aria-label={`${f}`}
                  className={`rounded-lg border px-1.5 py-1 text-lg disabled:opacity-50 ${face === f ? "border-primary" : ""}`}
                >
                  <span aria-hidden>{faceOf(f)}</span>
                </button>
              ))}
            </span>
          </div>
          {bidReason !== null && myTurn && <p className="text-xs text-muted-foreground">{bidReason}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || !myTurn || bidReason !== null}
              onClick={() => void send("bid", { qty, face })}
              className="flex-1 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              {t("gameBid", { n: qty, f: face })}
            </button>
            {round.last_bid !== null && (
              <button
                type="button"
                disabled={busy || !myTurn}
                onClick={() => void send("challenge", {})}
                className="flex-1 rounded-xl border border-destructive px-3 py-2 text-sm font-bold text-destructive disabled:opacity-50"
              >
                {t("gameChallenge")}
              </button>
            )}
          </div>
          {!myTurn && <p className="text-xs text-muted-foreground">{t("gameWaitTurn")}</p>}
        </div>
      )}
      {round.status === "bidding" && dealOnly && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void send("reveal", {})}
          className="rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {t("gameReveal")}
        </button>
      )}
      {round.status === "revealed" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void send("next_round", {})}
          className="rounded-xl border px-3 py-2 text-sm font-bold disabled:opacity-50"
        >
          {t("gameNextRound")}
        </button>
      )}
    </div>
  );
}
