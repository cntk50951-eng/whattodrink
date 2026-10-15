import { describe, expect, it } from "vitest";

import {
  decodeChatCursor,
  directKey,
  encodeChatCursor,
  isConversationExpired,
  isSizeWithin,
  parseChatListParams,
  parseConversationId,
  parseConversationOrigin,
  parseCreateConversationBody,
  parseCreateMessageBody,
  parseReadBody,
  peerIdsOfMembers,
  parseSignBody,
  parseViewBody,
  strangerQuotaJson,
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
  it("收 user_id（origin 缺省 direct）", () => {
    expect(parseCreateConversationBody({ user_id: "u1" })).toEqual({ user_id: "u1", origin: "direct" });
  });
  it("空／非對象拒", () => {
    expect(parseCreateConversationBody({})).toHaveProperty("error");
    expect(parseCreateConversationBody(null)).toHaveProperty("error");
    expect(parseCreateConversationBody({ user_id: "  " })).toHaveProperty("error");
  });
  it("D.10 origin 白名单＋非法回落", () => {
    expect(parseCreateConversationBody({ user_id: "u1", origin: "cheers" })).toEqual({
      user_id: "u1",
      origin: "cheers",
    });
    expect(parseCreateConversationBody({ user_id: "u1", origin: "party" })).toEqual({
      user_id: "u1",
      origin: "party",
    });
    expect(parseCreateConversationBody({ user_id: "u1", origin: "nope" })).toEqual({
      user_id: "u1",
      origin: "direct",
    });
    expect(parseConversationOrigin("profile")).toBe("profile");
    expect(parseConversationOrigin(42)).toBe("direct");
  });
});

