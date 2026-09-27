"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLiveFriends } from "@/hooks/useLiveFriends";
import { readActivePeer } from "@/lib/chatPeer";
import { ChatRoomLive } from "@/components/v2/ChatRoomLive";
import styles from "@/components/v2/v2.module.css";

/**
 * UR D.7 零 id 聊天房（路由永遠是乾淨的 `/v2/chat/room`）。
 * peer 身份走 sessionStorage（進房前由地圖釘／列表行寫入，tab 關即焚）；
 * 直接進／過期無 peer 即回列表。好友解析沿 C.15（live 互好友三刀），
 * 解析不到走純回退名（不露任何 id）。頁根 fixed 全屏蓋掉 v1 上下（沿 V2Home 口徑）。
 *
 * 身份讀取走 `useSyncExternalStore`（server 快照 null，hydration 不炸；
 * 讀 session 是外部系統同步，不用 effect 設值，lint 乾淨）。
 */
export default function V2ChatRoomPage() {
  const t = useTranslations("v2");
  const locale = useLocale();
  const router = useRouter();
  const listHref = locale === "zh-Hant" ? "/v2/chat" : `/${locale}/v2/chat`;

  const [voiceNote, setVoiceNote] = useState(false);
  const peerId = useSyncExternalStore(
    () => () => {},
    () => readActivePeer(),
    () => null,
  );
  const { friends } = useLiveFriends(peerId !== null);
  useEffect(() => {
    if (peerId === null) router.replace(listHref);
  }, [peerId, router, listHref]);
  if (peerId === null) return null;

  const live = friends.find((f) => f.user_id === peerId);
  const peer =
    live !== undefined
      ? { nickname: live.nickname, avatarUrl: live.avatar_url }
      : { nickname: t("chatFallbackName"), avatarUrl: null };
  const hasAvatar = peer.avatarUrl !== null && /^https?:\/\//.test(peer.avatarUrl);

  return (
    <div className={`${styles.v2scope} fixed inset-0 isolate z-[1000] flex h-dvh flex-col gap-3 overflow-hidden bg-background p-4`}>
      <header className="flex shrink-0 items-center gap-2">
        <Button variant="ghost" size="icon" aria-label={t("back")} render={<Link href={listHref} />} nativeButton={false}>
          <ChevronLeft size={18} aria-hidden className="size-[18px]" />
        </Button>
        <Avatar>
          {hasAvatar ? (
            <AvatarImage src={peer.avatarUrl as string} alt="" />
          ) : (
            <AvatarFallback>{peer.nickname.slice(0, 1)}</AvatarFallback>
          )}
          {live !== undefined && <AvatarBadge className="bg-green-600" />}
        </Avatar>
        <span className="min-w-0 flex-1 truncate text-base font-semibold">{peer.nickname}</span>
        {live !== undefined && <Badge variant="secondary">{t("chatOnline")}</Badge>}
      </header>

      {voiceNote && (
        <p role="status" className="shrink-0 rounded-xl bg-muted px-3 py-2 text-center text-sm text-muted-foreground">
          {t("chatSoon")}
        </p>
      )}

      {/* UR D.3 真通道（歷史＋Realtime＋樂觀發送；mock 已退役，見 ChatRoomLive） */}
      <ChatRoomLive
        peerId={peerId}
        peer={peer}
        onVoice={() => {
          setVoiceNote(true);
          window.setTimeout(() => setVoiceNote(false), 2500);
        }}
      />
    </div>
  );
}
