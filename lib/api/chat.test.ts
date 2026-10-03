import { describe, expect, it } from "vitest";

import {
  decodeChatCursor,
  directKey,
  encodeChatCursor,
  isConversationExpired,
  parseChatListParams,
  parseConversationId,
  parseCreateConversationBody,
  parseCreateMessageBody,
  parseReadBody,
  parseSignBody,
  parseViewBody,
  toChatMessage,
  toChatPeer,
} from "./chat";

describe("directKey", () => {
  it("順序無關＋自聊原樣（自聊由 route 擋）", () => {
    expect(directKey("a", "b")).toBe(directKey("b", "a"));
    expect(directKey("a", "a")).toBe("a|a");
  });
});

describe("parseCreateConversationBody", () => {
  it("收 user_id", () => {
    expect(parseCreateConversationBody({ user_id: "u1" })).toEqual({ user_id: "u1" });
  });
  it("空／非對象拒", () => {
    expect(parseCreateConversationBody({})).toHaveProperty("error");
    expect(parseCreateConversationBody(null)).toHaveProperty("error");
    expect(parseCreateConversationBody({ user_id: "  " })).toHaveProperty("error");
  });
});

describe("chat cursor", () => {
  it("roundtrip＋壞串 null", () => {
    const c = { v: 1 as const, ca: new Date(1700000000000).toISOString(), id: "m1" };
    expect(decodeChatCursor(encodeChatCursor(c))).toEqual(c);
    expect(decodeChatCursor("!!!")).toBeNull();
    expect(decodeChatCursor(encodeChatCursor({ v: 2, ca: c.ca, id: "x" } as never))).toBeNull();
  });
});

describe("parseChatListParams", () => {
  it("缺省 20＋cursor 透傳", () => {
    expect(parseChatListParams(new URLSearchParams(""))).toEqual({
      params: { limit: 20, cursor: null },
    });
  });
  it("非法 limit／cursor 拒", () => {
    expect(parseChatListParams(new URLSearchParams("limit=0"))).toHaveProperty("error");
    expect(parseChatListParams(new URLSearchParams("limit=99"))).toHaveProperty("error");
    expect(parseChatListParams(new URLSearchParams("cursor=z"))).toHaveProperty("error");
  });
});

describe("parseReadBody", () => {
  it("收毫秒水位", () => {
    expect(parseReadBody({ last_read_at: 1700000000000 })).toEqual({ last_read_at: 1700000000000 });
    expect(parseReadBody({})).toHaveProperty("error");
    expect(parseReadBody({ last_read_at: -1 })).toHaveProperty("error");
  });
});

describe("parseConversationId", () => {
  it("空拒", () => {
    expect(parseConversationId("x")).toEqual({ id: "x" });
    expect(parseConversationId(" ")).toHaveProperty("error");
  });
});

