/**
 * UR C.15 好友聊天靜態殼 —— 純函數（v2-only 消費，共用層只做加法）。
 * 真通道（Realtime＋持久化）是 C-chat-2 的事；這裡只有 mock 線程＋時間格式，
 * 發送一律本地樂觀追加，零寫庫。
 */

export type ChatRole = "me" | "friend";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  /** MOCK 佔位文案（不進 messages，避免三語膨脹；真通道接後端文案） */
  text: string;
  /** epoch ms */
  at: number;
  /** 只有我方消息有意義：對方是否已讀（mock 定死） */
  read: boolean;
  /** UR D.4：發送失敗位（留行＋重試鍵；成功／重發即清） */
  failed?: boolean;
  /** UR D.6：附件視圖（server 已驗歸屬＋大小；讀端只渲染） */
  attachments?: ChatAttachmentView[];
};

/** D.6 附件視圖（body 為空時 bubbles 走此渲染；snippet 走 kind）。 */
export type ChatFileView = {
  bucket: "chat-images" | "chat-voice";
  path: string;
  mime: string;
  bytes: number;
  secs?: number;
  /** 本地預覽（樂觀位專用，會話態，不持久化不發送）。 */
  preview?: string;
};

/** UR E.13 站内打卡分享视图（非文件附件；渲染走卡片分支，不走签名链）。 */
export type ChatShareView = {
  checkin_id: string;
  place?: string;
};

export type ChatAttachmentView = ChatFileView | ChatShareView;

/** 附件行映射：壞條丟棄（單條壞不炸整串；未知桶／非法 path 即壞）。 */
export function toChatAttachments(raw: unknown): ChatAttachmentView[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatAttachmentView[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const r = item as Record<string, unknown>;
    // UR E.13：分享附件直通（uuid 形 checkin_id；可見性发送时已验，读端只渲染）。
    if (typeof r.checkin_id === "string" && /^[A-Za-z0-9-]{1,64}$/.test(r.checkin_id)) {
      const share: ChatShareView = { checkin_id: r.checkin_id };
      if (typeof r.place === "string" && r.place.trim() !== "") {
        share.place = r.place.trim().slice(0, 120);
      }
      out.push(share);
      continue;
    }
    if (r.bucket !== "chat-images" && r.bucket !== "chat-voice") continue;
    if (typeof r.path !== "string" || r.path.includes("..") || r.path.split("/").length !== 2) {
      continue;
    }
    if (typeof r.mime !== "string") continue;
    if (typeof r.bytes !== "number" || !Number.isFinite(r.bytes) || r.bytes < 0) continue;
    const att: ChatAttachmentView = {
      bucket: r.bucket,
      path: r.path,
      mime: r.mime,
      bytes: r.bytes,
    };
    if (typeof r.secs === "number" && Number.isFinite(r.secs) && r.secs > 0) {
      (att as ChatFileView).secs = r.secs;
    }
    out.push(att);
  }
  return out;
}

const MINUTE_MS = 60_000;

/**
 * 按傳入 now 生成三段 mock 線程（時間升序；MOCK，處處標註）。
 * 純函數：同一個 now 永遠回同一個形狀，方便單測＋Story。
 */
export function mockThread(nowMs: number): ChatMessage[] {
  return [
    { id: "mock-1", role: "friend", text: "今晚去邊度飲？", at: nowMs - 42 * MINUTE_MS, read: true },
    { id: "mock-2", role: "me", text: "上環嗰間新精釀點睇？", at: nowMs - 40 * MINUTE_MS, read: true },
    { id: "mock-3", role: "friend", text: "正！我收工過嚟 🍻", at: nowMs - 38 * MINUTE_MS, read: true },
  ];
}

/** 本地追加一條我方消息（id 由調用方計數器給，保持純函數）。 */
export function appendLocalEcho(prev: ChatMessage[], id: string, text: string, nowMs: number): ChatMessage[] {
  return [...prev, { id, role: "me", text, at: nowMs, read: false }];
}

/** `at` → `HH:mm`（24h，補零；與 locale 無關，純格式）。 */
export function formatChatTime(atMs: number): string {
  const d = new Date(atMs);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * UR C.17 最近上線時間 → 相對文案（`Intl.RelativeTimeFormat`，三語零新 key）。
 * 純函數：`locale` 透傳（`zh-Hant／zh-Hans／en`），未來時間鉗零。
 */
export function formatSeenAgo(atMs: number, nowMs: number, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const diffSec = Math.max(0, Math.floor((nowMs - atMs) / 1000));
  if (diffSec < 60) return rtf.format(-diffSec, "second");
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return rtf.format(-diffMin, "minute");
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return rtf.format(-diffHour, "hour");
  return rtf.format(-Math.floor(diffHour / 24), "day");
}

/**
 * UR D.4 列表時間：同天 `HH:mm`，否則 `M/d`（locale 只定分隔語義，
 * 用 `Intl`  parts 取月日數字，不拼寫月份名，三語零新 key）。
 */
export function formatListTime(atMs: number, nowMs: number): string {
  const a = new Date(atMs);
  const n = new Date(nowMs);
  if (
    a.getFullYear() === n.getFullYear() &&
    a.getMonth() === n.getMonth() &&
    a.getDate() === n.getDate()
  ) {
    return formatChatTime(atMs);
  }
  return `${a.getMonth() + 1}/${a.getDate()}`;
}

/**
 * UR D.4 列表合併排序（純函數）：好友全量＋會話末動 map →
 * 在線組置頂＋離線在後，組內按末信倒序，無記錄沉底（按暱稱穩序）。
 */
export type FriendListEntry = {
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  online: boolean;
  updated_at: number | null;
};

/**
 * UR D.5 Bell 未读汇总（纯函数）：conversations 行数组 → 总未读。
 * 坏行按 0 计（逐行窄校验，坏行不炸汇总，沿 toChatMessage 口径）；
 * 非数组回 0；小数下取整、负数钳零。
 */
export function sumUnread(rows: unknown): number {
  if (!Array.isArray(rows)) return 0;
  let total = 0;
  for (const r of rows) {
    if (typeof r !== "object" || r === null) continue;
    const u = (r as Record<string, unknown>).unread;
    if (typeof u !== "number" || !Number.isFinite(u) || u <= 0) continue;
    total += Math.floor(u);
  }
  return total;
}

/**
 * UR D.4 列表合併排序（純函數）：好友全量＋會話末動 map →
 * 在線組置頂＋離線在後，組內按末信倒序，無記錄沉底（按暱稱穩序）。
 */
export function mergeFriendList(
  friends: { user_id: string; nickname: string; avatar_url: string | null; online: boolean }[],
  updatedByPeer: Map<string, number>,
): FriendListEntry[] {
  const rows: FriendListEntry[] = friends.map((f) => ({
    ...f,
    updated_at: updatedByPeer.get(f.user_id) ?? null,
  }));
  rows.sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1;
    const at = a.updated_at ?? Number.NEGATIVE_INFINITY;
    const bt = b.updated_at ?? Number.NEGATIVE_INFINITY;
    if (at !== bt) return bt - at;
    return a.nickname < b.nickname ? -1 : 1;
  });
  return rows;
}
