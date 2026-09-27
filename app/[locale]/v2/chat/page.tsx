"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, LocateFixed, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { setActivePeer } from "@/lib/chatPeer";
import { formatListTime, mergeFriendList, type FriendListEntry } from "@/lib/chat";
import styles from "@/components/v2/v2.module.css";

type ConvoRow = {
  id: string;
  peer: { user_id: string } | null;
  last_message: { body: string | null; created_at: number; mine: boolean } | null;
  unread: number;
  updated_at: number;
};

/**
 * UR D.4 好友消息列表（`/v2/chat` stub 轉正；仿微信＋Snap 混合）。
 * 全好友（在線＋離線都要，`GET /friends`）：在線組置頂＋離線在後，
 * 組內按末信倒序，無記錄沉底；行點即寫 session peer 進 room（沿 D.7 口徑）。
 * 在線行附一定位鈕→地圖深鏈 `?friend=` 飛人＋開卡（卡內可聊）。
 * 未讀徽接 D.2 未讀數（99＋封頂）；開房即清（D.3 讀水位已呼，重進列表即滅）。
 */
export default function V2ChatListPage() {
  const t = useTranslations("v2");
  const locale = useLocale();
  const router = useRouter();
  const homeHref = locale === "zh-Hant" ? "/v2" : `/${locale}/v2`;
  const roomHref = locale === "zh-Hant" ? "/v2/chat/room" : `/${locale}/v2/chat/room`;
  const mapHref = (peerId: string) =>
    `${locale === "zh-Hant" ? "/v2" : `/${locale}/v2`}?friend=${encodeURIComponent(peerId)}`;

  const [entries, setEntries] = useState<FriendListEntry[]>([]);
  // 行內末句／未讀／時間（會話源；key＝peer id，不進 entries 純函數，渲染時查表）。
  const [convoByPeer, setConvoByPeer] = useState(new Map<string, ConvoRow>());
  // UR D.4 fix：加載態（骨架行；空態只在加載完仍零行才顯，避免先空後跳）。
  const [loaded, setLoaded] = useState(false);
  // 列表時間錨點凍結（render 內禁 impure，沿 V2FriendCard 口徑）。
  const [nowMs] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [fRes, cRes] = await Promise.all([
          fetch("/api/v1/friends", { credentials: "include" }),
          fetch("/api/v1/conversations?limit=50", { credentials: "include" }),
        ]);
        if (cancelled) return;
        const fJson = (await fRes.json().catch(() => null)) as {
          friends?: { user_id: string; nickname: string; avatar_url: string | null; online: boolean }[];
        } | null;
        const cJson = (await cRes.json().catch(() => null)) as {
          conversations?: ConvoRow[];
        } | null;
        if (!fRes.ok || !Array.isArray(fJson?.friends)) {
          if (!cancelled) setLoaded(true);
          return;
        }
        const convos = Array.isArray(cJson?.conversations) ? (cJson as { conversations: ConvoRow[] }).conversations : [];
        const updated = new Map<string, number>();
        const byPeer = new Map<string, ConvoRow>();
        for (const c of convos) {
          if (c.peer !== null) {
            updated.set(c.peer.user_id, c.updated_at);
            byPeer.set(c.peer.user_id, c);
          }
        }
        if (cancelled) return;
        setEntries(mergeFriendList(fJson?.friends ?? [], updated));
        setConvoByPeer(byPeer);
        setLoaded(true);
      } catch {
        // 匿名／斷網：靜默空列表（fail-closed，不炸頁）
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const online = entries.filter((e) => e.online);
  const offline = entries.filter((e) => !e.online);

  function openRow(peerId: string): void {
    setActivePeer(peerId);
    router.push(roomHref);
  }

  function rowView(e: FriendListEntry) {
    const hasAvatar = e.avatar_url !== null && /^https?:\/\//.test(e.avatar_url);
    const convo = convoByPeer.get(e.user_id) ?? null;
    const lm = convo?.last_message ?? null;
    // UR D.4 fix：末句帶方向（我發的加「我：」前綴，用戶明確要一眼分清收發）。
    const snippet =
      lm === null ? t("chatEmpty") : `${lm.mine ? `${t("chatMe")}: ` : ""}${lm.body ?? ""}`;
    const time = lm !== null ? formatListTime(lm.created_at, nowMs) : "";
    const unread = convo?.unread ?? 0;
    return (
      <div key={e.user_id} className="flex items-center gap-1">
        <Button
          variant="ghost"
          onClick={() => openRow(e.user_id)}
          className="h-auto min-w-0 flex-1 justify-start gap-3 rounded-2xl p-2"
        >
          <Avatar aria-hidden>
            {hasAvatar ? (
              <AvatarImage src={e.avatar_url as string} alt="" />
            ) : (
              <AvatarFallback>{e.nickname.slice(0, 1)}</AvatarFallback>
            )}
            {e.online && <AvatarBadge className="bg-green-600" />}
          </Avatar>
          <span className="min-w-0 flex-1 text-left">
            <span className="flex items-baseline justify-between gap-2">
              <span className="truncate text-sm font-bold">{e.nickname}</span>
              {time !== "" && (
                <span className="shrink-0 text-[11px] font-normal text-muted-foreground">{time}</span>
              )}
            </span>
            <span className="flex items-center justify-between gap-2">
              <span className="truncate text-xs font-normal text-muted-foreground">{snippet}</span>
              {unread > 0 && (
                <Badge variant="default" className="shrink-0 rounded-full">
                  {unread > 99 ? "99+" : unread}
                </Badge>
              )}
            </span>
          </span>
          <ChevronRight size={16} aria-hidden className="shrink-0 text-muted-foreground" />
        </Button>
        {e.online && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("chatLocate")}
            onClick={() => router.push(mapHref(e.user_id))}
            className="shrink-0 rounded-full"
          >
            <LocateFixed size={16} aria-hidden className="size-4" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={`${styles.v2scope} fixed inset-0 isolate z-[1000] flex h-dvh flex-col gap-2 overflow-hidden bg-background p-4`}>
      <header className="flex shrink-0 items-center gap-2">
        <Button variant="ghost" size="icon" aria-label={t("back")} render={<Link href={homeHref} />} nativeButton={false}>
          <ChevronLeft size={18} aria-hidden className="size-[18px]" />
        </Button>
        <h1 className="text-base font-semibold">{t("chatListTitle")}</h1>
      </header>

      {!loaded ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-2xl p-2">
              <span className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-muted" />
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="h-3.5 w-2/5 animate-pulse rounded-md bg-muted" />
                <span className="h-3 w-3/5 animate-pulse rounded-md bg-muted" />
              </span>
            </div>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <MessageCircle size={40} aria-hidden className="size-10 text-muted-foreground" />
          <p className="max-w-60 text-sm text-muted-foreground">{t("chatListEmpty")}</p>
          <Button variant="outline" render={<Link href={homeHref} />} nativeButton={false}>
            {t("back")}
          </Button>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
          {online.length > 0 && (
            <>
              <p className="px-2 pt-1 text-xs font-bold text-muted-foreground">
                {t("chatOnlineGroup")} · {online.length}
              </p>
              {online.map((e) => rowView(e))}
            </>
          )}
          {offline.length > 0 && (
            <>
              <Separator className="my-1" />
              <p className="px-2 text-xs font-bold text-muted-foreground">
                {t("chatOfflineGroup")} · {offline.length}
              </p>
              {offline.map((e) => rowView(e))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
