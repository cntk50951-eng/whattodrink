import { describe, expect, it } from "vitest";

import { appendLocalEcho, formatChatTime, formatSeenAgo, mockThread } from "./chat";

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

describe("formatSeenAgo", () => {
  it("分鐘級中英皆相對文案", () => {
    expect(formatSeenAgo(NOW - 5 * 60_000, NOW, "zh-Hant")).toBe("5 分鐘前");
    expect(formatSeenAgo(NOW - 5 * 60_000, NOW, "en")).toBe("5 minutes ago");
  });

  it("秒級與小時級邊界", () => {
    expect(formatSeenAgo(NOW - 20_000, NOW, "en")).toBe("20 seconds ago");
    expect(formatSeenAgo(NOW - 2 * 3_600_000, NOW, "zh-Hans")).toBe("2小时前");
  });

  it("未來時間鉗零不炸", () => {
    expect(formatSeenAgo(NOW + 60_000, NOW, "en")).toBe("now");
  });
});
