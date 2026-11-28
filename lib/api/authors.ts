/**
 * DEF-20261128-003：`users` 只由服務端身分讀寫。
 * 打卡仍用原身分查（保留可見性規則），作者欄位另用服務端身分按 `user_id` 補上，
 * 形狀與原本的 `users(...)` 內嵌一致（查不到＝null）。
 */
type Row = Record<string, unknown>;
type ReadError = { code?: string; message?: string };

export type AuthorReader = {
  from: (table: "users") => {
    select: (columns: string) => {
      in: (column: "id", ids: string[]) => PromiseLike<{ data: unknown; error: ReadError | null }>;
    };
  };
};

export async function attachAuthors(
  service: unknown,
  rows: unknown[],
  columns: string,
): Promise<{ rows: unknown[]; error: null } | { rows: null; error: ReadError }> {
  const list = rows.filter((r): r is Row => typeof r === "object" && r !== null);
  const ids = [...new Set(list.map((r) => r.user_id).filter((v): v is string => typeof v === "string" && v !== ""))];
  const byId = new Map<string, Row>();
  if (ids.length > 0) {
    const { data, error } = await (service as AuthorReader).from("users").select(`id,${columns}`).in("id", ids);
    if (error !== null) return { rows: null, error };
    for (const u of ((data ?? []) as Row[])) {
      const { id, ...rest } = u;
      if (typeof id === "string") byId.set(id, rest);
    }
  }
  return {
    rows: list.map((r) => ({ ...r, users: typeof r.user_id === "string" ? (byId.get(r.user_id) ?? null) : null })),
    error: null,
  };
}
