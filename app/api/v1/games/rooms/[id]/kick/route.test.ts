import { beforeEach, describe, expect, it, vi } from "vitest";

// 第七輪 §3.3：房主「移出並拉黑」——拉黑沒寫成不能回已移出；兩個選項各自只做自己的事。
const state = vi.hoisted(() => ({ blockFail: false, log: [] as string[] }));
vi.mock("@/lib/api/envelope", () => import("../../../../../../../lib/api/envelope"));
vi.mock("@/lib/mode", () => ({ STEALTH_SELF_BLOCK_MSG: "stealth" }));
vi.mock("@/lib/games/rooms", () => ({
  parseKickBody: (raw: { user_id?: string; block?: boolean }) => ({ userId: raw.user_id, block: raw.block === true }),
  isStealthUser: async () => false,
  loadRoomAsMember: async () => ({ room: { id: "room" }, members: [{ user_id: "host" }, { user_id: "peer" }] }),
  requireHost: () => null,
  applyDeparture: async () => { state.log.push("departure"); return { version: 9 }; },
}));
vi.mock("@/lib/supabase/server", () => {
  const db = {
    from: (table: string) => {
      const q: Record<string, unknown> = {
        update: () => { state.log.push(`${table}.update`); return q; },
        eq: () => q,
        insert: async () => ({ error: null }),
        upsert: async () => {
          state.log.push(`${table}.upsert`);
          return { error: state.blockFail ? { code: "XX000", message: "boom" } : null };
        },
        then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(resolve),
      };
      return q;
    },
  };
  return { getAuthedClient: async () => ({ userId: "host" }), createServiceClient: async () => db };
});
import { POST } from "./route";

const kick = (block?: boolean) =>
  POST(
    new Request("https://example.invalid", { method: "POST", body: JSON.stringify({ user_id: "peer", ...(block === undefined ? {} : { block }) }) }),
    { params: Promise.resolve({ id: "room" }) },
  );

beforeEach(() => {
  state.blockFail = false;
  state.log.splice(0);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("POST /games/rooms/:id/kick", () => {
  it("block:true 且拉黑寫失敗 → 500，且沒有移出任何人", async () => {
    state.blockFail = true;
    const res = await kick(true);
    expect(res.status).toBe(500);
    expect(state.log).toContain("cheers_blocks.upsert");
    expect(state.log).not.toContain("game_room_players.update");
    expect(state.log).not.toContain("departure");
  });

  it("block:true 成功：先拉黑後移出，回 200", async () => {
    const res = await kick(true);
    expect(res.status).toBe(200);
    expect(state.log.indexOf("cheers_blocks.upsert")).toBeLessThan(state.log.indexOf("game_room_players.update"));
  });

  it("block 缺省／false：只移出，不寫拉黑", async () => {
    for (const b of [undefined, false]) {
      state.log.splice(0);
      expect((await kick(b)).status).toBe(200);
      expect(state.log).not.toContain("cheers_blocks.upsert");
      expect(state.log).toContain("departure");
    }
  });
});
