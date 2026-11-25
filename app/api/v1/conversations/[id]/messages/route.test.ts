import { beforeEach, describe, expect, it, vi } from "vitest";

// 第七輪 §3.2：發送前的禁言判定查詢出錯，不能當「沒被禁言」放行。
type Res = { data: unknown; error: { code: string; message?: string } | null };
const state = vi.hoisted(() => ({
  block: { data: [], error: null } as Res,
  mute: { data: [], error: null } as Res,
}));
vi.mock("@/lib/api/envelope", () => import("../../../../../../lib/api/envelope"));
vi.mock("@/lib/api/chat", () => import("../../../../../../lib/api/chat"));
vi.mock("@/lib/friends", () => import("../../../../../../lib/friends"));
vi.mock("@/lib/api/checkins", () => ({ canViewCheckin: () => true }));
vi.mock("@/lib/supabase/server", () => {
  const db = {
    from: (table: string) => {
      const q: Record<string, unknown> = {
        select: () => q, eq: () => q, or: () => q, in: () => q, gt: () => q, order: () => q, limit: () => q,
        then: (resolve: (v: unknown) => unknown) => {
          const res: Res =
            table === "conversation_members" ? { data: [{ user_id: "me" }, { user_id: "peer" }], error: null }
            : table === "cheers_blocks" ? state.block
            : table === "chat_mutes" ? state.mute
            : { data: [], error: null };
          return Promise.resolve(res).then(resolve);
        },
      };
      return q;
    },
  };
  return { getAuthedClient: async () => ({ userId: "me", supabase: db }), createServiceClient: async () => db };
});
import { POST } from "./route";

const send = () =>
  POST(
    new Request("https://example.invalid", { method: "POST", body: JSON.stringify({ kind: "text", body: "hi", client_msg_id: "c1" }) }),
    { params: Promise.resolve({ id: "0b8f6f0e-6a4f-4a9e-9d57-1c2b3a4d5e6f" }) },
  );

beforeEach(() => {
  state.block = { data: [], error: null };
  state.mute = { data: [], error: null };
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("POST /conversations/:id/messages 禁言判定", () => {
  it("cheers_blocks 查詢出錯 → 503 可重試，不發送", async () => {
    state.block = { data: null, error: { code: "57014" } };
    const res = await send();
    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("2");
  });

  it("chat_mutes 查詢出錯（非缺表）→ 503", async () => {
    state.mute = { data: null, error: { code: "XX000" } };
    expect((await send()).status).toBe(503);
  });

  it("有拉黑行 → 403 conversation_muted", async () => {
    state.block = { data: [{ blocker_id: "peer" }], error: null };
    const res = await send();
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("conversation_muted");
  });

  it("有禁言行 → 403 conversation_muted", async () => {
    state.mute = { data: [{ blocker_id: "me" }], error: null };
    expect((await send()).status).toBe(403);
  });

  it("chat_mutes 缺表（42P01，0041 未跑）→ 沿舊行為容忍，不因此回 503", async () => {
    state.mute = { data: null, error: { code: "42P01" } };
    let status = 0;
    try { status = (await send()).status; } catch { status = -1; } // 之後的發送流程沒被這個測試 mock，丟例外也代表已通過禁言關
    expect(status).not.toBe(503);
  });
});
