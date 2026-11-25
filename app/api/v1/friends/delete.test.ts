import { beforeEach, describe, expect, it, vi } from "vitest";

// 第七輪 §3.2：解除好友回 removed:true 之前，雙向禁言必須已寫成功；禁言失敗關係原封不動，刪除失敗補償撤禁言。
const state = vi.hoisted(() => ({
  friendRows: [{ user_id: "me" }] as Array<Record<string, unknown>>,
  muteFail: false,
  deleteFail: false,
  log: [] as string[],
}));
vi.mock("next/server", () => ({ after: () => undefined }));
vi.mock("@/lib/api/envelope", () => import("../../../../lib/api/envelope"));
vi.mock("@/lib/api/chat", () => import("../../../../lib/api/chat"));
vi.mock("@/lib/friends", () => import("../../../../lib/friends"));
vi.mock("@/lib/push/send", () => ({ sendFriendPush: vi.fn() }));
vi.mock("@/lib/accountDeletion", () => ({ isDeletionPending: async () => false }));
vi.mock("@/lib/supabase/server", () => {
  const db = {
    from: (table: string) => {
      let op = "select";
      const q: Record<string, unknown> = {
        select: () => q,
        eq: () => q,
        or: () => q,
        in: () => q,
        limit: () => q,
        update: () => { op = "update"; return q; },
        delete: () => { op = "delete"; state.log.push(`${table}.delete`); return q; },
        upsert: async () => {
          state.log.push(`${table}.upsert`);
          return { error: state.muteFail ? { code: "XX000", message: "boom" } : null };
        },
        then: (resolve: (v: unknown) => unknown) => {
          let res: { data: unknown; error: unknown } = { data: [], error: null };
          if (table === "friendships" && op === "select") res = { data: state.friendRows, error: null };
          if (table === "friendships" && op === "delete") {
            res = { data: state.deleteFail ? null : state.friendRows, error: state.deleteFail ? { code: "XX000", message: "boom" } : null };
          }
          return Promise.resolve(res).then(resolve);
        },
      };
      return q;
    },
  };
  return { getAuthedClient: async () => ({ userId: "me", supabase: db }), createServiceClient: async () => db };
});
import { DELETE } from "./route";

const req = () =>
  new Request("https://example.invalid/api/v1/friends", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ friend_id: "peer" }),
  });

beforeEach(() => {
  state.friendRows = [{ user_id: "me" }];
  state.muteFail = false;
  state.deleteFail = false;
  state.log.splice(0);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("DELETE /api/v1/friends", () => {
  it("禁言寫失敗 → 500，且好友關係沒被刪", async () => {
    state.muteFail = true;
    const res = await DELETE(req());
    expect(res.status).toBe(500);
    expect(state.log).toContain("chat_mutes.upsert");
    expect(state.log).not.toContain("friendships.delete");
  });

  it("禁言成功才刪關係，回 removed:true（先禁言後刪除）", async () => {
    const res = await DELETE(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ removed: true });
    expect(state.log.indexOf("chat_mutes.upsert")).toBeLessThan(state.log.indexOf("friendships.delete"));
  });

  it("刪關係失敗 → 500 並補償撤掉剛寫的禁言", async () => {
    state.deleteFail = true;
    const res = await DELETE(req());
    expect(res.status).toBe(500);
    expect(state.log).toContain("chat_mutes.delete");
  });

  it("本來就不是好友 → 冪等 200，不寫禁言（防陌生人被誤禁言）", async () => {
    state.friendRows = [];
    const res = await DELETE(req());
    expect(res.status).toBe(200);
    expect(state.log).not.toContain("chat_mutes.upsert");
  });
});
