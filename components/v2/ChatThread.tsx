"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, CheckCheck, ImagePlus, Mic, Pause, Play, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { VoiceRecorder } from "@/components/camera/voice-recorder";
import { useSignedUrl } from "@/hooks/useSignedUrl";
import {
  appendLocalEcho,
  formatChatTime,
  mockThread,
  type ChatAttachmentView,
  type ChatMessage,
} from "@/lib/chat";

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
  /** UR D.6：附件上傳（父層簽名→直傳→發送；mock 態不傳即藏附件鍵）。 */
  onUpload?: (
    kind: "image" | "audio",
    payload: { blob: Blob; name: string; secs?: number },
  ) => Promise<void>;
};

/**
 * UR D.6 附件氣泡（圖片／語音共用殼；簽名短鏈經 hook 讀緩存， anonymous 零直讀）。
 * 圖片：skeleton 佔位＋onLoad 淡入（沿 C.3 口徑）；語音：小播放鈕＋秒數。
 */
export function ChatAttachmentBubble({ att }: { att: ChatAttachmentView }) {
  const t2 = useTranslations("v2");
  const signed = useSignedUrl(att.bucket, att.path);
  // 樂觀位本地預覽優先（秒開；成功換真行即切簽名鏈，不閃爍）。
  const url = att.preview ?? signed;
  const [imgLoaded, setImgLoaded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  if (att.bucket === "chat-voice") {
    return (
      <span className="flex items-center gap-2 rounded-2xl bg-muted px-3 py-2">
        <button
          type="button"
          aria-label={playing ? t2("chatVoicePause") : t2("chatVoicePlay")}
          onClick={() => {
            const el = audioRef.current;
            if (el === null) return;
            if (playing) el.pause();
            else void el.play().catch(() => {});
          }}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background"
        >
          {playing ? (
            <Pause size={14} aria-hidden className="size-3.5" />
          ) : (
            <Play size={14} aria-hidden className="size-3.5" />
          )}
        </button>
        <span className="text-sm font-medium">
          {att.secs !== undefined ? t2("chatVoiceSecs", { n: Math.round(att.secs) }) : ""}
        </span>
        {url !== null && (
          <audio
            ref={audioRef}
            src={url}
            preload="metadata"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            className="hidden"
          />
        )}
      </span>
    );
  }
  return (
    <span className="relative block max-w-56 overflow-hidden rounded-2xl bg-muted">
      {!imgLoaded && <span aria-hidden className="block aspect-[4/3] w-56 animate-pulse bg-muted" />}
      {url !== null && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={url}
          alt=""
          loading="lazy"
          onLoad={() => setImgLoaded(true)}
          className={`max-h-64 w-auto object-cover transition-opacity duration-300 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
        />
      )}
    </span>
  );
}

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
  // UR D.6：附件態（語音錄製中／上傳中；上傳走父層 onUpload，mock 態藏鍵）。
  const [voiceMode, setVoiceMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
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
                {(m.attachments ?? []).map((att, i) => (
                  <ChatAttachmentBubble key={`${m.id}-a${i}`} att={att} />
                ))}
                {m.text !== "" && (
                  <div className="max-w-[80%] rounded-2xl rounded-br-md bg-foreground px-3 py-2 text-sm text-background">
                    {m.text}
                  </div>
                )}
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
                  {(m.attachments ?? []).map((att, i) => (
                    <ChatAttachmentBubble key={`${m.id}-a${i}`} att={att} />
                  ))}
                  {m.text !== "" && (
                    <div className="rounded-2xl rounded-bl-md bg-muted px-3 py-2 text-sm text-foreground">
                      {m.text}
                    </div>
                  )}
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
      {voiceMode && external?.onUpload !== undefined ? (
        <div className="sticky bottom-0 z-10 shrink-0 bg-background/95 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur">
          <VoiceRecorder
            onComplete={(_url, secs, blob) => {
              setVoiceMode(false);
              void (async () => {
                setUploading(true);
                try {
                  await external.onUpload?.("audio", {
                    blob,
                    name: `voice.${blob.type.includes("mp4") ? "mp4" : "webm"}`,
                    secs,
                  });
                } finally {
                  setUploading(false);
                }
              })();
            }}
            onClear={() => setVoiceMode(false)}
          />
        </div>
      ) : (
      <form
        className="sticky bottom-0 z-10 flex shrink-0 items-center gap-2 bg-background/95 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        {external?.onUpload !== undefined && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              aria-hidden
              tabIndex={-1}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                e.target.value = "";
                if (file === null) return;
                void (async () => {
                  setUploading(true);
                  try {
                    await external.onUpload?.("image", { blob: file, name: file.name });
                  } finally {
                    setUploading(false);
                  }
                })();
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={t2("chatAttach")}
              disabled={uploading}
              className="shrink-0 rounded-full"
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus size={16} aria-hidden className="size-4" />
            </Button>
          </>
        )}
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
          onClick={() => {
            // UR D.6：真通道走內聯錄音（mock 態沿舊 toast）；錄音中禁用防重入。
            if (external?.onUpload !== undefined && !uploading) setVoiceMode(true);
            else onVoice();
          }}
        >
          <Mic size={16} aria-hidden className="size-4" />
        </Button>
        {uploading && (
          <span role="status" className="shrink-0 text-xs text-muted-foreground">
            {t2("chatUploading")}
          </span>
        )}
      </form>
      )}
    </>
  );
}
