import { describe, expect, it } from "vitest";

import {
  parseActionBody,
  parseCreateBody,
  parseInviteBody,
  parseJoinCode,
  parseKickBody,
  parseReadyBody,
  parseRoomId,
  toRoomJson,
} from "./rooms";

const BASE = {
  id: "r1",
  code: "ABCDEF",
  game: "liars_dice",
  host_id: "h1",
  status: "lobby",
  rules: {},
  max_players: 6,
  version: 1,
  expires_at: new Date(0).toISOString(),
  ended_at: null,
};

describe("toRoomJson (UR H.1)", () => {
  it("合法行映射＋房规回落默认", () => {
    expect(toRoomJson(BASE)).toEqual({
      id: "r1",
      code: "ABCDEF",
      game: "liars_dice",
      host_id: "h1",
      status: "lobby",
      rules: expect.objectContaining({ dice_per_player: 5, turn_seconds: 30 }),
      max_players: 6,
      version: 1,
      expires_at: BASE.expires_at,
    });
  });
  it("坏行 null", () => {
    expect(toRoomJson({ ...BASE, status: "zzz" })).toBeNull();
    expect(toRoomJson({ ...BASE, id: "" })).toBeNull();
    expect(toRoomJson(null)).toBeNull();
  });
});

describe("房间请求体解析", () => {
  it("create：缺省 6 人／非法 game／越界人数", () => {
    expect(parseCreateBody({})).toEqual({
      game: "liars_dice",
      maxPlayers: 6,
      rules: expect.objectContaining({ dice_per_player: 5 }),
    });
    expect("error" in parseCreateBody({ game: "poker" })).toBe(true);
    expect("error" in parseCreateBody({ max_players: 9 })).toBe(true);
    expect("error" in parseCreateBody(null)).toBe(true);
  });
  it("join code：去空大写＋6 位", () => {
    expect(parseJoinCode({ code: " ab12cd " })).toEqual({ code: "AB12CD" });
    expect("error" in parseJoinCode({ code: "ABC" })).toBe(true);
    expect("error" in parseJoinCode({})).toBe(true);
  });
  it("invite：去重去己＋1-7 人", () => {
    expect(parseInviteBody({ user_ids: ["a", "a", "me", "b"] }, "me")).toEqual({ userIds: ["a", "b"] });
    expect("error" in parseInviteBody({ user_ids: [] }, "me")).toBe(true);
    expect("error" in parseInviteBody({ user_ids: ["me"] }, "me")).toBe(true);
    expect("error" in parseInviteBody({ user_ids: ["1", "2", "3", "4", "5", "6", "7", "8"] }, "me")).toBe(true);
  });
  it("ready／kick／roomId", () => {
    expect(parseReadyBody({ ready: true })).toEqual({ ready: true });
    expect("error" in parseReadyBody({ ready: "yes" })).toBe(true);
    expect(parseKickBody({ user_id: "u1" })).toEqual({ userId: "u1" });
    expect("error" in parseKickBody({})).toBe(true);
    expect(parseRoomId("r1")).toEqual({ id: "r1" });
    expect("error" in parseRoomId("")).toBe(true);
  });
  it("action：三 type＋version＋幂等键", () => {
    expect(
      parseActionBody({ type: "bid", payload: { qty: 3, face: 4 }, expected_version: 7, client_action_id: "c1" }),
    ).toEqual({
      type: "bid",
      bid: { qty: 3, face: 4, zhai: false },
      expectedVersion: 7,
      clientActionId: "c1",
    });
    expect(
      parseActionBody({ type: "challenge", expected_version: 0, client_action_id: "c2" }),
    ).toEqual({ type: "challenge", expectedVersion: 0, clientActionId: "c2" });
    expect("error" in parseActionBody({ type: "dance", expected_version: 0, client_action_id: "c" })).toBe(true);
    expect("error" in parseActionBody({ type: "bid", payload: {}, expected_version: 0, client_action_id: "c" })).toBe(true);
    expect("error" in parseActionBody({ type: "bid", payload: { qty: 1, face: 1 }, expected_version: -1, client_action_id: "c" })).toBe(true);
    expect("error" in parseActionBody({ type: "bid", payload: { qty: 1, face: 1 }, expected_version: 0, client_action_id: "" })).toBe(true);
  });
});
