"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Mic, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

import styles from "./v2.module.css";

export type ChatFriend = {
  user_id: string;
  nickname: string;
  avatarUrl: string | null;
};

/**
 * UR A.21 打招呼 Sheet（v2 新文件，shadcn bottom Sheet 沿 C.4 口徑）。
 * 聊天通道未建——say-hi／文字／語音三鈕一律走 `onSoon`（父層 toast，
 * 沿 addFriendSoon 口徑），通道另開 UR，真寫入零行。
 */
export function V2ChatSheet({
  friend,
  onClose,
  onSoon,
}: {
  friend: ChatFriend | null;
  onClose: () => void;
  onSoon: () => void;
}) {
  const t2 = useTranslations("v2");
  const [draft, setDraft] = useState("");

  return (
    <Sheet open={friend !== null} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className={`${styles.v2scope} max-h-[70svh] gap-4 overflow-y-auto rounded-t-2xl p-4 sm:mx-auto sm:w-full sm:max-w-md`}>
        {friend !== null && (
          <>
            <div aria-hidden className="mx-auto h-1 w-10 rounded-full bg-muted-foreground/30" />
            <SheetHeader className="text-left">
              <SheetTitle className="flex items-center gap-2">
                {friend.avatarUrl !== null && /^https?:\/\//.test(friend.avatarUrl) ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={friend.avatarUrl}
                    alt=""
                    loading="lazy"
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-lg">
                    {friend.nickname.slice(0, 1)}
                  </span>
                )}
                {friend.nickname}
                <Badge variant="secondary">{t2("chatOnline")}</Badge>
              </SheetTitle>
              <SheetDescription>{t2("chatEmpty")}</SheetDescription>
            </SheetHeader>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={onSoon}>
                {t2("chatHi")}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <input
                aria-label={t2("chatPlaceholder")}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t2("chatPlaceholder")}
                className="h-10 min-w-0 flex-1 rounded-full border border-input bg-card px-4 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Button
                variant="outline"
                size="icon"
                aria-label={t2("chatSend")}
                className="shrink-0 rounded-full"
                onClick={() => {
                  setDraft("");
                  onSoon();
                }}
              >
                <Send size={16} aria-hidden className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label={t2("chatVoice")}
                className="shrink-0 rounded-full"
                onClick={onSoon}
              >
                <Mic size={16} aria-hidden className="size-4" />
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
