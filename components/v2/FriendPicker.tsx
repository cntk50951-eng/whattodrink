"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Check, Search } from "lucide-react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { usePlaceName } from "@/hooks/usePlaceName";
import { setActivePeer } from "@/lib/chatPeer";
import type { FriendListItem } from "@/lib/friends";
import styles from "./v2.module.css";

/** `GET /friends` 行形（已映射四字段，见 chat/page.tsx 同接口用法）。 */
function toPickerFriend(raw: unknown): FriendListItem | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.user_id !== "string" || r.user_id === "") return null;
  if (typeof r.nickname !== "string" || r.nickname === "") return null;
  if (r.avatar_url !== null && typeof r.avatar_url !== "string") return null;
  return {
    user_id: r.user_id,
    nickname: r.nickname,
    avatar_url: r.avatar_url,
    online: r.online === true,
  };
}

/**
 * UR E.13 站内分享好友选择器（v2-only；自家打卡→好友，搜索＋多选＋确认栏）。
 * 数据沿 `GET /friends`（toFriendListItem 四字段窄化，不过滤在线——离线照发，沿消息可达口径）。
 * 发送＝逐好友 find-or-create 会话（D.2 `POST /conversations`）＋发分享消息
 * （`kind:text ＋ attachments:[{checkin_id}]`）；多选即逐人单发，不建群。
 */
export function FriendPicker({
  open,
  checkinId,
  snippet,
  place,
  lat,
  lng,
  onClose,
  onSent,
}: {
  open: boolean;
  /** 被分享的打卡 DB id（无即不挂，调用方守）。 */
  checkinId: string;
  /** 消息正文兜底（店名／酒名；列表卡片＋旧端显示用）。 */
  snippet: string;
  /** 地点展示（店名／区名，非坐标；卡片地点行用，可空）。 */
  place: string;
  /** 坐标（place 为空时反查地名用；与 place 同源发送）。 */
  lat: number | null;
  lng: number | null;
  onClose: () => void;
  /** 发完回调（成功者 uid＋失败数；调用方去留问＋关）。 */
  onSent: (result: { ok: string[]; failed: number }) => void;
}) {
  const t = useTranslations("v2");
  // UR E.13：发送时地名落附件（place 空即反查坐标，Nominatim 措辞与 Extra 同源）。
  const resolvedPlace = usePlaceName(place, lat, lng);
  const [friends, setFriends] = useState<FriendListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // 开即重置（换帖换人，沿 V2Comments 切帖清残影口径）。
    // eslint-disable-next-line react-hooks/set-state-in-effect -- open 翻转同步重置属 props-sync（沿开房重置豁免口径）
    setQuery("");
    setMessage("");
    setSelected(new Set());
    setBanner(null);
    setLoading(true);
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/v1/friends", { credentials: "include" });
        if (!res.ok || cancelled) return;
        const j = (await res.json()) as { friends?: unknown[] };
        const list = (j.friends ?? [])
          .map((r) => toPickerFriend(r))
          .filter((f): f is FriendListItem => f !== null);
        if (!cancelled) setFriends(list);
      } catch {
        if (!cancelled) setBanner(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, checkinId]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === "") return friends;
    return friends.filter((f) => f.nickname.toLowerCase().includes(q));
  }, [friends, query]);

  const toggle = (uid: string): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const send = async (): Promise<void> => {
    if (sending || selected.size === 0) return;
    setSending(true);
    setBanner(null);
    // 留言即正文（卡片标题同步）；空即店名 snippet 兜底旧端显示。
    const body = message.trim() === "" ? snippet : message.trim().slice(0, 200);
    const sharePlace = (resolvedPlace ?? place).trim().slice(0, 120);
    let failed = 0;
    const okUids: string[] = [];
    let firstError: string | null = null;
    // 逐人单发（失败不挡后人；首错行内显，沿 E.7 banner 口径）。
    for (const uid of selected) {
      try {
        const cRes = await fetch("/api/v1/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ user_id: uid }),
        });
        const cJson = (await cRes.json().catch(() => null)) as {
          id?: unknown;
          conversation?: { id?: unknown };
          error?: { message?: unknown };
        } | null;
        const convId =
          (typeof cJson?.id === "string" && cJson.id) ||
          (typeof cJson?.conversation?.id === "string" ? cJson.conversation.id : null);
        if (!cRes.ok || convId === null) {
          throw new Error(
            typeof cJson?.error?.message === "string" ? cJson.error.message : "建会话失败",
          );
        }
        const mRes = await fetch(`/api/v1/conversations/${encodeURIComponent(convId)}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            kind: "text",
            body,
            attachments: [
              sharePlace === ""
                ? { checkin_id: checkinId }
                : { checkin_id: checkinId, place: sharePlace },
            ],
            client_msg_id:
              typeof crypto.randomUUID === "function"
                ? crypto.randomUUID()
                : `${Date.now()}-${uid}`,
          }),
        });
        if (!mRes.ok) {
          const mJson = (await mRes.json().catch(() => null)) as {
            error?: { message?: unknown };
          } | null;
          throw new Error(
            typeof mJson?.error?.message === "string" ? mJson.error.message : "发送失败",
          );
        }
        okUids.push(uid);
      } catch (e) {
        failed += 1;
        if (firstError === null) firstError = e instanceof Error ? e.message : "发送失败";
      }
    }
    setSending(false);
    if (okUids.length > 0) {
      onSent({ ok: okUids, failed });
      onClose();
    } else if (firstError !== null) {
      setBanner(firstError);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className={`${styles.v2scope} max-h-[70svh] gap-4 overflow-y-auto rounded-t-2xl p-4 sm:mx-auto sm:w-full sm:max-w-md`}
      >
        <div aria-hidden className="mx-auto h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" />
        <SheetHeader className="text-left">
          <SheetTitle>{t("friendPickerTitle")}</SheetTitle>
          <SheetDescription>{snippet}</SheetDescription>
        </SheetHeader>
        <div className="relative">
          <Search
            size={15}
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("friendPickerSearch")}
            aria-label={t("friendPickerSearch")}
            className="pl-9"
          />
        </div>
        {banner !== null && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-2.5 py-1.5 text-sm text-destructive">
            {banner}
          </p>
        )}
        {loading ? (
          <div className="flex flex-col gap-2" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-muted" />
                <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("friendPickerEmpty")}</p>
        ) : (
          <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
            {visible.map((f) => {
              const on = selected.has(f.user_id);
              return (
                <button
                  key={f.user_id}
                  type="button"
                  onClick={() => toggle(f.user_id)}
                  aria-pressed={on}
                  className={`flex items-center gap-2.5 rounded-xl px-2 py-2 text-left ${
                    on ? "bg-primary/[0.08]" : ""
                  }`}
                >
                  <span
                    aria-hidden
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground"
                  >
                    {f.nickname.slice(0, 1)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{f.nickname}</span>
                  </span>
                  {f.online && (
                    <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-green-600" />
                  )}
                  <span
                    aria-hidden
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
                    }`}
                  >
                    {on && <Check size={13} />}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t("friendPickerMessage")}
          aria-label={t("friendPickerMessage")}
          maxLength={200}
        />
        <Button onClick={() => void send()} disabled={selected.size === 0 || sending} className="w-full">
          {sending ? "…" : t("friendPickerSend", { n: selected.size })}
        </Button>
      </SheetContent>
    </Sheet>
  );
}

