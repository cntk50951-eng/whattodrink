/**
 * 投訴「附聊天記錄」：候選列表／選中校驗／快照（純函數；路由負責查庫與權限）。
 * 只收文字消息。做法參考主流 app（微信「投訴→選擇聊天記錄」、WhatsApp／Instagram 舉報附最近消息）：
 * 用戶自己勾選要附的消息，提交時服務端存快照；只有審核員（和 AI）看得到，被投訴人看不到你附了什麼。
 */

export const MAX_CHAT_EVIDENCE = 20;

export type ChatEvidenceItem = {
  id: string;
  sender: "filer" | "target";
  kind: "text" | "image";
  body: string | null;
  at: string;
  /** chat-images bucket 內路徑（圖片消息） */
  image_path: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 解析請求裡的 chat_message_ids：缺省＝[]；非數組／超量／非 uuid／重複 → 錯誤。 */
export function parseChatMessageIds(raw: unknown): string[] | { error: string } {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) return { error: "chat_message_ids 需为数组" };
  if (raw.length > MAX_CHAT_EVIDENCE) return { error: `聊天記錄最多選 ${MAX_CHAT_EVIDENCE} 條` };
  const seen = new Set<string>();
  for (const v of raw) {
    if (typeof v !== "string" || !UUID.test(v)) return { error: "chat_message_ids 含非法 id" };
    if (seen.has(v)) return { error: "chat_message_ids 有重複" };
    seen.add(v);
  }
  return [...seen];
}

function imagePathOf(attachments: unknown): string | null {
  if (!Array.isArray(attachments)) return null;
  for (const a of attachments) {
    if (typeof a === "object" && a !== null) {
      const p = (a as Record<string, unknown>).path;
      if (typeof p === "string" && p !== "" && !p.includes("..")) return p;
    }
  }
  return null;
}

/** messages 行 → 快照元素；不屬於雙方、語音／分享卡等不可作證的種類 → null。 */
export function toEvidenceItem(row: unknown, filerId: string, targetId: string): ChatEvidenceItem | null {
  if (typeof row !== "object" || row === null) return null;
  const r = row as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : "";
  const at = typeof r.created_at === "string" ? r.created_at : "";
  if (id === "" || !Number.isFinite(Date.parse(at))) return null;
  const sender = r.sender_id === filerId ? "filer" : r.sender_id === targetId ? "target" : null;
  if (sender === null) return null;
  if (r.kind === "text") {
    const body = typeof r.body === "string" ? r.body.slice(0, 1000) : "";
    if (body.trim() === "") return null;
    return { id, sender, kind: "text", body, at, image_path: null };
  }
  // 圖片消息不可附（產品決定 2026-10-14：圖片證據只能現場拍攝；聊天只收文字）
  return null;
}

/** 按所選 id 順序（時間升序）生成快照；缺任何一條（不屬於這段私信）即整體拒絕。 */
export function buildChatEvidence(
  ids: string[],
  rows: unknown[],
  filerId: string,
  targetId: string,
): ChatEvidenceItem[] | { error: string } {
  const byId = new Map<string, ChatEvidenceItem>();
  for (const row of rows) {
    const it = toEvidenceItem(row, filerId, targetId);
    if (it !== null) byId.set(it.id, it);
  }
  const out: ChatEvidenceItem[] = [];
  for (const id of ids) {
    const it = byId.get(id);
    if (it === undefined) return { error: "所選聊天記錄不屬於你和對方的私信" };
    out.push(it);
  }
  return out.sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id));
}

/** 候選列表給 App：只回可附的（文字／圖片），me/them 視角。 */
export function chatCandidateJson(row: unknown, meId: string, peerId: string) {
  const it = toEvidenceItem(row, meId, peerId);
  if (it === null) return null;
  return {
    id: it.id,
    from: it.sender === "filer" ? "me" : "them",
    kind: it.kind,
    body: it.body,
    created_at: it.at,
  };
}

/** 讀快照（DB 內容不可信：壞元素丟棄）。 */
export function parseStoredChatEvidence(raw: unknown): ChatEvidenceItem[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatEvidenceItem[] = [];
  for (const v of raw) {
    if (typeof v !== "object" || v === null) continue;
    const r = v as Record<string, unknown>;
    if (typeof r.id !== "string" || typeof r.at !== "string") continue;
    if (r.sender !== "filer" && r.sender !== "target") continue;
    if (r.kind !== "text" && r.kind !== "image") continue;
    out.push({
      id: r.id,
      sender: r.sender,
      kind: r.kind,
      body: typeof r.body === "string" ? r.body : null,
      at: r.at,
      image_path: typeof r.image_path === "string" ? r.image_path : null,
    });
  }
  return out;
}
