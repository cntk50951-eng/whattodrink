import { describe, expect, it, vi } from "vitest";

import { claimRoomSeat } from "./rooms";

// 第七輪 §3.4：入房佔位走 game_room_claim_seat RPC；沒跑 0084 遷移時退回舊三步寫法
type RpcResult = { data: unknown; error: unknown };
function svcWith(rpc: RpcResult, tables: Record<string, unknown> = {}) {
  const writes: string[] = [];
  const svc = {
    rpc: vi.fn(async () => rpc),
    from(table: string) {
      let op = "select";
      const q: Record<string, unknown> = {
        select: () => q, eq: () => q, order: () => q,
        insert: () => { op = "insert"; writes.push(`${table}.insert`); return q; },
        update: () => { op = "update"; writes.push(`${table}.update`); return q; },
        maybeSingle: async () => ({ data: tables[`${table}.one`] ?? null, error: null }),
        then: (res: (v: unknown) => unknown) =>
          Promise.resolve({ data: op === "select" ? (tables[table] ?? []) : null, error: null }).then(res),
      };
      return q;
    },
  };
  return { svc: svc as never, writes, rpc: svc.rpc };
}

describe("claimRoomSeat", () => {
  it("RPC 結果逐一映射", async () => {
    for (const result of ["room_full", "room_started", "kicked", "room_not_found"] as const) {
      const { svc } = svcWith({ data: { result }, error: null });
      expect(await claimRoomSeat(svc, "r", "u", 0)).toEqual({ kind: result });
    }
    expect(await claimRoomSeat(svcWith({ data: { result: "ok", seat: 3 }, error: null }).svc, "r", "u", 0)).toEqual({ kind: "ok", seat: 3 });
    expect(await claimRoomSeat(svcWith({ data: { result: "already", seat: 1 }, error: null }).svc, "r", "u", 0)).toEqual({ kind: "already", seat: 1 });
    expect(await claimRoomSeat(svcWith({ data: { result: "???" }, error: null }).svc, "r", "u", 0)).toEqual({ kind: "error" });
  });

  it("RPC 其他錯誤 → error，不退回舊寫法（避免繞過鎖）", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { svc, writes } = svcWith({ data: null, error: { code: "XX000" } });
    expect(await claimRoomSeat(svc, "r", "u", 0)).toEqual({ kind: "error" });
    expect(writes).toEqual([]);
  });

  it("遷移未跑（42883／PGRST202）→ 退回舊路徑：有空位就寫入，席號 = 最大 + 1", async () => {
    for (const code of ["42883", "PGRST202"]) {
      const { svc, writes } = svcWith(
        { data: null, error: { code } },
        { game_room_players: [{ room_id: "r", user_id: "a", seat: 0, status: "active" }, { room_id: "r", user_id: "b", seat: 2, status: "active" }], "game_rooms.one": { max_players: 6 } },
      );
      expect(await claimRoomSeat(svc, "r", "u", 0)).toEqual({ kind: "ok", seat: 3 });
      expect(writes).toContain("game_room_players.insert");
    }
  });

  it("舊路徑：滿員 → room_full 且不寫入", async () => {
    const { svc, writes } = svcWith(
      { data: null, error: { code: "42883" } },
      { game_room_players: [{ room_id: "r", user_id: "a", seat: 0, status: "active" }], "game_rooms.one": { max_players: 1 } },
    );
    expect(await claimRoomSeat(svc, "r", "u", 0)).toEqual({ kind: "room_full" });
    expect(writes).toEqual([]);
  });
});
