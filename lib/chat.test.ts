import { describe, expect, it } from "vitest";

import { appendLocalEcho, formatChatTime, mockThread } from "./chat";

const NOW = 1_757_000_000_000;

describe("mockThread", () => {
  it("回三段且時間升序、角色交替", () => {
    const t = mockThread(NOW);
    expect(t).toHaveLength(3);
    expect(t.map((m) => m.role)).toEqual(["friend", "me", "friend"]);
    expect(t[0].at).toBeLessThan(t[1].at);
    expect(t[1].at).toBeLessThan(t[2].at);
  });

  it("同一個 now 形狀穩定", () => {
    expect(mockThread(NOW)).toEqual(mockThread(NOW));
  });
});

describe("appendLocalEcho", () => {
  it("尾部追加我方未讀消息，原數組不動", () => {
    const prev = mockThread(NOW);
    const next = appendLocalEcho(prev, "local-1", "好呀", NOW);
    expect(next).toHaveLength(4);
    expect(next[3]).toMatchObject({ id: "local-1", role: "me", text: "好呀", read: false });
    expect(prev).toHaveLength(3);
  });
});

describe("formatChatTime", () => {
  it("HH:mm 補零", () => {
    const d = new Date(NOW);
    d.setHours(9, 5, 0, 0);
    expect(formatChatTime(d.getTime())).toBe("09:05");
  });
});
