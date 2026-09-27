"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLiveFriends } from "@/hooks/useLiveFriends";
import { ChatThread } from "@/components/v2/ChatThread";
import styles from "@/components/v2/v2.module.css";

/**
 * UR C.15 好友聊天完整頁（v2 獨立路由；直連 URL 即可開聊）。
 * 好友解析：`useLiveFriends(true)` 直讀（server 已做互好友＋非隱身＋鮮活三刀；
 * 匿名／非法 id 即 `[]`）；解析不到走回退對象（暱稱 `chatFallbackName`＋id 前 4，
 * 保直接 URL 永遠可渲染，POC 測試便利，註記見下）。
 * 真通道未建——線程內發送一律本地樂觀追加，零寫庫（C-chat-2 才接 Realtime）。
 */
export default function V2ChatRoomPage() {
  const t = useTranslations("v2");
  const locale = useLocale();
  const params = useParams<{ friendId: string }>();
  const friendId = Array.isArray(params.friendId) ? params.friendId[0] : (params.friendId ?? "");
  const listHref = locale === "zh-Hant" ? "/v2/chat" : `/${locale}/v2/chat`;

  const { friends } = useLiveFriends(true);
  const live = friends.find((f) => f.user_id === friendId);
  const peer =
    live !== undefined
      ? { nickname: live.nickname, avatarUrl: live.avatar_url }
      : { nickname: `${t("chatFallbackName")} ${friendId.slice(0, 4)}`, avatarUrl: null };
  const hasAvatar = peer.avatarUrl !== null && /^https?:\/\//.test(peer.avatarUrl);

  const [voiceNote, setVoiceNote] = useState(false);

  return (
    <div className={`${styles.v2scope} flex h-dvh flex-col gap-3 bg-background p-4`}>
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

      <ChatThread
        threadKey={friendId}
        peer={peer}
        onVoice={() => {
          setVoiceNote(true);
          window.setTimeout(() => setVoiceNote(false), 2500);
        }}
      />
    </div>
  );
}
