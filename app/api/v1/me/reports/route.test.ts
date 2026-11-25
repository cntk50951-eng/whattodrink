import { beforeEach, describe, expect, it, vi } from "vitest";

// iOS DEF-20261125-021〜024：我的舉報只看自己的；不外露 AI 分數／類別／審核人；游標帶 +00:00 能翻頁。
const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const R1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const state = vi.hoisted(() => ({
  userId: null as string | null,
  filters: [] as Array<[string, string, unknown]>,
  rows: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/api/envelope", () => import("../../../../../lib/api/envelope"));
vi.mock("@/lib/api/compositeCursor", () => import("../../../../../lib/api/compositeCursor"));
vi.mock("@/lib/api/checkins", () => import("../../../../../lib/api/checkins"));
vi.mock("@/lib/api/myReports", () => import("../../../../../lib/api/myReports"));
vi.mock("@/lib/supabase/server", () => {
  const db = {
    from: (table: string) => {
      const eqs: Array<[string, unknown]> = [];
      const q: Record<string, unknown> = {};
      for (const m of ["select", "order", "limit", "in", "is"]) q[m] = () => q;
      q.or = (expr: string) => { state.filters.push([table, "or", expr]); return q; };
      q.eq = (col: string, v: unknown) => { eqs.push([col, v]); state.filters.push([table, col, v]); return q; };
      const visible = () => state.rows.filter((r) => eqs.every(([c, v]) => r[c] === v));
      q.maybeSingle = async () => ({ data: table === "cheers_reports" ? (visible()[0] ?? null) : null, error: null });
      q.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: table === "cheers_reports" ? visible() : [], error: null }).then(resolve);
      return q;
    },
  };
  return { getAuthedClient: async () => ({ userId: state.userId, supabase: db }), createServiceClient: async () => db };
});

import { GET as LIST } from "./route";
import { GET as DETAIL } from "./[id]/route";

const row = (id: string, reporter: string, created: string) => ({
  id, reporter_id: reporter, target_type: "post", target_ref: "c1", target_user_id: OTHER, reason_code: "harassment", reason: null,
  status: "dismissed", snapshot: [], created_at: created, decided_at: created, decided_by: "admin-1",
  ai_decision: "auto_dismissed", ai_score: 0.04, ai_categories: ["harassment"], ai_checked_at: created, decision_note: "未發現違規",
});

beforeEach(() => {
  state.userId = ME;
  state.filters = [];
  state.rows = [row(R1, ME, "2026-11-25T10:00:00.123456+00:00"), row("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", OTHER, "2026-11-25T09:00:00+00:00")];
});

describe("GET /me/reports", () => {
  it("未登入 401", async () => {
    state.userId = null;
    expect((await LIST(new Request("https://x.invalid/api/v1/me/reports"))).status).toBe(401);
  });

  it("只查自己的，且不外露 AI 分數／類別／審核人 id", async () => {
    const res = await LIST(new Request("https://x.invalid/api/v1/me/reports"));
    expect(res.status).toBe(200);
    expect(state.filters).toContainEqual(["cheers_reports", "reporter_id", ME]);
    const body = (await res.json()) as { items: Array<Record<string, unknown>> };
    expect(body.items.map((i) => i.id)).toEqual([R1]);
    const text = JSON.stringify(body);
    expect(text).not.toContain("0.04");
    expect(text).not.toContain("ai_score");
    expect(text).not.toContain("ai_categories");
    expect(text).not.toContain("admin-1");
    expect(body.items[0]).toMatchObject({ status: "dismissed", decided_by: "staff" });
  });

  it("游標帶 +00:00：%2B 與未轉義（變空格）都能解析", async () => {
    const cursor = `2026-11-25T10:00:00.123456+00:00|${R1}`;
    const encoded = await LIST(new Request(`https://x.invalid/api/v1/me/reports?cursor=${encodeURIComponent(cursor)}`));
    expect(encoded.status).toBe(200);
    const raw = await LIST(new Request(`https://x.invalid/api/v1/me/reports?cursor=${cursor}`));
    expect(raw.status).toBe(200);
    expect(state.filters.some(([, op, v]) => op === "or" && String(v).includes("+00:00"))).toBe(true);
  });

  it("壞游標 400", async () => {
    expect((await LIST(new Request("https://x.invalid/api/v1/me/reports?cursor=nope"))).status).toBe(400);
  });
});

describe("GET /me/reports/{id}", () => {
  const call = (id: string) => DETAIL(new Request(`https://x.invalid/api/v1/me/reports/${id}`), { params: Promise.resolve({ id }) });

  it("自己的：200，帶時間線，不外露 AI 分數", async () => {
    const res = await call(R1);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.timeline).toBeDefined();
    expect(JSON.stringify(body)).not.toContain("0.04");
  });

  it("別人的：404（按 reporter_id 過濾，不洩露存在）", async () => {
    expect((await call("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")).status).toBe(404);
  });

  it("未登入 401", async () => {
    state.userId = null;
    expect((await call(R1)).status).toBe(401);
  });
});
