/**
 * UR A.7 登入跳轉守衛（純函數，可單測）。
 * OAuth 回來只許回站內路徑：必須單 `/` 開頭（擋 `//evil` 開重定向）。
 */
export function safeNextPath(next: string | null): string {
  if (next === null || !next.startsWith("/") || next.startsWith("//")) {
    return "/";
  }
  return next;
}

/**
 * 選單顯示名：Google 名→email 前綴→「酒友」（口徑與 0006 trigger 一致，
 * trigger 是 SQL 版，這裡是前端顯示版，兩邊改要一起改）。
 */
export function displayName(
  meta: Record<string, unknown> | null | undefined,
  email: string | null | undefined,
): string {
  const fullName =
    meta !== null &&
    meta !== undefined &&
    typeof meta.full_name === "string" &&
    meta.full_name.length > 0
      ? meta.full_name
      : null;
  if (fullName !== null) return fullName;
  const name =
    meta !== null &&
    meta !== undefined &&
    typeof meta.name === "string" &&
    meta.name.length > 0
      ? meta.name
      : null;
  if (name !== null) return name;
  if (email !== null && email !== undefined) {
    const prefix = email.split("@")[0];
    if (prefix !== undefined && prefix.length > 0) return prefix;
  }
  return "酒友";
}
