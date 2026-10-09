"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, LocateFixed, MapPin, MessageCircle, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { setActivePeer } from "@/lib/chatPeer";
import { createClient } from "@/lib/supabase/client";
import { InviteList } from "@/components/v2/InviteList";
import { filterFriends, formatListTime, mergeFriendList, type FriendListEntry } from "@/lib/chat";
import { formatDistance, haversineMeters, initialBearing } from "@/lib/geo";
import { useGeolocation } from "@/hooks/useGeolocation";
import styles from "@/components/v2/v2.module.css";

type ConvoRow = {
  id: string;
  peer: { user_id: string } | null;
  last_message: {
    body: string | null;
    kind: string;
    created_at: number;
    mine: boolean;
    attachments?: { secs?: number; checkin_id?: string; place?: string }[];
  } | null;
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
  // UR E.16：好友／邀請雙籤（邀請紅點＋倒計時＋陌生人折叠；默認好友籤）。
  const [chatTab, setChatTab] = useState<"friends" | "invites">("friends");
  const [invitePending, setInvitePending] = useState(0);
  // UR G.5：昵称即滤（本地子串，零新端点，沿 iOS filterFriends）。
  const [query, setQuery] = useState("");
  // UR G.5：最近 8（点行即记，localStorage；空 query 才露 chips）。
  const [recents, setRecents] = useState<{ user_id: string; nickname: string }[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem("wtd-chat-recents");
      const arr = raw === null ? [] : (JSON.parse(raw) as unknown);
      if (!Array.isArray(arr)) return [];
      return arr
        .filter(
          (r): r is { user_id: string; nickname: string } =>
            typeof r === "object" &&
            r !== null &&
            typeof (r as Record<string, unknown>).user_id === "string" &&
            typeof (r as Record<string, unknown>).nickname === "string",
        )
        .slice(0, 8);
    } catch {
      return [];
    }
  });
  // UR G.5：雷达活坐标（GET /friends/live；本人居中＋酒友方位距离落点）。
  const [liveById, setLiveById] = useState(
    new Map<string, { lat: number; lng: number; nickname: string }>(),
  );
  const { position: selfPos } = useGeolocation();

  // DEF-20261003-002：好友缓存（首载后留存，供新消息到达时重排，不重拉好友）。
  const friendsRef = useRef<
    { user_id: string; nickname: string; avatar_url: string | null; online: boolean }[]
  >([]);
  // DEF-20261003-002：会话重拉（新消息／回焦时刷新未读＋末句＋排序，好友源不动）。
  const refreshConvos = useCallback(async (): Promise<void> => {
    try {
      const cRes = await fetch("/api/v1/conversations?limit=50", { credentials: "include" });
      if (!cRes.ok) return;
      const cJson = (await cRes.json().catch(() => null)) as {
        conversations?: ConvoRow[];
      } | null;
      const convos = Array.isArray(cJson?.conversations) ? (cJson as { conversations: ConvoRow[] }).conversations : [];
      const updated = new Map<string, number>();
      const byPeer = new Map<string, ConvoRow>();
      for (const c of convos) {
        if (c.peer !== null) {
          updated.set(c.peer.user_id, c.updated_at);
          byPeer.set(c.peer.user_id, c);
        }
      }
      setEntries(mergeFriendList(friendsRef.current, updated));
      setConvoByPeer(byPeer);
    } catch {
      // 断网：静默保持旧列表（fail-closed，不炸页）
    }
  }, []);

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
        friendsRef.current = fJson?.friends ?? [];
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
        setEntries(mergeFriendList(friendsRef.current, updated));
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

  // DEF-20261003-002：列表页即时＋回焦刷新（坐列表页等消息也翻红点；
  // 沿 useChatBell 同一条 messages INSERT，不新增 publication）。
  useEffect(() => {
    let channel: { unsubscribe: () => void } | null = null;
    let cancelled = false;
    void (async () => {
      try {
        const supabase = createClient();
        if (cancelled) return;
        const ch = supabase
          .channel("chat-list")
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "messages" },
            () => {
              void refreshConvos();
            },
          )
          .subscribe();
        channel = { unsubscribe: () => ch.unsubscribe() };
      } catch {
        // Publication 未开／断线：保持首载值，回焦刷新仍在（沿 D.3 口径）
      }
    })();
    const onFocus = (): void => {
      void refreshConvos();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      try {
        channel?.unsubscribe();
      } catch {}
    };
  }, [refreshConvos]);

  // UR G.5：活坐标单拉（mount 一次；失败静默无雷达，列表不受影响）。
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/v1/friends/live", { credentials: "include" });
        if (!res.ok || cancelled) return;
        const j = (await res.json().catch(() => null)) as {
          friends?: { user_id: string; nickname: string; lat: number; lng: number }[];
        } | null;
        const rows = Array.isArray(j?.friends) ? (j as { friends: never[] }).friends : [];
        const map = new Map<string, { lat: number; lng: number; nickname: string }>();
        for (const r of rows as { user_id: unknown; nickname: unknown; lat: unknown; lng: unknown }[]) {
          if (
            typeof r.user_id !== "string" ||
            typeof r.nickname !== "string" ||
            typeof r.lat !== "number" ||
            typeof r.lng !== "number" ||
            !Number.isFinite(r.lat) ||
            !Number.isFinite(r.lng)
          ) {
            continue;
          }
          map.set(r.user_id, { lat: r.lat, lng: r.lng, nickname: r.nickname });
        }
        if (!cancelled) setLiveById(map);
      } catch {
        // 靜默：無雷达，列表照走
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const online = filterFriends(entries.filter((e) => e.online), query);
  const offline = filterFriends(entries.filter((e) => !e.online), query);

  function openRow(peerId: string): void {
    const hit = entries.find((e) => e.user_id === peerId) ?? null;
    // Recents：点行即记（去重＋ cap 8，沿 iOS 口径）。
    setRecents((prev) => {
      const nickname = hit?.nickname ?? "";
      if (nickname === "") return prev;
      const next = [{ user_id: peerId, nickname }, ...prev.filter((r) => r.user_id !== peerId)].slice(0, 8);
      try {
        window.localStorage.setItem("wtd-chat-recents", JSON.stringify(next));
      } catch {}
      return next;
    });
    setActivePeer(peerId);
    router.push(roomHref);
  }

  function rowView(e: FriendListEntry) {
    const hasAvatar = e.avatar_url !== null && /^https?:\/\//.test(e.avatar_url);
    const convo = convoByPeer.get(e.user_id) ?? null;
    const lm = convo?.last_message ?? null;
    // UR D.6：末句帶方向＋附件映射（圖／音無正文，顯示類型章；秒數取附件，無則回通用章）。
    const who = lm !== null && lm.mine ? `${t("chatMe")}: ` : "";
    // UR E.13：分享卡片行（末附件 checkin_id 即卡式：📍釘＋店名 snippet；旧库无列即落旧口径）。
    const shareId =
      lm?.attachments?.[0]?.checkin_id !== undefined && lm.attachments[0].checkin_id !== ""
        ? (lm.attachments[0].checkin_id as string)
        : null;
    // UR E.13 卡片地点行（附件 place；无即回 body，不拿坐标）。
    const sharePlace =
      shareId !== null &&
      typeof lm?.attachments?.[0]?.place === "string" &&
      (lm?.attachments?.[0]?.place as string) !== ""
        ? (lm.attachments[0].place as string)
        : null;
    const snippet =
      lm === null
        ? t("chatEmpty")
        : shareId !== null
          ? `${who}${lm.body ?? ""}`
          : lm.kind === "image"
            ? `${who}${t("chatSnippetImage")}`
            : lm.kind === "audio"
              ? `${who}${t("chatSnippetAudio", { n: lm.attachments?.[0]?.secs ?? 0 })}`
              : `${who}${lm.body ?? ""}`;
    const shareLine =
      sharePlace !== null && (lm?.body ?? "") !== "" && (lm?.body ?? "") !== sharePlace
        ? `${who}${sharePlace} · ${lm?.body ?? ""}`
        : (sharePlace !== null ? `${who}${sharePlace}` : snippet);
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
              {shareId !== null ? (
                <span className="flex min-w-0 items-center gap-1.5 rounded-lg border bg-card px-2 py-1">
                  <MapPin size={13} aria-hidden className="shrink-0 text-primary" />
                  <span className="truncate text-xs font-bold">{shareLine}</span>
                </span>
              ) : (
                <span className="truncate text-xs font-normal text-muted-foreground">{snippet}</span>
              )}
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
        {/* UR E.16：邀請籤（紅點＋數；陌生人默認只 App 內提示，不推送）。 */}
        <div role="tablist" aria-label={t("chatListTitle")} className="ml-auto flex shrink-0 items-center gap-1 rounded-full border border-border bg-muted p-0.5">
          <button
            type="button"
            role="tab"
            aria-selected={chatTab === "friends"}
            onClick={() => setChatTab("friends")}
            className={`rounded-full px-2.5 py-1 text-xs font-bold ${chatTab === "friends" ? "bg-card shadow" : "text-muted-foreground"}`}
          >
            {t("tabFriends")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={chatTab === "invites"}
            onClick={() => setChatTab("invites")}
            className={`relative rounded-full px-2.5 py-1 text-xs font-bold ${chatTab === "invites" ? "bg-card shadow" : "text-muted-foreground"}`}
          >
            {t("tabInvites")}
            {invitePending > 0 && (
              <span aria-hidden className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-0.5 text-[10px] font-bold text-white">
                {invitePending > 99 ? "99+" : invitePending}
              </span>
            )}
          </button>
        </div>
      </header>

      {chatTab === "invites" ? (
        <InviteList onPending={setInvitePending} />
      ) : (
        <>
          {/* UR G.5：搜索框（昵称即滤，本地零新端点）。 */}
          <div className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-muted px-3 py-1.5">
            <Search size={15} aria-hidden className="shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("chatSearch")}
              aria-label={t("chatSearch")}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {query !== "" && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label={t("cancel")}
                className="shrink-0 rounded-full p-0.5 text-muted-foreground"
              >
                <X size={14} aria-hidden />
              </button>
            )}
          </div>
          {/* UR G.5：最近 8（空 query 才露，点即填搜）。 */}
          {query === "" && recents.length > 0 && (
            <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto" aria-label={t("chatRecents")}>
              <span className="shrink-0 text-xs text-muted-foreground">{t("chatRecents")}</span>
              {recents.map((r) => (
                <button
                  key={r.user_id}
                  type="button"
                  onClick={() => setQuery(r.nickname)}
                  className="shrink-0 rounded-full border border-border px-2.5 py-1 text-xs font-bold"
                >
                  {r.nickname}
                </button>
              ))}
            </div>
          )}
          <RadarStrip
            selfPos={selfPos}
            liveById={liveById}
            onOpen={openRow}
            label={t("chatRadarLabel")}
          />
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
      ) : online.length + offline.length === 0 ? (
        query !== "" ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <p className="max-w-60 text-sm text-muted-foreground">{t("chatNoMatch")}</p>
          </div>
        ) : entries.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <MessageCircle size={40} aria-hidden className="size-10 text-muted-foreground" />
          <p className="max-w-60 text-sm text-muted-foreground">{t("chatListEmpty")}</p>
          <Button variant="outline" render={<Link href={homeHref} />} nativeButton={false}>
            {t("back")}
          </Button>
        </div>
        ) : null
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
      )
          }
        </>
      )
      }
    </div>
  );
}

