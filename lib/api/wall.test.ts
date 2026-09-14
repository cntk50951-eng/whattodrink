import { describe, expect, it } from "vitest";

import {
  decodeCursor,
  dropAboveHotCursor,
  encodeCursor,
  hotCursorOf,
  latestCursorOf,
  normalizeLikes,
  parseWallParams,
  sortHotPosts,
  toWallPost,
  type HotCursor,
  type WallPostJson,
} from "./wall";

function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    photo_url: "https://cdn.example/p.jpg",
    note: "今晚唔錯",
    transcript: "",
    audio_url: null,
    audio_seconds: 12,
    created_at: "2026-09-10T10:00:00.000Z",
    users: { nickname: "阿酒", avatar_url: null, gender: "female" },
    post_likes: [{ count: 3 }],
    ...overrides,
  };
}

function post(overrides: Partial<WallPostJson> = {}): WallPostJson {
  return {
    id: "p",
    photo: null,
    note: "",
    transcript: "",
    audioSeconds: null,
    audioUrl: null,
    likes: 0,
    likedByMe: false,
    createdAt: Date.parse("2026-09-10T10:00:00.000Z"),
    author: null,
    ...overrides,
  };
}

describe("toWallPost", () => {
  it("maps a full public row (join + count aggregate)", () => {
    const got = toWallPost(row());
    expect(got).toEqual({
      id: "11111111-1111-1111-1111-111111111111",
      photo: "https://cdn.example/p.jpg",
      note: "今晚唔錯",
      transcript: "",
      audioSeconds: 12,
      audioUrl: null,
      likes: 3,
      likedByMe: false,
      createdAt: Date.parse("2026-09-10T10:00:00.000Z"),
      author: { nickname: "阿酒", avatar_url: null, gender: "female" },
    });
  });

  it("accepts a deleted author (users null → author null)", () => {
    expect(toWallPost(row({ users: null }))?.author).toBeNull();
  });

  it("rejects malformed rows (bad id/date/likes/gender/photo)", () => {
    expect(toWallPost(row({ id: 7 }))).toBeNull();
    expect(toWallPost(row({ created_at: "not-a-date" }))).toBeNull();
    expect(toWallPost(row({ post_likes: [{ count: -1 }] }))).toBeNull();
    expect(toWallPost(row({ users: { nickname: "x", avatar_url: null, gender: "alien" } }))).toBeNull();
    expect(toWallPost(row({ photo_url: 42 }))).toBeNull();
    expect(toWallPost(null)).toBeNull();
  });
});

describe("normalizeLikes", () => {
  it("eats a bare number, an aggregate array, and a single count object", () => {
    expect(normalizeLikes(2)).toBe(2);
    expect(normalizeLikes([{ count: 2 }, { count: 1 }])).toBe(3);
    expect(normalizeLikes({ count: 4 })).toBe(4);
  });

  it("rejects negatives, fractions, and garbage", () => {
    expect(normalizeLikes(-1)).toBeNull();
    expect(normalizeLikes(1.5)).toBeNull();
    expect(normalizeLikes([{ nope: 1 }])).toBeNull();
    expect(normalizeLikes("3")).toBeNull();
    expect(normalizeLikes(undefined)).toBeNull();
  });
});

describe("wall cursors", () => {
  it("round-trips latest and hot cursors", () => {
    const p = post({ id: "abc", likes: 5 });
    const latest = latestCursorOf(p);
    const hot = hotCursorOf(p);
    expect(decodeCursor(encodeCursor(latest))).toEqual(latest);
    expect(decodeCursor(encodeCursor(hot))).toEqual(hot);
  });

  it("rejects garbage cursors", () => {
    expect(decodeCursor("!!!")).toBeNull();
    expect(decodeCursor(Buffer.from("{}", "utf8").toString("base64url"))).toBeNull();
    expect(
      decodeCursor(
        Buffer.from(JSON.stringify({ v: 1, sort: "latest" }), "utf8").toString("base64url"),
      ),
    ).toBeNull();
  });
});

describe("hot pagination", () => {
  const a = post({ id: "a", likes: 9, createdAt: 3000 });
  const b = post({ id: "b", likes: 9, createdAt: 2000 });
  const c = post({ id: "c", likes: 4, createdAt: 5000 });

  it("sorts likes desc, then time desc, then id", () => {
    expect(sortHotPosts([c, b, a]).map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("drops everything at or above the cursor (no dup, no gap)", () => {
    const sorted = sortHotPosts([c, b, a]);
    const cursor: HotCursor = {
      v: 1,
      sort: "hot",
      likes: 9,
      ca: new Date(2000).toISOString(),
      id: "b",
    };
    expect(dropAboveHotCursor(sorted, cursor).map((p) => p.id)).toEqual(["c"]);
  });
});

describe("parseWallParams", () => {
  const params = (q: string) => parseWallParams(new URLSearchParams(q));

  it("defaults to latest + 20 + no cursor", () => {
    expect(params("")).toEqual({
      params: { sort: "latest", limit: 20, cursor: null },
    });
  });

  it("accepts hot + custom limit", () => {
    const got = params("sort=hot&limit=5");
    expect(got).toEqual({ params: { sort: "hot", limit: 5, cursor: null } });
  });

  it("rejects bad sort, out-of-range limit, and cross-sort cursors", () => {
    expect(params("sort=spicy")).toHaveProperty("error");
    expect(params("limit=0")).toHaveProperty("error");
    expect(params("limit=51")).toHaveProperty("error");
    expect(params("limit=abc")).toHaveProperty("error");
    const latest = encodeCursor(latestCursorOf(post()));
    expect(params(`sort=hot&cursor=${encodeURIComponent(latest)}`)).toHaveProperty("error");
    expect(params("cursor=bogus")).toHaveProperty("error");
  });

  it("accepts a matching cursor", () => {
    const cursor = encodeCursor(hotCursorOf(post()));
    const got = params(`sort=hot&cursor=${encodeURIComponent(cursor)}`);
    expect(got).toEqual({
      params: { sort: "hot", limit: 20, cursor: hotCursorOf(post()) },
    });
  });
});
