"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { LoaderCircle, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { remainParts } from "@/lib/chat";
import { setActivePeer } from "@/lib/chatPeer";

type InvitePeer = { user_id: string; nickname: string; avatar_url: string | null };
type InviteItem = {
  id: string;
  peer: InvitePeer;
  place: string;
  checkin_id: string | null;
  start_at: string | null;
  expires_at: string | null;
  status: string;
  created_at: string;
  is_friend: boolean;
};

function AvatarMini({ name, url }: { name: string; url: string | null }) {
  if (url !== null && /^https?:\/\//.test(url)) {
    /* eslint-disable-next-line @next/next/no-img-element */
    return <img src={url} alt="" loading="lazy" className="h-9 w-9 shrink-0 rounded-full object-cover" />;
  }
  return (
    <span
      aria-hidden
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground"
    >
      {name.slice(0, 1)}
    </span>
  );
}

function LeftText({ expiresAt, nowMs }: { expiresAt: string | null; nowMs: number }) {
  const t = useTranslations("v2");
  if (expiresAt === null) return null;
  const r = remainParts(Date.parse(expiresAt), nowMs);
  if (r.over) return <span className="text-xs text-muted-foreground">{t("inviteOver")}</span>;
  const text = r.d > 0 ? t("inviteLeftD", { d: r.d }) : r.h > 0 ? t("inviteLeftH", { h: r.h }) : t("inviteLeftM", { m: r.m });
  return <span className="text-xs font-bold text-primary">{text}</span>;
}

/**
 * UR E.16 好友列表邀請籤（v2-only；陌生人折叠＋默认 App 内提示不推送，好友才推送）。
 * 收到：待回（按截止排序＋倒计时）＋已约好卡（安全卡＋去聊天）；陌生人折叠区。
 * 送出：等待（倒计时＋撤回）／已撤回／未成局（过期＋被忽略＋24h）／已约好。
 */