/**
 * UR G.5 好友雷达（本人居中＋酒友方位距离落点；点点进房，沿 iOS RadarMiniMap）。
 * 纯渲染数学（bearing＋haversine），无 state；无坐标即整条不挂。
 */
function RadarStrip({
  selfPos,
  liveById,
  onOpen,
  label,
}: {
  selfPos: { lat: number; lng: number } | null;
  liveById: Map<string, { lat: number; lng: number; nickname: string }>;
  onOpen: (userId: string) => void;
  label: string;
}): React.ReactElement | null {
  if (selfPos === null || liveById.size === 0) return null;
  const dots: { id: string; nickname: string; x: number; y: number; dist: number }[] = [];
  let maxD = 500;
  const rows = [...liveById.entries()];
  for (const [id, f] of rows) {
    const dist = haversineMeters(selfPos, { lat: f.lat, lng: f.lng });
    if (dist > maxD) maxD = dist;
    dots.push({ id, nickname: f.nickname, x: 0, y: 0, dist });
  }
  const R = 52;
  const CX = 66;
  const CY = 66;
  for (const d of dots) {
    const f = liveById.get(d.id);
    if (f === undefined) continue;
    const brg = (initialBearing(selfPos, { lat: f.lat, lng: f.lng }) * Math.PI) / 180;
    const r = (Math.min(d.dist, maxD) / maxD) * R;
    d.x = CX + Math.sin(brg) * r;
    d.y = CY - Math.cos(brg) * r;
  }
  return (
    <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-border p-2" role="img" aria-label={label}>
      <svg viewBox="0 0 132 132" className="h-[104px] w-[104px] shrink-0" aria-hidden={false}>
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="currentColor" strokeOpacity={0.2} />
        <circle cx={CX} cy={CY} r={R / 2} fill="none" stroke="currentColor" strokeOpacity={0.15} />
        <circle cx={CX} cy={CY} r={5} className="fill-blue-600" />
        {dots.map((d) => (
          <g key={d.id} onClick={() => onOpen(d.id)} className="cursor-pointer">
            <title>{`${d.nickname} · ${formatDistance(d.dist)}`}</title>
            <circle cx={d.x} cy={d.y} r={7} className="fill-primary" />
            <text x={d.x} y={d.y + 3} textAnchor="middle" fontSize={8} className="fill-white font-bold">
              {d.nickname.slice(0, 1)}
            </text>
          </g>
        ))}
      </svg>
      <div className="min-w-0 flex-1 text-xs text-muted-foreground">
        <p className="truncate font-bold text-foreground">
          {dots.length} · {formatDistance(Math.min(...dots.map((d) => d.dist)))}
        </p>
        <p className="truncate">{dots.slice(0, 3).map((d) => d.nickname).join(" · ")}</p>
      </div>
    </div>
  );
}
