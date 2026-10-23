import { describe, expect, it } from "vitest";

import { parseActionBody, parseCreateBody, toRoomJson } from "./rooms";

/** UR H.3：臥底房在房間層的解析（建房／房規保留／動作包）。 */
describe("parseCreateBody（spy）", () => {
  it("game=spy：默認 6 人，房規解析成 spy 房規", () => {
    const r = parseCreateBody({ game: "spy", rules: { spy_count: 2, packs: ["tea"] } });
    expect(r).toEqual({ game: "spy", maxPlayers: 6, rules: { spy_count: 2, packs: ["tea"] } });
  });
  it("spy 人數只要 4–8；其他遊戲名拒絕", () => {
    expect("error" in parseCreateBody({ game: "spy", max_players: 3 })).toBe(true);
    expect("error" in parseCreateBody({ game: "spy", max_players: 9 })).toBe(true);
    expect(parseCreateBody({ game: "spy", max_players: 8 })).toMatchObject({ maxPlayers: 8 });
    expect("error" in parseCreateBody({ game: "poker" })).toBe(true);
  });
  it("大話骰行為不變（缺省仍是 liars_dice、2–8 人）", () => {
    expect(parseCreateBody({})).toMatchObject({ game: "liars_dice", maxPlayers: 6 });
    expect(parseCreateBody({ max_players: 2 })).toMatchObject({ maxPlayers: 2 });
    expect("error" in parseCreateBody({ max_players: 1 })).toBe(true);
  });
});

describe("toRoomJson（spy 房規不被骰局房規吃掉）", () => {
  const base = {
    id: "r1", code: "ABCD", host_id: "h", status: "lobby", max_players: 6, version: 3, expires_at: "2026-01-01T00:00:00Z",
  };
  it("spy 房保留 spy_count／packs", () => {
    const j = toRoomJson({ ...base, game: "spy", rules: { spy_count: 2, packs: ["night"] } });
    expect(j?.rules).toEqual({ spy_count: 2, packs: ["night"] });
  });
  it("骰局房仍按骰局房規解析", () => {
    const j = toRoomJson({ ...base, game: "liars_dice", rules: { dice_per_player: 3 } });
    expect((j?.rules as { dice_per_player: number }).dice_per_player).toBe(3);
  });
});

describe("parseActionBody（臥底動作）", () => {
  const b = { expected_version: 4, client_action_id: "a1" };
  it("speak_done／rematch 不需 payload", () => {
    expect(parseActionBody({ ...b, type: "speak_done" })).toEqual({ type: "speak_done", expectedVersion: 4, clientActionId: "a1" });
    expect(parseActionBody({ ...b, type: "rematch" })).toMatchObject({ type: "rematch" });
  });
  it("vote 需要 target", () => {
    expect(parseActionBody({ ...b, type: "vote", payload: { target: "u2" } })).toMatchObject({ type: "vote", target: "u2" });
    expect("error" in parseActionBody({ ...b, type: "vote" })).toBe(true);
    expect("error" in parseActionBody({ ...b, type: "vote", payload: { target: "" } })).toBe(true);
  });
  it("骰局動作仍可解析、未知類型拒絕", () => {
    expect(parseActionBody({ ...b, type: "challenge" })).toMatchObject({ type: "challenge" });
    expect("error" in parseActionBody({ ...b, type: "fold" })).toBe(true);
  });
});