export function InviteList({ onPending }: { onPending: (n: number) => void }) {
  const t = useTranslations("v2");
  const locale = useLocale();
  const router = useRouter();
  const [inbox, setInbox] = useState<InviteItem[]>([]);
  const [sent, setSent] = useState<InviteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [strangersOpen, setStrangersOpen] = useState(false);
  // 倒计时 tick（60s 一次足够，无需秒级）。
  const [nowMs, setNowMs] = useState(() => Date.now());
  const pendingRef = useRef(onPending);
  useEffect(() => {
    pendingRef.current = onPending;
  });

  const load = useCallback(async () => {
    try {
      const [iRes, sRes] = await Promise.all([
        fetch("/api/v1/invites?box=inbox", { credentials: "include" }),
        fetch("/api/v1/invites?box=sent", { credentials: "include" }),
      ]);
      if (iRes.ok) {
        const j = (await iRes.json()) as { items?: InviteItem[] };
        if (Array.isArray(j.items)) {
          const rows = j.items.filter((r) => r.status === "sent" || r.status === "accepted");
          setInbox(rows);
          pendingRef.current?.(rows.filter((r) => r.status === "sent").length);
        }
      }
      if (sRes.ok) {
        const j = (await sRes.json()) as { items?: InviteItem[] };
        if (Array.isArray(j.items)) setSent(j.items);
      }
    } catch {
      /* 列表失败静默（空态即视，沿 V2Comments 口径） */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // mount 拉取包 microtask（首行 setLoading 直寫撞 lint，沿 V2Comments 口径）。
    queueMicrotask(() => {
      void load();
    });
    const iv = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(iv);
  }, [load]);

  const patch = async (key: string, id: string, action: string): Promise<boolean> => {
    if (busy !== null) return false;
    setBusy(key);
    try {
      const res = await fetch(`/api/v1/invites/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action }),
      });
      if (!res.ok) return false;
      await load();
      return true;
    } catch {
      return false;
    } finally {
      setBusy(null);
    }
  };

  const goChat = (peerId: string): void => {
    setActivePeer(peerId);
    router.push(locale === "zh-Hant" ? "/v2/chat/room" : `/${locale}/v2/chat/room`);
  };

  // UR E.16 round-2：接受即进房＋默认首语（接受＋地点＋打卡卡，有帖才带卡）。
  const acceptInvite = async (r: InviteItem): Promise<void> => {
    if (busy !== null) return;
    setBusy(`a-${r.id}`);
    try {
      const aRes = await fetch(`/api/v1/invites/${encodeURIComponent(r.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "accept" }),
      });
      const aJson = (await aRes.json().catch(() => null)) as {
        place?: unknown;
        checkin_id?: unknown;
      } | null;
      if (!aRes.ok) return;
      const place = typeof aJson?.place === "string" && aJson.place !== "" ? aJson.place : r.place;
      const cid = typeof aJson?.checkin_id === "string" ? aJson.checkin_id : r.checkin_id;
      const cRes = await fetch("/api/v1/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ user_id: r.peer.user_id }),
      });
      const cJson = (await cRes.json().catch(() => null)) as { id?: unknown } | null;
      if (cRes.ok && typeof cJson?.id === "string") {
        await fetch(`/api/v1/conversations/${encodeURIComponent(cJson.id)}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            kind: "text",
            body: `${t("inviteAccepted")}：${place}`,
            ...(cid !== null && cid !== "" ? { attachments: [{ checkin_id: cid }] } : {}),
            client_msg_id:
              typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${r.id}`,
          }),
        }).catch(() => {});
      }
      await load();
      goChat(r.peer.user_id);
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-2" aria-hidden>
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl p-2">
            <span className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-muted" />
            <span className="h-4 w-2/5 animate-pulse rounded-md bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  const pending = inbox.filter((r) => r.status === "sent");
  const upcoming = inbox.filter((r) => r.status === "accepted");
  const friendPend = pending.filter((r) => r.is_friend);
  const strangerPend = pending.filter((r) => !r.is_friend);

  const inviteRow = (
    r: InviteItem,
    actions: ReactNode,
    extra?: ReactNode,
  ): React.JSX.Element => (
    <div key={r.id} className="flex items-center gap-2.5 rounded-2xl px-2 py-2">
      <AvatarMini name={r.peer.nickname} url={r.peer.avatar_url} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">
          <span className="font-bold">{r.peer.nickname}</span>
        </p>
        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
          <MapPin size={12} aria-hidden className="shrink-0" />
          <span className="truncate">{r.place}</span>
        </p>
        <LeftText expiresAt={r.expires_at} nowMs={nowMs} />
        {extra}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">{actions}</div>
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
      {pending.length === 0 && upcoming.length === 0 && sent.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("mailEmpty")}</p>
      ) : (
        <>
          {friendPend.map((r) =>
            inviteRow(
              r,
              <>
                <Button
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => void acceptInvite(r)}
                  className="rounded-full font-bold"
                >
                  {busy === `a-${r.id}` && (
                    <LoaderCircle size={13} aria-hidden className="animate-spin" />
                  )}
                  {t("inviteAccept")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy !== null}
                  onClick={() => void patch(`d-${r.id}`, r.id, "decline")}
                  className="rounded-full text-muted-foreground"
                >
                  {t("inviteIgnore")}
                </Button>
              </>,
            ),
          )}
          {strangerPend.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setStrangersOpen((v) => !v)}
                aria-expanded={strangersOpen}
                className="w-fit px-2 pt-1 text-xs font-bold text-muted-foreground"
              >
                {t("inviteStrangers")} · {strangerPend.length} {strangersOpen ? "▾" : "▸"}
              </button>
              {strangersOpen &&
                strangerPend.map((r) =>
                  inviteRow(
                    r,
                    <>
                      <Button
                        size="sm"
                        disabled={busy !== null}
                        onClick={() => void acceptInvite(r)}
                        className="rounded-full font-bold"
                      >
                        {busy === `a-${r.id}` && (
                          <LoaderCircle size={13} aria-hidden className="animate-spin" />
                        )}
                        {t("inviteAccept")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy !== null}
                        onClick={() => void patch(`d-${r.id}`, r.id, "decline")}
                        className="rounded-full text-muted-foreground"
                      >
                        {t("inviteIgnore")}
                      </Button>
                    </>,
                  ),
                )}
            </>
          )}
          {upcoming.map((r) =>
            inviteRow(
              r,
              <Button
                size="sm"
                variant="outline"
                onClick={() => goChat(r.peer.user_id)}
                className="rounded-full"
              >
                {t("inviteGoChat")}
              </Button>,
              <p className="pt-0.5 text-xs text-muted-foreground">{t("inviteSafetyCard")}</p>,
            ),
          )}
          {sent.length > 0 && (
            <>
              <p className="px-2 pt-2 text-xs font-bold text-muted-foreground">{t("inviteMine")}</p>
              {sent.map((s) => {
                const st =
                  s.status === "accepted"
                    ? t("inviteAccepted")
                    : s.status === "recalled"
                      ? t("inviteRecalled")
                      : s.status === "declined"
                        ? t("inviteNoReply")
                        : (() => {
                            const r = remainParts(
                              s.expires_at === null ? NaN : Date.parse(s.expires_at),
                              nowMs,
                            );
                            return r.over ? t("inviteNoReply") : t("inviteWaiting");
                          })();
                return inviteRow(
                  { ...s, peer: s.peer },
                  s.status === "sent" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy !== null}
                      onClick={() => void patch(`r-${s.id}`, s.id, "recall")}
                      className="rounded-full text-muted-foreground"
                    >
                      {t("inviteRecall")}
                    </Button>
                  ) : s.status === "accepted" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => goChat(s.peer.user_id)}
                      className="rounded-full"
                    >
                      {t("inviteGoChat")}
                    </Button>
                  ) : undefined,
                  <p className="pt-0.5 text-xs text-muted-foreground">{st}</p>,
                );
              })}
            </>
          )}
        </>
      )}
    </div>
  );
}
