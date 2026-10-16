import { normalizeHashtag } from "./hashtags";

/** 我的標籤庫（user_hashtags）：發布時記次數＋最近使用；0061 未跑／失敗一律靜默（不影響打卡）。 */
type Svc = {
  from: (t: string) => {
    select: (c: string) => { eq: (c: string, v: string) => { in: (c: string, v: string[]) => Promise<{ data: unknown; error: unknown }> } };
    upsert: (rows: unknown, o?: unknown) => Promise<{ error: unknown }>;
  };
};

export async function recordUserHashtags(client: unknown, userId: string, tags: string[]): Promise<void> {
  try {
    const svc = client as Svc;
    const names = [...new Set(tags.map(normalizeHashtag).filter((x): x is string => x !== null))];
    if (names.length === 0) return;
    const { data } = await svc.from("user_hashtags").select("tag,uses").eq("user_id", userId).in("tag", names);
    const uses = new Map<string, number>();
    for (const r of ((data ?? []) as unknown[]) as { tag?: unknown; uses?: unknown }[]) {
      if (typeof r.tag === "string") uses.set(r.tag, typeof r.uses === "number" ? r.uses : 1);
    }
    const now = new Date().toISOString();
    await svc.from("user_hashtags").upsert(
      names.map((tag) => ({ user_id: userId, tag, uses: (uses.get(tag) ?? 0) + 1, last_used_at: now })),
      { onConflict: "user_id,tag" },
    );
  } catch {
    // 靜默
  }
}
