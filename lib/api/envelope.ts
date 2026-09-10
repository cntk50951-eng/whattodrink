/**
 * UR A.3 API 統一回包（A.2-4 腳手架第一塊，後面 15 條端點共用同一形狀）。
 * 成功：裸數據對象；失敗：`{error:{code, message}}`＋對應 HTTP 狀態。
 */
export type ApiErrorCode =
  | "invalid_params"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "rate_limited"
  | "internal";

export function apiError(
  code: ApiErrorCode,
  message: string,
  status: number,
): Response {
  return Response.json({ error: { code, message } }, { status });
}

export function apiOk<T>(data: T, status = 200): Response {
  return Response.json(data, { status });
}
