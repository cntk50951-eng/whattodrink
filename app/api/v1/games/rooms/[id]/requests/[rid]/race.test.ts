import { beforeEach, describe, expect, it, vi } from "vitest";

// 第八輪 R8-02：申請決定（CAS）與取消／另一裝置互斥；輸的一方不佔位、不通知；佔位失敗要把申請退回 pending。
const st = vi.hoisted(() => ({
  reqStatus: "pending" as string,
  casLost: false,          // 模擬：CAS 之前申請已被對方取消
  claim: { kind: "ok", seat: 1 } as { kind: string; seat?: number },
  claims: 0,
  notices: [] as unknown[],
  undone: 0,
}));
vi.mock("@/lib/api/envelope", () => import("../../../../../../../../lib/api/envelope"));
vi.mock("@/lib/api/retryWrite", () => import("../../../../../../../../lib/api/retryWrite"));
vi.mock("@/lib/games/rooms", () => ({
  parseJoinDecision: (raw: { decision: string }) => ({ decision: raw.decision }),
  loadRoomAsMember: async () => ({ room: { id: "room", status: "lobby", version: 4, max_players: 6 } }),
  requireHost: () => null,
  claimRoomSeat: async () => { st.claims += 1; return st.claim; },
  bumpRoom: async () => 5,
  appendEvent: async () => undefined,
}));
vi.mock("@/lib/supabase/server", () => {
  const db = {
    from: (table: string) => {
      let op = "read"; let vals: Record<string, unknown> = {}; const eqs: Record<string, unknown> = {};
      const q: Record<string, unknown> = {
        select: () => q,
        eq: (k: string, v: unknown) => { eqs[k] = v; return q; },
        update: (v: Record<string, unknown>) => { op = "update"; vals = v; return q; },
        insert: (v: Record<string, unknown>) => { op = "insert"; vals = v; return q; },
        maybeSingle: async () => ({
          error: null,
          data: table === "game_join_requests" ? { id: "r", room_id: "room", user_id: "p", status: st.reqStatus } : null,
        }),
        then: (resolve: (v: unknown) => unknown) => {
          let data: unknown = [];
          if (table === "game_join_requests" && op === "update") {
            if (eqs.status === "pending" && st.reqStatus === "pending" && !st.casLost) { st.reqStatus = String(vals.status); data = [{ id: "r" }]; }
            else if (eqs.status === "pending" && st.casLost) { st.reqStatus = "cancelled"; data = []; }
            else if (eqs.status === "approved") { st.reqStatus = "pending"; st.undone += 1; data = [{ id: "r" }]; }
          }
          if (table === "notifications" && op === "insert") st.notices.push(vals);
          return Promise.resolve({ data, error: null }).then(resolve);
        },
      };
      return q;
    },
  };
  return { getAuthedClient: async () => ({ userId: "host", supabase: db }), createServiceClient: async () => db };
});
import { POST } from "./route";

const decide = (decision: "approve" | "reject") =>
  POST(new Request("https://example.invalid", { method: "POST", body: JSON.stringify({ decision }) }),
    { params: Promise.resolve({ id: "room", rid: "r" }) });

beforeEach(() => {
  st.reqStatus = "pending"; st.casLost = false; st.claim = { kind: "ok", seat: 1 };
  st.claims = 0; st.notices.splice(0); st.undone = 0;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("入房申請決定與取消的競態", () => {
  it("批准時申請已被取消（CAS 輸）→ 回 cancelled，不佔位、不通知", async () => {
    st.casLost = true;
    const res = await decide("approve");
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("cancelled");
    expect(st.claims).toBe(0);
    expect(st.notices).toHaveLength(0);
  });

  it("拒絕時申請已被取消（CAS 輸）→ 回 cancelled，不發『被拒絕』通知", async () => {
    st.casLost = true;
    const res = await decide("reject");
    expect((await res.json()).status).toBe("cancelled");
    expect(st.notices).toHaveLength(0);
  });

  it("佔位失敗（滿員）→ 409，且申請退回 pending、不發通知", async () => {
    st.claim = { kind: "room_full" };
    const res = await decide("approve");
    expect(res.status).toBe(409);
    expect(st.reqStatus).toBe("pending");
    expect(st.undone).toBe(1);
    expect(st.notices).toHaveLength(0);
  });

  it("正常批准：先 CAS 後佔位，發一則通知", async () => {
    const res = await decide("approve");
    expect(res.status).toBe(200);
    expect(st.reqStatus).toBe("approved");
    expect(st.claims).toBe(1);
    expect(st.notices).toHaveLength(1);
  });
});
