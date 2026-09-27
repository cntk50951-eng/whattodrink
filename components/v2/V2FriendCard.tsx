"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { LiveFriend } from "@/lib/presence";
import { formatSeenAgo } from "@/lib/chat";

import styles from "./v2.module.css";

/**
 * UR C.17 好友信息卡（v2 bottom Sheet，沿 C.4／C.10 同容器同 X 口徑）。
 * 點好友釘先看人（頭像＋名＋在線態＋最近上線時間），再按「聊天」進完整頁；
 * 真通道未建不影響——本卡只讀 `useLiveFriends` 已有字段（`updated_at` 端到端現成，
 * 零 DB 改動），寫入零行。
 */
export function V2FriendCard({
  friend,
  onClose,
  onChat,
}: {
  friend: LiveFriend | null;
  onClose: () => void;
  onChat: (userId: string) => void;
}) {
  const t = useTranslations("v2");
  const locale = useLocale();
  // 卡開期間時間凍結（render 內禁 impure 調用，沿 react-hooks/purity 門）。
  const [nowMs] = useState(() => Date.now());
  const hasAvatar =
    friend !== null && friend.avatar_url !== null && /^https?:\/\//.test(friend.avatar_url);

  return (
    <Sheet open={friend !== null} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className={`${styles.v2scope} max-h-[70svh] gap-4 overflow-y-auto rounded-t-2xl p-4 sm:mx-auto sm:w-full sm:max-w-md`}
      >
        {friend !== null && (
          <>
            <div aria-hidden className="mx-auto h-1 w-10 rounded-full bg-muted-foreground/30" />
            <SheetHeader className="text-left">
              <SheetTitle className="flex items-center gap-2">
                <Avatar>
                  {hasAvatar ? (
                    <AvatarImage src={friend.avatar_url as string} alt="" />
                  ) : (
                    <AvatarFallback>{friend.nickname.slice(0, 1)}</AvatarFallback>
                  )}
                  <AvatarBadge className="bg-green-600" />
                </Avatar>
                <span className="min-w-0 flex-1 truncate">{friend.nickname}</span>
                <Badge variant="secondary">{t("chatOnline")}</Badge>
              </SheetTitle>
            </SheetHeader>
            <p className="text-sm text-muted-foreground">
              {formatSeenAgo(friend.updated_at, nowMs, locale)}
            </p>
            <div className="flex gap-2">
              <Button
                className="flex-1 rounded-full"
                onClick={() => {
                  onChat(friend.user_id);
                  onClose();
                }}
              >
                <MessageCircle size={16} aria-hidden className="size-4" />
                {t("chatOpen")}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