describe("strangerQuotaJson（§十四累计制）", () => {
  it("used 钳零＋remaining＝3-used", () => {
    expect(strangerQuotaJson(0)).toEqual({ limit: 3, used: 0, remaining: 3 });
    expect(strangerQuotaJson(2)).toEqual({ limit: 3, used: 2, remaining: 1 });
    expect(strangerQuotaJson(3)).toEqual({ limit: 3, used: 3, remaining: 0 });
    expect(strangerQuotaJson(9)).toEqual({ limit: 3, used: 9, remaining: 0 });
    expect(strangerQuotaJson(-1)).toEqual({ limit: 3, used: 0, remaining: 3 });
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
      body: null,
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
  it("D.8：image caption 可选（缺席／空即 null；超长拒）；audio 带正文拒", () => {
    const base = {
      kind: "image",
      client_msg_id: "c-20",
      attachments: [{ path: "u1/a.jpg", mime: "image/jpeg", bytes: 100 }],
    };
    expect(parseCreateMessageBody({ ...base, body: "好靚" })).toEqual({ ...base, body: "好靚" });
    expect(parseCreateMessageBody({ ...base, body: "" })).toEqual({ ...base, body: null });
    expect(parseCreateMessageBody({ ...base, body: "x".repeat(2001) })).toHaveProperty("error");
    expect(
      parseCreateMessageBody({
        kind: "audio",
        body: "顺带一句话",
        client_msg_id: "c-21",
        attachments: [{ path: "u1/a.webm", mime: "audio", bytes: 10, secs: 5 }],
      }),
    ).toHaveProperty("error");
  });
  it("D.8：附件 kind/bucket 一致性（有即验；超限 413）", () => {
    const file = {
      kind: "image",
      client_msg_id: "c-22",
      attachments: [{ kind: "file", bucket: "chat-images", path: "u1/a.jpg", mime: "image/jpeg", bytes: 100 }],
    };
    const r = parseCreateMessageBody(file);
    expect(r).toEqual({
      kind: "image",
      body: null,
      attachments: [{ path: "u1/a.jpg", mime: "image/jpeg", bytes: 100 }],
      client_msg_id: "c-22",
    });
    expect(
      parseCreateMessageBody({
        ...file,
        attachments: [{ kind: "file", bucket: "chat-voice", path: "u1/a.jpg", mime: "image/jpeg", bytes: 100 }],
      }),
    ).toHaveProperty("error");
    expect(
      parseCreateMessageBody({
        ...file,
        attachments: [{ kind: "share", path: "u1/a.jpg", mime: "image/jpeg", bytes: 100 }],
      }),
    ).toHaveProperty("error");
    const over = parseCreateMessageBody({
      ...file,
      attachments: [{ path: "u1/a.jpg", mime: "image/jpeg", bytes: 11 * 1024 * 1024 }],
    });
    expect(over).toHaveProperty("error");
    expect((over as { status?: number }).status).toBe(413);
  });
});

describe("parseSignBody／parseViewBody", () => {
  it("sign 收三件套＋拒超限", () => {
    expect(parseSignBody({ purpose: "image", ext: "png", bytes: 10 })).toEqual({
      purpose: "image",
      ext: "png",
      bytes: 10,
      sha256: null,
    });
    expect(parseSignBody({ purpose: "image", ext: "exe", bytes: 10 })).toHaveProperty("error");
    expect(parseSignBody({ purpose: "voice", ext: "webm", bytes: 3 * 1024 * 1024 })).toHaveProperty("error");
  });
  it("D.8：sha256 可选（hex64 收；非法拒；超限 413）", () => {
    const sha = "a".repeat(64);
    expect(parseSignBody({ purpose: "image", ext: "png", bytes: 10, sha256: sha })).toEqual({
      purpose: "image",
      ext: "png",
      bytes: 10,
      sha256: sha,
    });
    expect(parseSignBody({ purpose: "image", ext: "png", bytes: 10, sha256: "xyz" })).toHaveProperty("error");
    const over = parseSignBody({ purpose: "image", ext: "png", bytes: 11 * 1024 * 1024 });
    expect(over).toHaveProperty("error");
    expect((over as { status?: number }).status).toBe(413);
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
  it("D.8：顶层 mime/bytes/secs 取首个文件附件；文本即 null", () => {
    expect(toChatMessage(row, "u1")).toMatchObject({ mime: null, bytes: null, secs: null });
    const img = toChatMessage(
      {
        ...row,
        kind: "image",
        body: null,
        attachments: [{ path: "u1/a.jpg", mime: "image/jpeg", bytes: 100 }],
      },
      "u2",
    );
    expect(img).toMatchObject({ mime: "image/jpeg", bytes: 100, secs: null });
    const aud = toChatMessage(
      {
        ...row,
        kind: "audio",
        attachments: [{ path: "u1/a.m4a", mime: "audio", bytes: 50, secs: 7 }],
      },
      "u2",
    );
    expect(aud).toMatchObject({ mime: "audio", bytes: 50, secs: 7 });
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

describe("isSizeWithin", () => {
  it("±10% 容差；非法输入 false", () => {
    expect(isSizeWithin(100, 100)).toBe(true);
    expect(isSizeWithin(109, 100)).toBe(true);
    expect(isSizeWithin(111, 100)).toBe(false);
    expect(isSizeWithin(50, 100)).toBe(false);
    expect(isSizeWithin(NaN, 100)).toBe(false);
    expect(isSizeWithin(100, 0)).toBe(false);
    expect(isSizeWithin(-5, 100)).toBe(false);
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

describe("peerIdsOfMembers", () => {
  it("滤自己；空成员回空（调用方 500，不判陌生）", () => {
    expect(peerIdsOfMembers([{ user_id: "me" }, { user_id: "you" }], "me")).toEqual(["you"]);
    expect(peerIdsOfMembers([{ user_id: "me" }], "me")).toEqual([]);
    expect(peerIdsOfMembers([], "me")).toEqual([]);
    expect(peerIdsOfMembers([{ user_id: 42 } as never], "me")).toEqual([]);
  });
});

describe("位置分享附件", () => {
  const base = { kind: "text", body: "📍 我的位置", client_msg_id: "c1" };
  it("接受合法位置，坐標收斂到 5 位小數、label 清洗截斷", () => {
    const r = parseCreateMessageBody({ ...base, attachments: [{ location: { lat: 22.2783456789, lng: 114.1747123456, label: "  中環\n蘭桂坊  " } }] });
    expect(r).toEqual({ kind: "text", body: "📍 我的位置", location: { lat: 22.27835, lng: 114.17471, label: "中環 蘭桂坊" }, client_msg_id: "c1" });
    const long = parseCreateMessageBody({ ...base, attachments: [{ location: { lat: 1, lng: 2, label: "x".repeat(300) } }] });
    expect("location" in long && long.location?.label?.length).toBe(120);
    const noLabel = parseCreateMessageBody({ ...base, attachments: [{ location: { lat: 1, lng: 2 } }] });
    expect("location" in noLabel && noLabel.location).toEqual({ lat: 1, lng: 2 });
  });
  it("拒絕越界／非數字／缺字段", () => {
    for (const loc of [{ lat: 91, lng: 0 }, { lat: 0, lng: 181 }, { lat: "22", lng: 114 }, { lat: NaN, lng: 1 }, { lat: 1 }, null, "x"]) {
      expect(parseCreateMessageBody({ ...base, attachments: [{ location: loc }] })).toHaveProperty("error");
    }
  });
  it("位置與打卡分享互斥：附件只能一枚", () => {
    expect(parseCreateMessageBody({ ...base, attachments: [{ location: { lat: 1, lng: 2 } }, { checkin_id: "a" }] })).toHaveProperty("error");
  });
});

