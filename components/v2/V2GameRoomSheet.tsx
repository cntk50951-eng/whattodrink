"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Crown } from "lucide-react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  gameSocialErrorKey,
  joinStatusKey,
  parseGamePlayer,
  parseGameRoom,
  parseJoinRequest,
  parseJoinStatus,
  type GamePlayer,
  type GameRoom,
  type JoinRequest,
} from "@/lib/gameRoom";
import styles from "./v2.module.css";

type Err = { error?: { code?: string; message?: string } } | null;

async function post(path: string, body: unknown): Promise<{ status: number; j: Err }> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const j = (await res.json().catch(() => null)) as Err;
  return { status: res.status, j };
}

/**
 * UR G.10a 房間（v2-only；lobby＋審批）。
 * `roomId` 或 `pending:<requestId>`（陌生人等批：5s 輪詢，過了進房，拒了給人話）；
 * 房內 3s 輪詢 `?since=`（304 即無變化）；準備／開始（房主）／離開／踢＋審批。
 * 叫骰（G.10b）／聊天舉報（G.10c）另批，開局後只留一句。
 */
export function V2GameRoomSheet({
  open,
  onClose,
  target,
  myUserId,
}: {
  open: boolean;
  onClose: () => void;
  /** 房 id，或 `pending:<requestId>`（等批中）。 */
  target: string;
  myUserId: string | null;
}) {
  const t = useTranslations("v2");
  const [roomId, setRoomId] = useState<string | null>(target.startsWith("pending:") ? null : target);
  const [pendingId, setPendingId] = useState<string | null>(
    target.startsWith("pending:") ? target.slice("pending:".length) : null,
  );
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [pendText, setPendText] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const versionRef = useRef(0);

  const errText = useCallback(
    (status: number, j: Err): string => {
      const c = typeof j?.error?.code === "string" ? j.error.code : null;
      if (status === 401) return t("gameErrAuth");
      const key = gameSocialErrorKey(c);
      if (key !== null) return t(key);
      return j?.error?.message ?? t("gameErrOther");
    },
    [t],
  );

  const loadRoom = useCallback(
    async (id: string, since?: number) => {
      const qs = since !== undefined && since > 0 ? `?since=${since}` : "";
      const res = await fetch(`/api/v1/games/rooms/${encodeURIComponent(id)}${qs}`, {
        cache: "no-store",
        credentials: "include",
      });
      if (res.status === 304) return;
      const j = (await res.json().catch(() => null)) as {
        room?: unknown;
        players?: unknown[];
        error?: { code?: string; message?: string };
      } | null;
      if (!res.ok || j === null) throw new Error(errText(res.status, j));
      const r = parseGameRoom(j.room);
      if (r === null) throw new Error(t("gameErrOther"));
      const ps: GamePlayer[] = [];
      for (const p of Array.isArray(j.players) ? j.players : []) {
        const m = parseGamePlayer(p);
        if (m !== null) ps.push(m);
      }
      ps.sort((a, b) => a.seat - b.seat);
      setRoom(r);
      setPlayers(ps);
      versionRef.current = r.version;
    },
    [errText, t],
  );

  const loadRequests = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/v1/games/rooms/${encodeURIComponent(id)}/requests`, {
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok) return;
        const j = (await res.json().catch(() => null)) as { items?: unknown[] } | null;
        const rows: JoinRequest[] = [];
        for (const x of j !== null && Array.isArray(j.items) ? j.items : []) {
          const m = parseJoinRequest(x);
          if (m !== null) rows.push(m);
        }
        setRequests(rows);
      } catch {}
    },
    [],
  );

  // 房內輪詢（3s；since 追平 304 即跳過渲染）。
  useEffect(() => {
    if (!open || roomId === null) return;
    let stop = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 開房即拉＋3s 輪詢屬 props-sync（沿 V2NewsSheet 口径）
    void loadRoom(roomId).catch((e) => {
      if (!stop) setErr(e instanceof Error ? e.message : t("gameErrOther"));
    });
    void loadRequests(roomId);
    const id = window.setInterval(() => {
      if (stop) return;
      void loadRoom(roomId, versionRef.current)
        .then(() => loadRequests(roomId))
        .catch(() => {});
    }, 3000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [open, roomId, loadRoom, loadRequests, t]);

  // 等批輪詢（5s；過了進房，拒了給人話可重試）。
  useEffect(() => {
    if (!open || pendingId === null || roomId !== null) return;
    let stop = false;
    const tick = async (): Promise<void> => {
      try {
        const res = await fetch(`/api/v1/games/join-requests/${encodeURIComponent(pendingId)}`, {
          cache: "no-store",
          credentials: "include",
        });
        const j = (await res.json().catch(() => null)) as { status?: string; room_id?: string; error?: { message?: string } } | null;
        if (!res.ok || j === null) throw new Error(j?.error?.message ?? t("gameErrOther"));
        const s = parseJoinStatus(j);
        if (s === null) return;
        if (s.status === "approved" && s.roomId !== null) {
          setRoomId(s.roomId);
          setPendingId(null);
          setPendText(null);
          return;
        }
        const key = joinStatusKey(s.status);
        if (key !== null && !stop) setPendText(t(key));
      } catch (e) {
        if (!stop) setErr(e instanceof Error ? e.message : t("gameErrOther"));
      }
    };
    void tick();
    const id = window.setInterval(() => {
      if (!stop) void tick();
    }, 5000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [open, pendingId, roomId, t]);

  async function act(path: string, body: unknown, after?: () => Promise<void>): Promise<void> {
    setBusy(true);
    setErr(null);
    try {
      const { status, j } = await post(path, body);
      if (status !== 200) throw new Error(errText(status, j));
      if (after !== undefined) await after();
      else if (roomId !== null) {
        await loadRoom(roomId);
        await loadRequests(roomId);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("gameErrOther"));
    } finally {
      setBusy(false);
    }
  }

  async function cancelPending(): Promise<void> {
    if (pendingId === null) return;
    setBusy(true);
    try {
      await fetch(`/api/v1/games/join-requests/${encodeURIComponent(pendingId)}`, {
        method: "DELETE",
        credentials: "include",
      });
    } catch {}
    setBusy(false);
    onClose();
  }

  const isHost = room !== null && myUserId !== null && room.host_id === myUserId;
  const me = players.find((p) => p.user_id === myUserId) ?? null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className={`${styles.v2scope} max-h-[85svh] gap-4 overflow-y-auto rounded-t-2xl p-4 sm:mx-auto sm:w-full sm:max-w-md`}
      >
        <SheetHeader>
          <SheetTitle>{t("gameRoom")}</SheetTitle>
          <SheetDescription className="sr-only">{t("gameRoom")}</SheetDescription>
        </SheetHeader>
        {err !== null && (
          <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-2 text-sm">
            {err}
          </p>
        )}
        {roomId === null ? (
          <div className="flex flex-col items-center gap-2 py-8" role="status">
            <span aria-hidden className="h-10 w-10 animate-spin rounded-full border-2 border-muted border-t-primary" />
            <p className="text-sm text-muted-foreground">{pendText ?? t("gamePending")}</p>
            {pendText !== null && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border px-3 py-1.5 text-sm font-bold"
              >
                {t("gameBack")}
              </button>
            )}
            {pendText === null && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void cancelPending()}
                className="rounded-full border px-3 py-1.5 text-sm font-bold disabled:opacity-50"
              >
                {t("reqCancel")}
              </button>
            )}
          </div>
        ) : room === null ? (
          <div className="flex flex-col gap-2" aria-hidden>
            {[1, 2, 3].map((n) => (
              <span key={n} className="h-4 w-2/3 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <p className="flex-1 text-base font-bold">
                {t("gameCode")} <span className="tracking-widest">{room.code}</span>
              </p>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold">
                {room.status === "lobby" ? t("gameLobby") : t("gamePlaying")}
              </span>
            </div>
            <ul className="flex flex-col gap-1.5">
              {players.map((p) => (
                <li key={p.user_id} className="flex items-center gap-2 rounded-xl border p-2 text-sm">
                  <span
                    aria-hidden
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground"
                  >
                    {p.nickname.slice(0, 1)}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-bold">
                    {p.nickname}
                    {p.user_id === room.host_id && <Crown size={13} aria-label={t("gameHost")} className="ml-1 inline text-primary" />}
                  </span>
                  {!p.online && <span className="text-xs text-muted-foreground">{t("gameOffline")}</span>}
                  <span className={`text-xs font-bold ${p.ready ? "text-green-600" : "text-muted-foreground"}`}>
                    {p.ready ? t("gameReadyYes") : t("gameReadyNo")}
                  </span>
                  {isHost && p.user_id !== myUserId && room.status === "lobby" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void act(`/api/v1/games/rooms/${encodeURIComponent(room.id)}/kick`, { user_id: p.user_id })}
                      className="shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold disabled:opacity-50"
                    >
                      {t("gameKick")}
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {isHost && requests.length > 0 && room.status === "lobby" && (
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-bold text-muted-foreground">{t("gameRequests", { n: requests.length })}</p>
                {requests.map((r) => (
                  <div key={r.request_id} className="flex items-center gap-2 rounded-xl border border-primary/40 p-2 text-sm">
                    <span className="min-w-0 flex-1 truncate font-bold">{r.nickname}</span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void act(`/api/v1/games/rooms/${encodeURIComponent(room.id)}/requests/${encodeURIComponent(r.request_id)}`, {
                          decision: "approve",
                        })
                      }
                      className="shrink-0 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground disabled:opacity-50"
                    >
                      {t("reqAccept")}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void act(`/api/v1/games/rooms/${encodeURIComponent(room.id)}/requests/${encodeURIComponent(r.request_id)}`, {
                          decision: "reject",
                        })
                      }
                      className="shrink-0 rounded-full border px-3 py-1 text-xs font-bold disabled:opacity-50"
                    >
                      {t("reqDecline")}
                    </button>
                  </div>
                ))}
              </div>
            )}
            {room.status === "lobby" ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy || me === null}
                  onClick={() => void act(`/api/v1/games/rooms/${encodeURIComponent(room.id)}/ready`, { ready: !(me?.ready === true) })}
                  aria-pressed={me?.ready === true}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm font-bold disabled:opacity-50 ${me?.ready === true ? "border-primary text-primary" : ""}`}
                >
                  {me?.ready === true ? t("gameUnready") : t("gameReady")}
                </button>
                {isHost && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void act(`/api/v1/games/rooms/${encodeURIComponent(room.id)}/start`, {})}
                    className="flex-1 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
                  >
                    {t("gameStart")}
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    void act(`/api/v1/games/rooms/${encodeURIComponent(room.id)}/leave`, {}).then(onClose);
                  }}
                  className="flex-1 rounded-xl border px-3 py-2 text-sm font-bold disabled:opacity-50"
                >
                  {t("gameLeave")}
                </button>
              </div>
            ) : (
              <p className="rounded-xl bg-muted p-3 text-center text-sm text-muted-foreground">{t("gamePlayingSoon")}</p>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
