import { describe, expect, it } from "vitest";

import type { ChatMessage } from "./chat";
import { cacheKeyForPeer, mergeMessageLists, validateCache } from "./chatCache";

const m = (id: string, at: number, role: ChatMessage["role"] = "friend"): ChatMessage => ({
  id,
  role,
  text: id,
  at,
  read: true,
});

describe("cacheKeyForPeer", () => {
  it("peer 命名空间稳定", () => {
    expect(cacheKeyForPeer("u1")).toBe("peer:u1");
  });
});

describe("validateCache", () => {
  const good = { v: 1, ownerUid: "me", convId: "c1", savedAt: 1, messages: [m("a", 1)] };
  it("对版即收（坏行逐行丢）", () => {
    const got = validateCache(
      { ...good, messages: [m("a", 1), { id: 1 }, null] },
      "me",
    );
    expect(got?.messages.map((x) => x.id)).toEqual(["a"]);
  });
  it("错 owner／错版本／非数组即弃", () => {
    expect(validateCache(good, "other")).toBeNull();
    expect(validateCache({ ...good, v: 9 }, "me")).toBeNull();
    expect(validateCache({ ...good, messages: "x" }, "me")).toBeNull();
    expect(validateCache(null, "me")).toBeNull();
  });
});

describe("mergeMessageLists", () => {
  it("同 id 取 extra＋时间升序", () => {
    const out = mergeMessageLists([m("a", 3), m("b", 1)], [m("a", 4, "me")]);
    expect(out.map((x) => x.id)).toEqual(["b", "a"]);
    expect(out[1].role).toBe("me");
  });
  it("超限裁末 N 条", () => {
    const base = [m("a", 1), m("b", 2), m("c", 3)];
    expect(mergeMessageLists(base, [], 2).map((x) => x.id)).toEqual(["b", "c"]);
  });
});
