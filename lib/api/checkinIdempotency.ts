/**
 * C-01 發布冪等（`POST /api/v1/checkins` 的 `Idempotency-Key`）——純函數，可單測。
 *
 * 規則（向後相容是第一要務）：
 * - 兩端早就每次發布都帶一個新 UUID 的 `Idempotency-Key`，所以 header 不合法時**忽略**（當沒帶），絕不回 400；
 * - 客戶端同一次發布的所有重試沿用同一個 key，服務端據此認出「同一則」；
 * - 0078 沒跑（`checkins.client_key` 列不存在）時全部降級成沒有冪等，行為同現在。
 */

/** 8–64 個字母數字／`_`／`-`（UUID 36 字元符合）。 */
const KEY_RE = /^[A-Za-z0-9_-]{8,64}$/;

/** 解析 header；不合法／缺席回 null（＝不做冪等）。 */
export function parseIdempotencyKey(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const k = raw.trim();
  return KEY_RE.test(k) ? k : null;
}

/**
 * 插入遇到 42703（列不存在）時，找出錯誤訊息點名的那個可選列並從 [cols] 去掉；回傳被去掉的列名，沒有就 null。
 * 取代原本「每個可選列一個 if」的鏈：Postgres 報的是**第一個**不存在的列，順序和 if 鏈對不上時會漏掉，
 * 掉進「0007 未遷移 → 全部改私密」的回退（發出去的貼文變成私密，比重複帖更糟）。
 */
export function stripMissingOptionalColumn(cols: Record<string, unknown>, message: string | undefined): string | null {
  const m = message ?? "";
  for (const name of Object.keys(cols)) {
    if (new RegExp(`\\b${name}\\b`).test(m)) {
      delete cols[name];
      return name;
    }
  }
  return null;
}

type PgError = { code?: string | null; message?: string | null; details?: string | null } | null | undefined;

/** 是不是 (user_id, client_key) 唯一索引的衝突（並發重送）；別的唯一衝突不當冪等處理。 */
export function isClientKeyConflict(error: PgError): boolean {
  if (error === null || error === undefined || error.code !== "23505") return false;
  return /client_key/.test(`${error.message ?? ""} ${error.details ?? ""}`);
}

/** 查冪等記錄時的錯誤是不是「client_key 列還沒建」（0078 未跑）。 */
export function isClientKeyColumnMissing(error: PgError): boolean {
  return error?.code === "42703" && /client_key/.test(error.message ?? "");
}
