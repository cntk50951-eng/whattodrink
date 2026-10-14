import { describe, expect, it } from "vitest";

import {
  gameSocialErrorKey,
  joinStatusKey,
  normalizeRoomCode,
  parseGamePlayer,
  parseGameRoom,
  parseGameRound,
  parseJoinOutcome,
  parseJoinRequest,
  parseJoinStatus,
  parseRoomRules,
} from "./gameRoom";

describe("gameRoom", () => {
  it("房間／成員壞行 null", () => {
    expect(parseGameRoom(null)).toBeNull();
    expect(parseGameRoom({ id: "r" })).toBeNull();
    expect(parseGamePlayer({})).toBeNull();
    const p = parseGamePlayer({ user_id: "u", nickname: "  ", ready: true });
    expect(p?.nickname).toBe("酒友");
    expect(p?.ready).toBe(true);
  });
  it("加入分流 200／202", () => {
    expect(parseJoinOutcome(200, { room_id: "r" })).toEqual({ kind: "joined", roomId: "r" });
    expect(parseJoinOutcome(202, { request_id: "q" })).toEqual({ kind: "pending", requestId: "q" });
    expect(parseJoinOutcome(200, {})).toBeNull();
  });
  it("申請狀態＋人話鍵", () => {
    expect(parseJoinStatus({ status: "approved", room_id: "r" })).toEqual({ status: "approved", roomId: "r" });
    expect(joinStatusKey("pending")).toBeNull();
    expect(joinStatusKey("rejected")).toBe("gameJoinRejected");
    expect(joinStatusKey("expired")).toBe("gameJoinExpired");
  });
  it("審批行＋房碼歸一", () => {
    const r = parseJoinRequest({ request_id: "q", user: { id: "u", nickname: "K" } });
    expect(r?.nickname).toBe("K");
    expect(parseJoinRequest({})).toBeNull();
    expect(normalizeRoomCode(" ab12 ")).toBe("AB12");
    expect(normalizeRoomCode("   ")).toBeNull();
  });
  it("社交錯誤鍵", () => {
    expect(gameSocialErrorKey("too_many_requests")).toBe("gameErrTooMany");
    expect(gameSocialErrorKey("message_rejected")).toBeNull();
    expect(gameSocialErrorKey(null)).toBeNull();
  });
  it("回合解析", () => {
    expect(parseGameRound(null)).toBeNull();
    expect(parseRoomRules({ mode: "deal_only", min_open_qty: 3 }).mode).toBe("deal_only");
    expect(parseRoomRules(null).minOpenQty).toBe(2);
    const r = parseGameRound({
      no: 2,
      status: "bidding",
      current_turn_user: "u1",
      turn_deadline: "2026-10-20T20:00:30+08:00",
      last_bid: { qty: 3, face: 5, zhai: false },
      my_dice: [1, 2, 3, "x", 5],
    });
    expect(r?.last_bid).toEqual({ qty: 3, face: 5, zhai: false });
    expect(r?.my_dice).toEqual([1, 2, 3, 5]);
    expect(r?.revealed).toBeNull();
  });
});
