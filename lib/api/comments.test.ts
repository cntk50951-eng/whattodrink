import { describe, expect, it } from "vitest";

import {
  anonHasOutstanding,
  anonShortTag,
  decodeCommentsCursor,
  encodeCommentsCursor,
  overWindowLimit,
  parseCommentBody,
  parseCommentsParams,
  rawAnonIdOf,
  toCommentJson,
  withViewerFlags,
} from "./comments";

describe("parseCommentBody", () => {
  it("收合法正文（去空白）", () => {
    expect(parseCommentBody({ body: "  好正！" })).toEqual({ body: "好正！" });
  });
  it("空串拒收", () => {
    expect(parseCommentBody({ body: "   " })).toHaveProperty("error");
  });
  it("超 500 拒收", () => {
    expect(parseCommentBody({ body: "x".repeat(501) })).toHaveProperty("error");
  });
  it("非对象拒收", () => {
    expect(parseCommentBody(null)).toHaveProperty("error");
  });
});

describe("comments cursor", () => {
  it("编解码往返", () => {
    const c = { v: 1 as const, ca: new Date(1000).toISOString(), id: "abc" };
    expect(decodeCommentsCursor(encodeCommentsCursor(c))).toEqual(c);
  });
  it("坏串回 null", () => {
    expect(decodeCommentsCursor("!!!")).toBeNull();
    expect(decodeCommentsCursor(encodeCommentsCursor({ v: 2, ca: "x", id: "" } as never))).toBeNull();
  });
});

describe("parseCommentsParams", () => {
  it("缺省 limit 20 无 cursor", () => {
    expect(parseCommentsParams(new URLSearchParams())).toEqual({ limit: 20, cursor: null });
  });
  it("越界 limit 拒收", () => {
    expect(parseCommentsParams(new URLSearchParams("limit=99"))).toHaveProperty("error");
  });
  it("坏 cursor 拒收", () => {
    expect(parseCommentsParams(new URLSearchParams("cursor=zzz"))).toHaveProperty("error");
  });
});

describe("anonShortTag", () => {
  it("确定且 4 位大写", () => {
    const a = anonShortTag("some-uuid");
    expect(a).toMatch(/^[0-9A-F]{4}$/);
    expect(anonShortTag("some-uuid")).toBe(a);
  });
  it("不同 id 大概率不同", () => {
    expect(anonShortTag("aaa")).not.toBe(anonShortTag("bbb"));
  });
});

describe("toCommentJson", () => {
  const base = {
    id: "c1",
    checkin_id: "p1",
    body: "正！",
    status: "visible",
    created_at: new Date(2000).toISOString(),
    user_id: "u1",
    anon_id: null,
  };
  it("登录行映射", () => {
    expect(toCommentJson(base)).toMatchObject({
      author: { kind: "user", user_id: "u1", name: null },
    });
  });
  it("登录行带昵称", () => {
    const j = toCommentJson({ ...base, users: { nickname: "阿怡" } });
    expect(j?.author).toEqual({ kind: "user", user_id: "u1", name: "阿怡" });
  });
  it("匿名行带短號", () => {
    const j = toCommentJson({ ...base, user_id: null, anon_id: "anon-x" });
    expect(j?.author).toEqual({ kind: "anon", tag: anonShortTag("anon-x") });
  });
  it("双无身份跳过", () => {
    expect(toCommentJson({ ...base, user_id: null, anon_id: null })).toBeNull();
  });
  it("坏时间跳过", () => {
    expect(toCommentJson({ ...base, created_at: "nope" })).toBeNull();
  });
});

describe("anonHasOutstanding", () => {
  it("无留言即 false", () => {
    expect(anonHasOutstanding([], [])).toBe(false);
  });
  it("作者未回且有留言即 true", () => {
    expect(anonHasOutstanding([100], [])).toBe(true);
  });
  it("作者回在后即清零", () => {
    expect(anonHasOutstanding([100], [200])).toBe(false);
  });
  it("作者回后又有新留言即 true", () => {
    expect(anonHasOutstanding([100, 300], [200])).toBe(true);
  });
});

describe("overWindowLimit", () => {
  it("达上限即 true", () => {
    expect(overWindowLimit(3, 3)).toBe(true);
    expect(overWindowLimit(2, 3)).toBe(false);
  });
});

describe("withViewerFlags", () => {
  const userRow = {
    id: "c1",
    checkin_id: "p1",
    body: "正！",
    status: "visible",
    created_at: new Date(2000).toISOString(),
    user_id: "u1",
    anon_id: null,
    users: { nickname: "阿怡" },
  };
  const anonRow = { ...userRow, user_id: null, anon_id: "anon-x", users: null };
  it("帖作者本人看自己＝双章", () => {
    const j = withViewerFlags(
      toCommentJson(userRow)!,
      { userId: "u1" },
      "u1",
      rawAnonIdOf(userRow),
    );
    expect(j.is_author).toBe(true);
    expect(j.is_mine).toBe(true);
  });
  it("路人看作者＝仅作者章", () => {
    const j = withViewerFlags(
      toCommentJson(userRow)!,
      { userId: "u2" },
      "u1",
      rawAnonIdOf(userRow),
    );
    expect(j.is_author).toBe(true);
    expect(j.is_mine).toBe(false);
  });
  it("路人看路人＝无章", () => {
    const j = withViewerFlags(
      toCommentJson(userRow)!,
      { userId: "u2" },
      "u9",
      rawAnonIdOf(userRow),
    );
    expect(j.is_author).toBe(false);
    expect(j.is_mine).toBe(false);
  });
  it("匿名看自己＝仅我章（作者章不受影响）", () => {
    const j = withViewerFlags(
      toCommentJson(anonRow)!,
      { anonId: "anon-x" },
      "u1",
      rawAnonIdOf(anonRow),
    );
    expect(j.is_author).toBe(false);
    expect(j.is_mine).toBe(true);
  });
  it("匿名看别人＝无章", () => {
    const j = withViewerFlags(
      toCommentJson(anonRow)!,
      { anonId: "anon-y" },
      "u1",
      rawAnonIdOf(anonRow),
    );
    expect(j.is_mine).toBe(false);
  });
  it("游客＝无章", () => {
    const j = withViewerFlags(toCommentJson(userRow)!, null, "u1", null);
    expect(j.is_author).toBe(true);
    expect(j.is_mine).toBe(false);
  });
});
