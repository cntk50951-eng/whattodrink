import { describe, expect, it } from "vitest";

import {
  gameChatTextValid,
  GAME_MSG_MAX,
  GAME_QUICK_KEYS,
  mergeGameChat,
  parseGameChatMessage,
  parseGameReportCat,
  type GameChatMessage,
} from "./gameChat";
import { GAME_MSG_MAX as SERVER_MSG_MAX, GAME_QUICK_KEYS as SERVER_QUICK_KEYS } from "./games/rooms";

const m = (id: string, created_at: string | null, body = "hi"): GameChatMessage => ({
  id,
  created_at,
  removed: false,
  user: { id: "u", nickname: "K", avatar_url: null },
  kind: "text",
  quick_key: null,
  body,
});

describe("gameChat", () => {
  it("常量與服務端一致（漂移即紅）", () => {
    expect([...GAME_QUICK_KEYS]).toEqual([...SERVER_QUICK_KEYS]);
    expect(GAME_MSG_MAX).toBe(SERVER_MSG_MAX);
  });
  it("壞行 null＋快捷鍵白名單", () => {
    expect(parseGameChatMessage(null)).toBeNull();
    expect(parseGameChatMessage({ id: "1", kind: "quick", quick_key: "nope" })?.quick_key).toBeNull();
    expect(parseGameChatMessage({ id: "1", kind: "quick", quick_key: "ready" })?.quick_key).toBe("ready");
  });
  it("合并去重＋撤回更新＋升序＋截尾", () => {
    const a = m("1", "2026-10-20T20:00:01+08:00");
    const b = m("2", "2026-10-20T20:00:02+08:00");
    const b2: GameChatMessage = { ...b, removed: true, body: null };
    const out = mergeGameChat([a, b], [b2, m("1", "2026-10-20T20:00:01+08:00")]);
    expect(out.map((x) => x.id)).toEqual(["1", "2"]);
    expect(out[1]?.removed).toBe(true);
    expect(mergeGameChat([a], [b], 1).map((x) => x.id)).toEqual(["2"]);
  });
  it("文字校驗 60", () => {
    expect(gameChatTextValid("  hi ")).toBe(true);
    expect(gameChatTextValid("")).toBe(false);
    expect(gameChatTextValid("x".repeat(61))).toBe(false);
  });
  it("舉報類別", () => {
    expect(parseGameReportCat("cheating")).toBe("cheating");
    expect(parseGameReportCat("x")).toBeNull();
  });
});
