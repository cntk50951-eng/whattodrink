import { beforeEach, describe, expect, it, vi } from "vitest";

// 第七輪 §3.4：「忘記我」留墓碑、rev 只增不減；forget 之前的 base_rev 不能被碰巧對上。
type Row = { doc: unknown; rev: number; deleted_at?: string | null; forgot_rev?: number };
const state = vi.hoisted(() => ({
  row: null as Row | null,
  updates: [] as Array<Record<string, unknown>>,
  deletes: 0,
  missingColumns: false,
}));

vi.mock("@/lib/api/envelope", () => import("../../../../../lib/api/envelope"));
vi.mock("@/lib/barMemory", () => import("../../../../../lib/barMemory"));
vi.mock("@/lib/supabase/server", () => {
  const db = {
    from: () => {
      let op = "select";
      let cols = "";
      const q: Record<string, unknown> = {
        select: (c?: string) => { if (op === "select") cols = c ?? ""; return q; },
        eq: () => q,
        update: (v: Record<string, unknown>) => { op = "update"; state.updates.push(v); return q; },
        delete: () => { op = "delete"; state.deletes += 1; return q; },
        insert: async () => ({ error: null }),
        maybeSingle: async () => {
          if (state.missingColumns && cols.includes("deleted_at")) return { data: null, error: { code: "42703", message: "no col" } };
          return { data: state.row, error: null };
        },
        then: (resolve: (r: unknown) => unknown) => {
          if (op === "update" && state.missingColumns && "deleted_at" in (state.updates.at(-1) ?? {})) {
            return Promise.resolve({ data: null, error: { code: "42703", message: "no col" } }).then(resolve);
          }
          return Promise.resolve({ data: op === "update" && state.row !== null ? [{ rev: state.row.rev + 1 }] : [], error: null }).then(resolve);
        },
      };
      return q;
    },
  };
  return { getAuthedClient: async () => ({ userId: "u1" }), createServiceClient: async () => db };
});

import { DELETE, GET, PUT } from "./route";

const url = "https://example.invalid/api/v1/me/bar-memory";
const put = (baseRev: number, capturedAt?: string) =>
  PUT(new Request(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ doc: { taste: { likes: ["gin"] } }, base_rev: baseRev, ...(capturedAt ? { captured_at: capturedAt } : {}) }),
  }));
const get = () => GET(new Request(url));
const del = () => DELETE(new Request(url, { method: "DELETE" }));

beforeEach(() => {
  state.row = null;
  state.updates.splice(0);
  state.deletes = 0;
  state.missingColumns = false;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("忘記我的刪除世代", () => {
  it("DELETE 寫墓碑（rev+1、forgot_rev=rev+1、deleted_at），不刪列", async () => {
    state.row = { doc: { taste: { likes: ["rum"] } }, rev: 4 };
    expect((await del()).status).toBe(200);
    expect(state.deletes).toBe(0);
    expect(state.updates[0]).toMatchObject({ rev: 5, forgot_rev: 5, doc: {} });
    expect(state.updates[0].deleted_at).toBeTruthy();
  });

  it("GET 墓碑＝沒有記憶（doc:null, rev:0）", async () => {
    state.row = { doc: {}, rev: 5, deleted_at: "2026-11-24T00:00:00Z", forgot_rev: 5 };
    expect(await (await get()).json()).toEqual({ doc: null, rev: 0 });
  });

  it("墓碑上舊設備帶 base_rev>0 → 409，不復活", async () => {
    state.row = { doc: {}, rev: 5, deleted_at: "2026-11-24T00:00:00Z", forgot_rev: 5 };
    const res = await put(1);
    expect(res.status).toBe(409);
    expect(state.updates).toHaveLength(0);
  });

  it("墓碑上 base_rev=0（忘記後重新累積）→ 復活，rev 接著往上（不回到 1）", async () => {
    state.row = { doc: {}, rev: 5, deleted_at: "2026-11-24T00:00:00Z", forgot_rev: 5 };
    const res = await put(0, "2026-11-24T01:00:00Z");
    expect(res.status).toBe(200);
    expect((await res.json()).rev).toBe(6);
    expect(state.updates[0]).toMatchObject({ rev: 6, deleted_at: null });
  });

  it("第十一輪 §3.3：墓碑上 base_rev=0 但 captured_at 早於 deleted_at（忘記前離線累積）→ 409 stale_version，不復活", async () => {
    state.row = { doc: {}, rev: 5, deleted_at: "2026-11-24T12:00:00Z", forgot_rev: 5 };
    const res = await put(0, "2026-11-24T11:00:00Z");
    expect(res.status).toBe(409);
    expect(state.updates).toHaveLength(0);
  });

  it("核心回歸：復活後舊設備的 base_rev（≤ forgot_rev）即使碰巧等於舊 rev 也 409", async () => {
    // 忘記前舊設備停在 rev 1；忘記時 rev 1→2、forgot_rev=2；復活後 rev=3。舊設備帶 base_rev=1 或 2 都必須被擋
    state.row = { doc: { taste: { likes: ["new"] } }, rev: 3, deleted_at: null, forgot_rev: 2 };
    expect((await put(1)).status).toBe(409);
    expect((await put(2)).status).toBe(409);
    expect(state.updates).toHaveLength(0);
    // 忘記後才同步過的設備（base_rev=3）正常覆蓋
    expect((await put(3)).status).toBe(200);
  });

  it("0085 沒跑（缺欄位）→ 退回舊行為：DELETE 直接刪列", async () => {
    state.row = { doc: { taste: { likes: ["rum"] } }, rev: 2 };
    state.missingColumns = true;
    expect((await del()).status).toBe(200);
    expect(state.deletes).toBe(1);
  });
});
