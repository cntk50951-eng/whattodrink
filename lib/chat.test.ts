import { describe, expect, it } from "vitest";

import { appendLocalEcho, formatChatTime, formatListTime, formatSeenAgo, mergeFriendList, mockThread, sumUnread, toChatAttachments } from "./chat";

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

describe("formatListTime", () => {
  it("同天 HH:mm，跨天 M/d", () => {
    const noon = new Date(NOW);
    noon.setHours(12, 34, 0, 0);
    const morning = new Date(NOW);
    morning.setHours(9, 5, 0, 0);
    expect(formatListTime(morning.getTime(), noon.getTime())).toBe("09:05");
    const yesterday = new Date(noon.getTime() - 24 * 3600_000);
    const t = formatListTime(yesterday.getTime(), noon.getTime());
    expect(t).toBe(`${yesterday.getMonth() + 1}/${yesterday.getDate()}`);
  });
});

describe("mergeFriendList", () => {
  const f = (id: string, online: boolean) => ({ user_id: id, nickname: id, avatar_url: null, online });
  it("在線置頂＋組內末信倒序＋無記錄沉底", () => {
    const rows = mergeFriendList(
      [f("off-new", false), f("on-old", true), f("off-none", false), f("on-new", true)],
      new Map([
        ["off-new", 300],
        ["on-old", 100],
        ["on-new", 200],
      ]),
    );
    expect(rows.map((r) => r.user_id)).toEqual(["on-new", "on-old", "off-new", "off-none"]);
  });
});

describe("toChatAttachments", () => {
  it("只收合法兩桶＋雙段路徑", () => {
    expect(
      toChatAttachments([
        { bucket: "chat-images", path: "u/a.png", mime: "image/png", bytes: 10 },
        { bucket: "avatars", path: "u/a.png", mime: "image/png", bytes: 10 },
        { bucket: "chat-voice", path: "../x", mime: "audio", bytes: 10 },
        "nope",
      ]),
    ).toEqual([{ bucket: "chat-images", path: "u/a.png", mime: "image/png", bytes: 10 }]);
  });
  it("非數組回空", () => {
    expect(toChatAttachments(null)).toEqual([]);
  });
});

describe("sumUnread", () => {
  it("各行 unread 求和", () => {
    expect(sumUnread([{ unread: 2 }, { unread: 0 }, { unread: 5 }])).toBe(7);
  });
  it("壞行按 0（非對象／缺鍵／非數／NaN／負數）", () => {
    expect(
      sumUnread([{ unread: 3 }, null, "x", {}, { unread: "2" }, { unread: NaN }, { unread: -4 }]),
    ).toBe(3);
  });
  it("非數組回 0，小數下取整", () => {
    expect(sumUnread(null)).toBe(0);
    expect(sumUnread([{ unread: 2.9 }])).toBe(2);
  });
});
