import { beforeEach, describe, expect, it, vi } from "vitest";

// 第五輪審核：另一台設備「忘記我」之後，舊設備帶舊 base_rev 的 PUT 不得重建記憶列。
const state = vi.hoisted(() => ({
  row: null as { doc: unknown; rev: number } | null,
  inserts: [] as unknown[],
  updates: [] as unknown[],
}));

vi.mock("@/lib/api/envelope", () => import("../../../../../lib/api/envelope"));
vi.mock("@/lib/barMemory", () => import("../../../../../lib/barMemory"));
vi.mock("@/lib/supabase/server", () => {
  const db = {
    from: () => {
      let updating = false;
      const q = {
        select: () => q,
        eq: () => q,
        update: (v: unknown) => {
          state.updates.push(v);
          updating = true;
          return q;
        },
        insert: async (v: unknown) => {
          state.inserts.push(v);
          return { error: null };
        },
        maybeSingle: async () => ({ data: state.row, error: null }),
        then: (resolve: (r: unknown) => unknown) =>
          Promise.resolve({ data: updating && state.row !== null ? [{ rev: state.row.rev + 1 }] : [], error: null }).then(resolve),
      };
      return q;
    },
  };
  return { getAuthedClient: async () => ({ userId: "u1" }), createServiceClient: async () => db };
});

import { PUT } from "./route";

const put = (baseRev: number | undefined) =>
  PUT(
    new Request("https://example.invalid/api/v1/me/bar-memory", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doc: { taste: { likes: ["gin"] } }, ...(baseRev === undefined ? {} : { base_rev: baseRev }) }),
    }),
  );

beforeEach(() => {
  state.row = null;
  state.inserts.splice(0);
  state.updates.splice(0);
});

describe("PUT /me/bar-memory 與「忘記我」", () => {
  it("沒有記憶列、base_rev=0：真正的首次建立，rev=1", async () => {
    const res = await put(0);
    expect(res.status).toBe(200);
    expect((await res.json()).rev).toBe(1);
    expect(state.inserts).toHaveLength(1);
  });

  it("沒有 base_rev 欄位（舊客戶端）也當首次建立", async () => {
    expect((await put(undefined)).status).toBe(200);
    expect(state.inserts).toHaveLength(1);
  });

  it("沒有記憶列但 base_rev>0（另一台已忘記我）：409，不重建", async () => {
    const res = await put(4);
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("stale_version");
    expect(state.inserts).toHaveLength(0);
  });

  it("有記憶列：照舊走覆蓋／合併，不受新規則影響", async () => {
    state.row = { doc: { taste: { likes: ["rum"] } }, rev: 4 };
    const res = await put(4);
    expect(res.status).toBe(200);
    expect(state.inserts).toHaveLength(0);
    expect(state.updates).toHaveLength(1);
  });
});
