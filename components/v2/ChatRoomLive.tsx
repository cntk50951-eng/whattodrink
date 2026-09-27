"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { createClient } from "@/lib/supabase/client";
import { ChatThread, type ChatPeer } from "@/components/v2/ChatThread";
import type { ChatMessage } from "@/lib/chat";

type ServerMessage = {
  id: string;
  sender_id: string;
  kind: string;
  body: string | null;
  created_at: number;
};

/**
 * UR D.3 真通道容器（v2 新文件；room 頁只掛它，不直掛 ChatThread）。
 * 職責：peerId→find-or-create 會話→拉歷史→Realtime 訂閱本會話→樂觀發送。
 * 身份：登入態靠 cookie session（browser client）；未登入即停（room 頁已有
 * 登入门，沿 A.21 口徑）。Publication 未開時 Realtime 靜默無行——歷史照讀，
 * 即時性等用戶按步驟開 Publication（見 UR）；卸載拆頻道。
 */
export function ChatRoomLive({
  peerId,
  peer,
  onVoice,
}: {
  peerId: string;
  peer: ChatPeer;
  onVoice: () => void;
}) {
  const t = useTranslations("v2");
  const [convId, setConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [failed, setFailed] = useState(false);
  // UR D.4：對方讀水位（頁內已讀✓✓翻態源；開房＋收信＋10s 輪詢三路刷新）。
  const [peerReadAt, setPeerReadAt] = useState<number | null>(null);
  const seqRef = useRef(0);
  const pendingRef = useRef(new Map<string, { clientMsgId: string; text: string }>());

  const toChat = useCallback(
    (m: ServerMessage, me: string | null): ChatMessage => ({
      id: m.id,
      role: m.sender_id === me ? "me" : "friend",
      text: m.body ?? "",
      at: m.created_at,
      read: m.sender_id !== me,
    }),
    [],
  );

  const fetchReadStatus = useCallback(async (cid: string): Promise<void> => {
    try {
      const r = await fetch(`/api/v1/conversations/${encodeURIComponent(cid)}/read-status`, {
        credentials: "include",
      });
      if (!r.ok) return;
      const j = (await r.json()) as { peer_last_read_at?: unknown };
      if (typeof j.peer_last_read_at === "number") setPeerReadAt(j.peer_last_read_at);
    } catch {}
  }, []);

  // 開房：建會話→拉歷史→順手寫讀水位（D.4 的 UI 在後，本呼叫先行鋪路）。
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- peerId 切換重置會話屬 props-sync 正當場景（沿 ChatThread D.7 豁免口徑）
    setConvId(null);
    setMessages([]);
    setFailed(false);
    pendingRef.current.clear();
    void (async () => {
      try {
        const myId = await myUserId();
        const cRes = await fetch("/api/v1/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ user_id: peerId }),
        });
        if (!cRes.ok || cancelled) return;
        const cJson = (await cRes.json()) as { id?: string };
        if (typeof cJson.id !== "string" || cancelled) return;
        setConvId(cJson.id);
        const hRes = await fetch(
          `/api/v1/conversations/${encodeURIComponent(cJson.id)}/messages?limit=50`,
          { credentials: "include" },
        );
        if (!hRes.ok || cancelled) return;
        const hJson = (await hRes.json()) as { messages?: ServerMessage[] };
        if (!Array.isArray(hJson.messages) || cancelled) return;
        setMessages(hJson.messages.map((m) => toChat(m, myId)));
        void fetchReadStatus(cJson.id);
        // 讀水位：開房即已讀到最新（fire-and-forget，失敗不擋）
        const last = hJson.messages[hJson.messages.length - 1];
        if (last !== undefined) {
          void fetch(`/api/v1/conversations/${encodeURIComponent(cJson.id)}/read`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ last_read_at: last.created_at }),
          }).catch(() => {});
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [peerId, toChat, fetchReadStatus]);

  // Realtime：本會話 INSERT 即插（去重：id 既有／client  echo 跳過）。
  useEffect(() => {
    if (convId === null) return;
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    void (async () => {
      try {
        const myId = await myUserId();
        if (cancelled) return;
        const supabase = createClient();
        const channel = supabase
          .channel(`chat:${convId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "messages",
              filter: `conversation_id=eq.${convId}`,
            },
            (payload) => {
              const row = payload.new as {
                id: string;
                sender_id: string;
                kind: string;
                body: string | null;
                created_at: string;
                client_msg_id?: string;
              };
              const at = Date.parse(row.created_at);
              if (!Number.isFinite(at)) return;
              setMessages((prev) => {
                if (prev.some((m) => m.id === row.id)) return prev;
                // 自己剛發的 echo：按 client_msg_id 換真 id（樂觀位不跳）
                const pendIdx = prev.findIndex(
                  (m) =>
                    m.role === "me" &&
                    typeof row.client_msg_id === "string" &&
                    pendingRef.current.get(m.id)?.clientMsgId === row.client_msg_id,
                );
                const mapped: ChatMessage = {
                  id: row.id,
                  role: row.sender_id === myId ? "me" : "friend",
                  text: row.body ?? "",
                  at,
                  read: row.sender_id !== myId,
                };
                if (pendIdx !== -1) {
                  const next = [...prev];
                  next[pendIdx] = mapped;
                  return next.sort((a, b) => a.at - b.at);
                }
                return [...prev, mapped].sort((a, b) => a.at - b.at);
              });
              // 對方新消息→順手寫水位（fire-and-forget）
              if (row.sender_id !== myId) {
                void fetch(`/api/v1/conversations/${encodeURIComponent(convId)}/read`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ last_read_at: at }),
                }).catch(() => {});
              }
            },
          )
          .subscribe();
        unsubscribe = () => {
          channel.unsubscribe();
        };
      } catch {
        // Publication 未開／斷線：歷史照讀，即時性降級（D.3 已知缺口，用戶開 Publication 即恢復）
      }
    })();
    return () => {
      cancelled = true;
      try {
        unsubscribe?.();
      } catch {}
    };
  }, [convId]);

  // UR D.4：水位輪詢（對方在房外已讀→我房內翻✓✓；10s 一次，hidden 暫停，卸載清）。
  useEffect(() => {
    if (convId === null) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 開房即同步一次水位屬 props-sync（沿本文件開房重置豁免口徑），後續走 interval
    void fetchReadStatus(convId);
    const id = window.setInterval(() => {
      if (document.visibilityState !== "hidden") void fetchReadStatus(convId);
    }, 10_000);
    return () => window.clearInterval(id);
  }, [convId, fetchReadStatus]);

  /** POST 一次（成功換真行；失敗留行掛 failed＋重試鍵，D.4 收 D.3 缺口）。 */
  async function postOne(tempId: string, clientMsgId: string, body: string): Promise<void> {
    const cid = convId;
    if (cid === null) return;
    try {
      const res = await fetch(`/api/v1/conversations/${encodeURIComponent(cid)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ kind: "text", body, client_msg_id: clientMsgId }),
      });
      if (!res.ok) throw new Error(`send ${res.status}`);
      const json = (await res.json()) as { message?: ServerMessage };
      if (json.message === undefined) throw new Error("bad send json");
      pendingRef.current.delete(tempId);
      const myId = await myUserId();
      const mapped = toChat(json.message, myId);
      setMessages((prev) => {
        if (prev.some((m) => m.id === mapped.id)) {
          return prev.filter((m) => m.id !== tempId);
        }
        return prev.map((m) =>
          m.id === tempId ? { ...mapped, failed: false } : m,
        );
      });
    } catch {
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, failed: true } : m)));
    }
  }

  async function sendText(text: string): Promise<void> {
    const body = text.trim();
    if (body === "" || convId === null) return;
    seqRef.current += 1;
    const tempId = `local-${seqRef.current}`;
    const clientMsgId = `c-${Date.now()}-${seqRef.current}`;
    pendingRef.current.set(tempId, { clientMsgId, text: body });
    setMessages((prev) => [
      ...prev,
      { id: tempId, role: "me", text: body, at: Date.now(), read: false },
    ]);
    await postOne(tempId, clientMsgId, body);
  }

  /** 重試用同一 client_msg_id（冪等不 double）。 */
  async function retrySend(tempId: string): Promise<void> {
    const pend = pendingRef.current.get(tempId);
    if (pend === undefined || convId === null) return;
    setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, failed: false } : m)));
    await postOne(tempId, pend.clientMsgId, pend.text);
  }

  if (failed) {
    return (
      <p role="alert" className="flex-1 py-8 text-center text-sm text-muted-foreground">
        {t("chatRoomFailed")}
      </p>
    );
  }
  return (
    <ChatThread
      threadKey={convId ?? peerId}
      peer={peer}
      onVoice={onVoice}
      external={{
        messages,
        onSend: (t) => void sendText(t),
        onRetry: (id) => void retrySend(id),
        readAt: peerReadAt,
      }}
    />
  );
}

/** 最小身份：browser session 取 uid（Realtime 回顯判 me 用；取不到回 null 即全按對方渲染，不炸）。 */
async function myUserId(): Promise<string | null> {
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}
