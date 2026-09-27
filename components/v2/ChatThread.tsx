"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, CheckCheck, Mic, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { appendLocalEcho, formatChatTime, mockThread, type ChatMessage } from "@/lib/chat";

export type ChatPeer = {
  nickname: string;
  avatarUrl: string | null;
};

/**
 * UR D.3 受控源（加法，可選）：`external` 在即走真通道——消息由父層
 *（`ChatRoomLive`：歷史＋Realtime＋樂觀發送）供給，`send` 轉調 `onSend`；
 * 不傳即沿舊本地 mock（C.15／D.7 行為不動，向下兼容）。
 */
export type ChatExternalSource = {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  /** UR D.4：失敗重試（同 client_msg_id 重發，冪等不 double；不傳即無重試鍵）。 */
  onRetry?: (id: string) => void;
  /** UR D.4：對方讀水位 ms（我方行 at<=水位即✓✓；null 即沿舊 mock read 旗）。 */
  readAt?: number | null;
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
  external = null,
}: {
  /** 換對象即重置線程（路由按 friendId remount，本鍵是雙保險） */
  threadKey: string;
  peer: ChatPeer;
  onVoice: () => void;
  external?: ChatExternalSource | null;
}) {
  const t2 = useTranslations("v2");
  const [draft, setDraft] = useState("");
  const areaRef = useRef<HTMLTextAreaElement | null>(null);
  // UR D.7：輸入框自動增高（1→5 行，上限 128px；DOM 直寫，無 setState 不觸 lint）。
  const autoresize = (): void => {
    const el = areaRef.current;
    if (el === null) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  };
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

  // 受控源開關：external 在即渲染父層消息（D.3 真通道），否則沿舊本地 mock。
  const shown = external?.messages ?? messages;

  useEffect(() => {
    seqRef.current = 0;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 代提交保綠：threadKey 切換重置會話屬 props-sync 正當場景，待 C.15 隊友改 key-remount 後刪此行
    setMessages(mockThread(Date.now()));
    setDraft("");
  }, [threadKey]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "end" });
  }, [shown, reducedMotion, threadKey]);

  function send(text: string): void {
    const body = text.trim();
    if (body === "") return;
    if (external !== null) {
      external.onSend(body);
      setDraft("");
      const el = areaRef.current;
      if (el !== null) el.style.height = "auto";
      return;
    }
    seqRef.current += 1;
    setMessages((prev) => appendLocalEcho(prev, `local-${seqRef.current}`, body, Date.now()));
    setDraft("");
    // 高度回 1 行（下輪 onChange 再撐開；直接清避免殘留高）。
    const el = areaRef.current;
    if (el !== null) el.style.height = "auto";
  }

  const lastMeId = [...shown].reverse().find((m) => m.role === "me")?.id ?? null;
  const readAt = external?.readAt ?? null;
  // UR D.4：水位在即按水位判已讀，否則沿舊 read 旗（mock／離線態）。
  const isRead = (m: ChatMessage): boolean =>
    readAt !== null ? m.at <= readAt : m.read;

  return (
    <>
      <ScrollArea className="min-h-24 flex-1">
        <div className="flex flex-col gap-2 pr-3">
          <div className="flex items-center gap-2" aria-hidden={shown.length > 0}>
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">{t2("chatToday")}</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          {shown.map((m) =>
            m.role === "me" ? (
              <div key={m.id} className="flex flex-col items-end gap-0.5">
                <div className="max-w-[80%] rounded-2xl rounded-br-md bg-foreground px-3 py-2 text-sm text-background">
                  {m.text}
                </div>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  {formatChatTime(m.at)}
                  {isRead(m) ? (
                    <CheckCheck size={12} aria-hidden className="size-3" />
                  ) : (
                    <Check size={12} aria-hidden className="size-3" />
                  )}
                  {m.id === lastMeId && (isRead(m) ? t2("chatRead") : t2("chatDelivered"))}
                  {m.failed === true && external?.onRetry !== undefined && (
                    <button
                      type="button"
                      onClick={() => external.onRetry?.(m.id)}
                      className="font-bold text-destructive underline underline-offset-2"
                    >
                      {t2("chatRetry")}
                    </button>
                  )}
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
      {/* UR D.7：輸入條吸底（sticky＋安全區＋毛玻璃；鍵盤彈起不亂跑）。 */}
      <form
        className="sticky bottom-0 z-10 flex shrink-0 items-center gap-2 bg-background/95 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        {/* UR D.7：多行輸入（textarea 自動增高；Enter 發送／Shift+Enter 換行；
            中文組字中 Enter 不誤發）。 */}
        <textarea
          ref={areaRef}
          rows={1}
          aria-label={t2("chatPlaceholder")}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            autoresize();
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || e.shiftKey) return;
            if (e.nativeEvent.isComposing) return;
            e.preventDefault();
            send(draft);
          }}
          placeholder={t2("chatPlaceholder")}
          className="max-h-32 min-h-10 w-full flex-1 resize-none rounded-2xl border border-input bg-card px-4 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
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