/**
 * UR E.13 round-2 分享完成去留问（微信式：成功数＋去聊天／留当前）。
 * 单人直进房（setActivePeer＋push room，沿列表 openRow 口径），
 * 多人进列表；部分失败即附數，不挡去留。
 */
export function ShareDoneDialog({
  result,
  onClose,
}: {
  result: { ok: string[]; failed: number } | null;
  onClose: () => void;
}) {
  const t = useTranslations("v2");
  const locale = useLocale();
  const router = useRouter();
  if (result === null) return null;
  const goChat = (): void => {
    onClose();
    if (result.ok.length === 1 && result.ok[0] !== undefined) {
      setActivePeer(result.ok[0]);
      router.push(locale === "zh-Hant" ? "/v2/chat/room" : `/${locale}/v2/chat/room`);
    } else {
      router.push(locale === "zh-Hant" ? "/v2/chat" : `/${locale}/v2/chat`);
    }
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className={`${styles.v2scope} max-w-xs`}>
        <DialogHeader>
          <DialogTitle className="text-center">
            {t("friendPickerSent", { n: result.ok.length })}
          </DialogTitle>
        </DialogHeader>
        {result.failed > 0 && (
          <p className="text-center text-xs text-muted-foreground">
            {t("sharePartialFail", { n: result.failed })}
          </p>
        )}
        <div className="flex flex-col gap-2">
          <Button onClick={goChat} className="w-full">
            {t("shareGoChat")}
          </Button>
          <Button variant="outline" onClick={onClose} className="w-full">
            {t("shareStay")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
