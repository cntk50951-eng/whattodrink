/**
 * 建立類請求的冪等鍵（iOS IOS-C04；migration 0095）。
 * 客戶端每次「發佈嘗試」生成一個（UUID），重試沿用；服務端同一發起人＋同一鍵只建一筆。
 * 只收 8–64 位的字母／數字／-／_；其他（含缺省）回 null＝不做冪等（沿舊行為）。
 */
export function parseClientRequestId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  return /^[A-Za-z0-9_-]{8,64}$/.test(s) ? s : null;
}

/** 從整個請求體取冪等鍵（body 不是物件時回 null） */
export function clientRequestIdOf(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  return parseClientRequestId((body as Record<string, unknown>).client_request_id);
}
