import { describe, expect, it } from "vitest";

import { parseActionBody, parseCreateBody, toRoomJson } from "./rooms";

/** UR H.4：尾班車在房間層的解析（建房／房規保留／動作包）。 */
describe("parseCreateBody（last_train）", () => {
  it("game=last_train：默認 6 人，房規解析成尾班車房規", () => {
    expect(parseCreateBody({ game: "last_train", rules: { packs: ["film"], fuse: "short", events: false } })).toEqual({
      game: "last_train",
      maxPlayers: 6,
      rules: { packs: ["film"], fuse: "short", events: false },
    });
    expect(parseCreateBody({ game: "last_train" })).toMatchObject({ rules: { fuse: "mid", events: true } });
  });
  it("人數只要 3–8", () => {
    expect("error" in parseCreateBody({ game: "last_train", max_players: 2 })).toBe(true);
    expect("error" in parseCreateBody({ game: "last_train", max_players: 9 })).toBe(true);
    expect(parseCreateBody({ game: "last_train", max_players: 3 })).toMatchObject({ maxPlayers: 3 });
  });
  it("臥底／骰局不受影響", () => {
    expect(parseCreateBody({ game: "spy" })).toMatchObject({ game: "spy", maxPlayers: 6 });
    expect(parseCreateBody({})).toMatchObject({ game: "liars_dice" });
    expect("error" in parseCreateBody({ game: "poker" })).toBe(true);
  });
});

describe("toRoomJson（尾班車房規不被骰局房規吃掉）", () => {
  const base = { id: "r1", code: "ABCD", host_id: "h", status: "lobby", max_players: 6, version: 3, expires_at: "2026-01-01T00:00:00Z" };
  it("保留 packs／fuse／events", () => {
    const j = toRoomJson({ ...base, game: "last_train", rules: { packs: ["dist"], fuse: "long", events: false } });
    expect(j?.rules).toEqual({ packs: ["dist"], fuse: "long", events: false });
  });
});

describe("parseActionBody（尾班車動作）", () => {
  const b = { expected_version: 4, client_action_id: "a1" };
  it("answer 需要 text（去頭尾空白，1–40 字）", () => {
    expect(parseActionBody({ ...b, type: "answer", payload: { text: "  旺角 " } })).toMatchObject({ type: "answer", text: "旺角" });
    expect("error" in parseActionBody({ ...b, type: "answer" })).toBe(true);
    expect("error" in parseActionBody({ ...b, type: "answer", payload: { text: "   " } })).toBe(true);
    expect("error" in parseActionBody({ ...b, type: "answer", payload: { text: "x".repeat(41) } })).toBe(true);
  });
  it("again 不需 payload", () => {
    expect(parseActionBody({ ...b, type: "again" })).toEqual({ type: "again", expectedVersion: 4, clientActionId: "a1" });
  });
});