describe("parseCreateMessageBody", () => {
  const good = { kind: "text", body: "今晚飲咩", client_msg_id: "c-1" };
  it("收 text 三件套", () => {
    expect(parseCreateMessageBody(good)).toEqual(good);
  });
  it("非 text／空體／超長／缺冪等鍵拒", () => {
    expect(parseCreateMessageBody({ ...good, kind: "video" })).toHaveProperty("error");
    expect(parseCreateMessageBody({ ...good, body: "  " })).toHaveProperty("error");
    expect(parseCreateMessageBody({ ...good, body: "x".repeat(2001) })).toHaveProperty("error");
    expect(parseCreateMessageBody({ kind: "text", body: "hi" })).toHaveProperty("error");
  });
  it("E.13：text 可带一枚分享附件（checkin_id），多枚／非法拒", () => {
    const share = {
      kind: "text",
      body: "中環 Soho",
      client_msg_id: "c-9",
      attachments: [{ checkin_id: "11111111-2222-3333-4444-555555555555" }],
    };
    expect(parseCreateMessageBody(share)).toEqual({
      kind: "text",
      body: "中環 Soho",
      share: { checkin_id: "11111111-2222-3333-4444-555555555555" },
      client_msg_id: "c-9",
    });
    expect(
      parseCreateMessageBody({ ...share, attachments: [{ checkin_id: "a" }, { checkin_id: "b" }] }),
    ).toHaveProperty("error");
    expect(
      parseCreateMessageBody({ ...share, attachments: [{ checkin_id: "../x" }] }),
    ).toHaveProperty("error");
    expect(
      parseCreateMessageBody({ ...share, attachments: [{ path: "u1/a.jpg" }] }),
    ).toHaveProperty("error");
  });
  it("E.13：分享附件可带地点 place（展示文本，非坐标；超长截断）", () => {
    expect(
      parseCreateMessageBody({
        kind: "text",
        body: "呢杯正",
        client_msg_id: "c-10",
        attachments: [{ checkin_id: "abc-123", place: "中環 Soho" }],
      }),
    ).toEqual({
      kind: "text",
      body: "呢杯正",
      share: { checkin_id: "abc-123", place: "中環 Soho" },
      client_msg_id: "c-10",
    });
    expect(
      parseCreateMessageBody({
        kind: "text",
        body: "hi",
        client_msg_id: "c-11",
        attachments: [{ checkin_id: "abc-123", place: "  " }],
      }),
    ).toEqual({
      kind: "text",
      body: "hi",
      share: { checkin_id: "abc-123" },
      client_msg_id: "c-11",
    });
  });
  it("D.6：image／audio 附件校验", () => {
    const img = {
      kind: "image",
      client_msg_id: "c-2",
      attachments: [{ path: "u1/a.jpg", mime: "image/jpeg", bytes: 100 }],
    };
    expect(parseCreateMessageBody(img)).toEqual({
      kind: "image",
      attachments: [{ path: "u1/a.jpg", mime: "image/jpeg", bytes: 100 }],
      client_msg_id: "c-2",
    });
    expect(parseCreateMessageBody({ ...img, kind: "image", attachments: [] })).toHaveProperty("error");
    expect(
      parseCreateMessageBody({
        kind: "audio",
        client_msg_id: "c-3",
        attachments: [{ path: "u1/a.exe", mime: "audio", bytes: 10, secs: 5 }],
      }),
    ).toHaveProperty("error");
    expect(
      parseCreateMessageBody({
        kind: "audio",
        client_msg_id: "c-3",
        attachments: [{ path: "u1/a.webm", mime: "audio", bytes: 10, secs: 61 }],
      }),
    ).toHaveProperty("error");
    expect(
      parseCreateMessageBody({
        kind: "audio",
        client_msg_id: "c-3",
        attachments: [{ path: "u1/a.webm", mime: "audio", bytes: 10, secs: 5 }],
      }),
    ).toEqual({
      kind: "audio",
      attachments: [{ path: "u1/a.webm", mime: "audio", bytes: 10, secs: 5 }],
      client_msg_id: "c-3",
    });
  });
});

describe("parseSignBody／parseViewBody", () => {
  it("sign 收三件套＋拒超限", () => {
    expect(parseSignBody({ purpose: "image", ext: "png", bytes: 10 })).toEqual({
      purpose: "image",
      ext: "png",
      bytes: 10,
    });
    expect(parseSignBody({ purpose: "image", ext: "exe", bytes: 10 })).toHaveProperty("error");
    expect(parseSignBody({ purpose: "voice", ext: "webm", bytes: 3 * 1024 * 1024 })).toHaveProperty("error");
  });
  it("view 收合法 bucket＋path", () => {
    expect(parseViewBody({ bucket: "chat-images", path: "u1/a.png" })).toEqual({
      bucket: "chat-images",
      path: "u1/a.png",
    });
    expect(parseViewBody({ bucket: "avatars", path: "u1/a.png" })).toHaveProperty("error");
    expect(parseViewBody({ bucket: "chat-images", path: "../x" })).toHaveProperty("error");
  });
});

describe("toChatMessage", () => {
  const row = {
    id: "m1",
    sender_id: "u1",
    kind: "text",
    body: "hi",
    created_at: new Date(1700000000000).toISOString(),
  };
  it("映射＋mine 派生", () => {
    expect(toChatMessage(row, "u1")).toMatchObject({ id: "m1", mine: true, created_at: 1700000000000 });
    expect(toChatMessage(row, "u2")?.mine).toBe(false);
  });
  it("壞行 null", () => {
    expect(toChatMessage({ ...row, created_at: "nope" }, "u1")).toBeNull();
    expect(toChatMessage(null, "u1")).toBeNull();
  });
});

describe("toChatPeer", () => {
  it("只吐三列", () => {
    expect(
      toChatPeer({ id: "u2", nickname: "N", avatar_url: null, lat: 1, email: "x" }),
    ).toEqual({ user_id: "u2", nickname: "N", avatar_url: null });
    expect(toChatPeer({ id: "u2" })).toBeNull();
  });
});

describe("isConversationExpired", () => {
  it("過期與壞時間", () => {
    const now = 1700000000000;
    expect(isConversationExpired(new Date(now - 1).toISOString(), now)).toBe(true);
    expect(isConversationExpired(new Date(now + 1000).toISOString(), now)).toBe(false);
    expect(isConversationExpired("bad", now)).toBe(true);
  });
});
