import { apiError } from "./envelope";

/**
 * 用來決定「放不放行」的 `users` 讀取失敗（隱身、未成年、停權、名額、次數、改名／生日限制）。
 * 必須與「查無此人／欄位為空」區分：以前出錯回 null，檢查就按「沒有限制」放行（DEF-20261128-014）。
 * 路由用 `withUserGuard` 包起來，統一回可重試的 503。只用來顯示暱稱頭像的讀取不用這個。
 */
export class UserLookupError extends Error {
  constructor(readonly op: string, readonly code: string) {
    super(`user-lookup-failed:${op}:${code}`);
    this.name = "UserLookupError";
  }
}

const errCode = (e: unknown): string =>
  typeof e === "object" && e !== null && "code" in e && typeof (e as { code: unknown }).code === "string"
    ? (e as { code: string }).code
    : "unknown";

/** 等查詢結果；出錯或拋例外一律丟 `UserLookupError`。查無資料照常回 null／空陣列。 */
export async function requireUserRead<R extends { data: unknown; error?: unknown }>(
  op: string,
  query: PromiseLike<R>,
): Promise<R["data"]> {
  let res: R;
  try {
    res = await query;
  } catch (e) {
    throw new UserLookupError(op, errCode(e));
  }
  if (res.error !== null && res.error !== undefined) throw new UserLookupError(op, errCode(res.error));
  return res.data;
}

/** 讀不到帳號狀態時給客戶端的統一回包：503 可重試，不洩漏內部錯誤。 */
export function userLookupUnavailable(): Response {
  return apiError("internal", "暫時未能確認帳號狀態，請稍後再試", 503, { "Retry-After": "2" });
}

/** 路由處理器外殼：處理器內任何一處拋 `UserLookupError` 一律回 503，其他錯誤原樣拋出。 */
export function withUserGuard<A extends unknown[]>(
  handler: (...args: A) => Promise<Response>,
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await handler(...args);
    } catch (e) {
      if (e instanceof UserLookupError) {
        console.error(`[api/users] ${e.message}`);
        return userLookupUnavailable();
      }
      throw e;
    }
  };
}
