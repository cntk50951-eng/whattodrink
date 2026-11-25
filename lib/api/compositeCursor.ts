const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CURSOR_TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:?\d{2})$/;

/**
 * 解析複合游標 `<created_at>|<id>`（第七輪 §3.4：單欄 created_at 游標會漏掉同一時間戳、跨頁邊界的行）。
 * 格式不符回 null，呼叫端退回舊的純時間戳游標。值會被拼進 PostgREST `or()` 字串，所以嚴格限制字符集：
 * 時間戳只收 ISO-8601，id 只收 UUID。
 */
export function parseCompositeCursor(cursor: string | null): { createdAt: string; id: string } | null {
  if (cursor === null) return null;
  const i = cursor.indexOf("|");
  if (i <= 0) return null;
  const createdAt = cursor.slice(0, i);
  const id = cursor.slice(i + 1);
  if (!CURSOR_TS_RE.test(createdAt) || !UUID_RE.test(id)) return null;
  return { createdAt, id };
}
