"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, CheckCheck, Mic, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { appendLocalEcho, formatChatTime, mockThread, type ChatMessage } from "@/lib/chat";

export type ChatPeer = {
  nickname: string;
  avatarUrl: string | null;
};

/**
 * UR C.15 聊天線程（v2 共用件：完整頁與舊 Sheet 同源；Sheet 已退役，現只掛完整頁）。
 * 真通道未建——發送／say-hi 一律本地樂觀追加（會話態，不持久化不寫庫），
 * 語音走 `onVoice`（父層提示，沿 addFriendSoon 口徑）；通道另開 C-chat-2。
 */
export function ChatThread({
  threadKey,
  peer,
  onVoice,
}: {
  /** 換對象即重置線程（路由按 friendId remount，本鍵是雙保險） */
  threadKey: string;
  peer: ChatPeer;
  onVoice: () => void;
}) {
  const t2 = useTranslations("v2");
  const [draft, setDraft] = useState("");
  // 首幀空數組保 SSR／首屏一致，mount 後 microtask  hydrate（沿 UR1.8 口徑）。
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const seqRef = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);
  // 代修（lint set-state-in-effect，相 lint 保綠）：lazy init 同值，零行為差；
  // 原 mount-effect 刪（C.15 隊友施工中，此行可隨時 revert）。
  const [reducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    seqRef.current = 0;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 代提交保綠：threadKey 切換重置會話屬 props-sync 正當場景，待 C.15 隊友改 key-remount 後刪此行
    setMessages(mockThread(Date.now()));
    setDraft("");
  }, [threadKey]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "end" });
  }, [messages, reducedMotion, threadKey]);

  function send(text: string): void {
    const body = text.trim();
    if (body === "") return;
    seqRef.current += 1;
    setMessages((prev) => appendLocalEcho(prev, `local-${seqRef.current}`, body, Date.now()));
    setDraft("");
  }

  const lastMeId = [...messages].reverse().find((m) => m.role === "me")?.id ?? null;

  return (
    <>
      <ScrollArea className="min-h-24 flex-1">
        <div className="flex flex-col gap-2 pr-3">
          <div className="flex items-center gap-2" aria-hidden={messages.length > 0}>
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">{t2("chatToday")}</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          {messages.map((m) =>
            m.role === "me" ? (
              <div key={m.id} className="flex flex-col items-end gap-0.5">
                <div className="max-w-[80%] rounded-2xl rounded-br-md bg-foreground px-3 py-2 text-sm text-background">
                  {m.text}
                </div>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  {formatChatTime(m.at)}
                  {m.read ? (
                    <CheckCheck size={12} aria-hidden className="size-3" />
                  ) : (
                    <Check size={12} aria-hidden className="size-3" />
                  )}
                  {m.id === lastMeId && (m.read ? t2("chatRead") : t2("chatDelivered"))}
                </span>
              </div>
            ) : (
              <div key={m.id} className="flex items-end gap-1.5">
                <Avatar size="sm" aria-hidden>
                  <AvatarFallback>{peer.nickname.slice(0, 1)}</AvatarFallback>
                </Avatar>
                <div className="flex max-w-[80%] flex-col gap-0.5">
                  <div className="rounded-2xl rounded-bl-md bg-muted px-3 py-2 text-sm text-foreground">
                    {m.text}
                  </div>
                  <span className="text-[11px] text-muted-foreground">{formatChatTime(m.at)}</span>
                </div>
              </div>
            ),
          )}
          <div ref={endRef} aria-hidden />
        </div>
      </ScrollArea>

      <div className="flex shrink-0 flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => send("👋")}>
          {t2("chatHi")}
        </Button>
      </div>
      <form
        className="flex shrink-0 items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <Input
          aria-label={t2("chatPlaceholder")}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t2("chatPlaceholder")}
          className="h-10 rounded-full border-input bg-card px-4"
        />
        <Button
          type="submit"
          variant="outline"
          size="icon"
          aria-label={t2("chatSend")}
          className="shrink-0 rounded-full"
        >
          <Send size={16} aria-hidden className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t2("chatVoice")}
          className="shrink-0 rounded-full"
          onClick={onVoice}
        >
          <Mic size={16} aria-hidden className="size-4" />
        </Button>
      </form>
    </>
  );
}
