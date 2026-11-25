import { beforeEach, describe, expect, it, vi } from "vitest";

const st = vi.hoisted(() => ({
  firstStatus: "pending" as string,
  secondStatus: "approved" as string,
  cancelUpdates: true,
  currentStatus: "approved" as string,
  roomId: "room-42",
}));

vi.mock("@/lib/api/envelope", () => import("../../../../../../lib/api/envelope"));
vi.mock("@/lib/games/rooms", () => ({
  expireJoinRequests: async () => undefined,
}));
vi.mock("@/lib/supabase/server", () => {
  let getReadCount = 0;
  const db = {
    from: (table: string) => {
      let op = "select";
      const q: Record<string, unknown> = {
        select: () => q,
        eq: () => q,
        update: () => { op = "update"; return q; },
        maybeSingle: async () => {
          if (table !== "game_join_requests") return { data: null, error: null };
          if (op === "select") {
            getReadCount += 1;
            if (getReadCount === 1) {
              return { data: { id: "r1", room_id: st.roomId, user_id: "u1", status: st.firstStatus }, error: null };
            }
            return { data: { status: st.secondStatus, room_id: st.roomId }, error: null };
          }
          return { data: null, error: null };
        },
        then: (resolve: (v: unknown) => unknown) => {
          if (table === "game_join_requests" && op === "update") {
            return Promise.resolve({ data: st.cancelUpdates ? [{ id: "r1" }] : [], error: null }).then(resolve);
          }
          return Promise.resolve({ data: [], error: null }).then(resolve);
        },
      };
      return q;
    },
    resetCount: () => { getReadCount = 0; },
  };
  return {
    getAuthedClient: async () => ({ userId: "u1", supabase: db }),
    createServiceClient: async () => db,
    __reset: () => db.resetCount(),
  };
});

import { DELETE, GET } from "./route";
import * as supa from "@/lib/supabase/server";

beforeEach(() => {
  st.firstStatus = "pending";
  st.secondStatus = "approved";
  st.cancelUpdates = true;
  st.currentStatus = "approved";
  (supa as unknown as { __reset: () => void }).__reset();
});

describe("GET/DELETE /api/v1/games/join-requests/:rid（第九輪 §3.1）", () => {
  it("GET 在兩次讀取間由 pending 變為 approved 時，必須附帶 room_id", async () => {
    const res = await GET(new Request("https://example.invalid"), { params: Promise.resolve({ rid: "r1" }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "approved", room_id: "room-42" });
  });

  it("DELETE 成功取消 pending 申請回 cancelled:true", async () => {
    st.cancelUpdates = true;
    const res = await DELETE(new Request("https://example.invalid", { method: "DELETE" }), { params: Promise.resolve({ rid: "r1" }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ cancelled: true });
  });

  it("DELETE 與房主批准撞車（0 列受影響）回 cancelled:false 與真實終態及 room_id", async () => {
    st.cancelUpdates = false;
    st.firstStatus = "approved";
    const res = await DELETE(new Request("https://example.invalid", { method: "DELETE" }), { params: Promise.resolve({ rid: "r1" }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ cancelled: false, status: "approved", room_id: "room-42" });
  });
});
