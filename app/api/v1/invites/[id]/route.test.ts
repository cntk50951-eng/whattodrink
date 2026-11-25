import { beforeEach, describe, expect, it, vi } from "vitest";

// 第五輪審核回歸：條件式轉態更新了 0 列（輸掉跨裝置同時操作）時，不得回成功、不得寫通知／推播／好友。
const state = vi.hoisted(() => ({
  row: {} as Record<string, unknown>,
  currentStatus: "accepted" as string | null,
  updatedRows: [{ id: "inv-1" }] as unknown[],
  inserts: [] as Array<{ table: string; values: unknown }>,
  upserts: [] as Array<{ table: string; values: unknown }>,
  jobs: [] as Array<() => Promise<void>>,
  push: vi.fn(),
  userId: "from-user",
}));

vi.mock("next/server", () => ({ after: (job: () => Promise<void>) => state.jobs.push(job) }));
vi.mock("@/lib/api/envelope", () => import("../../../../../lib/api/envelope"));
vi.mock("@/lib/api/transition", () => import("../../../../../lib/api/transition"));
vi.mock("@/lib/api/retryWrite", () => import("../../../../../lib/api/retryWrite"));
vi.mock("@/lib/api/invites", () => ({ canDeleteExpiredInvite: () => false }));
vi.mock("@/lib/push/send", () => ({ sendPartyNoticePush: state.push }));
vi.mock("@/lib/supabase/server", () => {
  const db = {
    from: (table: string) => {
      let cols = "";
      let updating = false;
      const q = {
        select: (c?: string) => {
          if (c !== undefined) cols = c;
          return q;
        },
        eq: () => q,
        in: () => q,
        update: () => {
          updating = true;
          return q;
        },
        insert: async (values: unknown) => {
          state.inserts.push({ table, values });
          return { error: null };
        },
        upsert: async (values: unknown) => {
          state.upserts.push({ table, values });
          return { error: null };
        },
        maybeSingle: async () => {
          if (table === "users") return { data: { nickname: "阿明", id: "peer", avatar_url: null }, error: null };
          if (cols.includes("from_user_id")) return { data: state.row, error: null };
          return { data: state.currentStatus === null ? null : { status: state.currentStatus }, error: null };
        },
        then: (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ data: updating ? state.updatedRows : [], error: null }).then(resolve),
      };
      return q;
    },
  };
  return { getAuthedClient: async () => ({ userId: state.userId, supabase: db }), createServiceClient: async () => db };
});

import { PATCH } from "./route";

const call = (action: string) =>
  PATCH(
    new Request("https://example.invalid/api/v1/invites/inv-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }),
    { params: Promise.resolve({ id: "inv-1" }) },
  );

const future = new Date(Date.now() + 3600_000).toISOString();

beforeEach(() => {
  state.jobs.splice(0);
  state.inserts.splice(0);
  state.upserts.splice(0);
  state.push.mockReset();
  state.updatedRows = [{ id: "inv-1" }];
  state.userId = "from-user";
  state.currentStatus = "accepted";
  state.row = {
    id: "inv-1",
    from_user_id: "from-user",
    to_user_id: "to-user",
    checkin_id: null,
    place: "Bar X",
    start_at: future,
    expires_at: future,
    status: "accepted",
    created_at: "2026-11-24T00:00:00Z",
  };
});

describe("私約 complete", () => {
  it("正常完成：寫一則通知並排推播", async () => {
    const res = await call("complete");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ completed: true });
    expect(state.inserts.filter((i) => i.table === "notifications")).toHaveLength(1);
    expect(state.jobs).toHaveLength(1);
  });

  it("輸掉轉態（對方同時撤銷了）：409，不寫通知、不排推播", async () => {
    state.updatedRows = [];
    state.currentStatus = "recalled";
    const res = await call("complete");
    expect(res.status).toBe(409);
    expect(state.inserts).toHaveLength(0);
    expect(state.jobs).toHaveLength(0);
  });

  it("另一裝置已先完成：冪等 200，但不重複通知", async () => {
    state.updatedRows = [];
    state.currentStatus = "completed";
    const res = await call("complete");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ completed: true });
    expect(state.inserts).toHaveLength(0);
    expect(state.jobs).toHaveLength(0);
  });
});

describe("私約 recall", () => {
  it("正常撤銷：通知對方並排推播", async () => {
    const res = await call("recall");
    expect(res.status).toBe(200);
    expect(state.inserts.filter((i) => i.table === "notifications")).toHaveLength(1);
    expect(state.jobs).toHaveLength(1);
  });

  it("輸給『完成』：409，不把已完成的邀約說成撤銷成功，也不發取消通知", async () => {
    state.updatedRows = [];
    state.currentStatus = "completed";
    const res = await call("recall");
    expect(res.status).toBe(409);
    expect(state.inserts).toHaveLength(0);
    expect(state.jobs).toHaveLength(0);
  });

  it("已被撤銷：冪等 200，不重複通知", async () => {
    state.updatedRows = [];
    state.currentStatus = "recalled";
    const res = await call("recall");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ recalled: true });
    expect(state.inserts).toHaveLength(0);
    expect(state.jobs).toHaveLength(0);
  });
});

describe("私約 accept", () => {
  beforeEach(() => {
    state.userId = "to-user";
    state.row = { ...state.row, status: "sent" };
  });

  it("正常接受：雙向寫好友", async () => {
    const res = await call("accept");
    expect(res.status).toBe(200);
    expect(state.upserts.filter((u) => u.table === "friendships")).toHaveLength(1);
  });

  it("對方同時撤回了：409，不寫好友關係", async () => {
    state.updatedRows = [];
    state.currentStatus = "recalled";
    const res = await call("accept");
    expect(res.status).toBe(409);
    expect(state.upserts).toHaveLength(0);
  });
});
