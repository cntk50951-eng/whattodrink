import { beforeEach, describe, expect, it } from "vitest";

// vitest 跑 node 環境，無 localStorage —— 最小內存 stub
//（lib 只在函數內懶讀，頂層定義即生效）。
const memStore = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (k: string) => (memStore.has(k) ? (memStore.get(k) as string) : null),
    setItem: (k: string, v: string) => void memStore.set(k, v),
    removeItem: (k: string) => void memStore.delete(k),
    clear: () => memStore.clear(),
  },
  configurable: true,
});

beforeEach(() => memStore.clear());

import {
  HOT_WINDOW_MS,
  MAX_STORED_POSTS,
  MOCK_POSTS,
  getPostAudioUrl,
  hasUnseenWall,
  isEmptyAudioDataUrl,
  ownPostAudioUrl,
  parseWallPost,
  sortHot,
  sortLatest,
  toggleLike,
} from "./posts";
import type { WallPost } from "./posts";

function makePost(over: Partial<WallPost> = {}): WallPost {
  return {
    id: "test-1",
    photo: "data:image/jpeg;base64,AAA",
    note: "hi",
    audioSeconds: null,
    audioDataUrl: null,
    transcript: "",
    likes: 5,
    likedByMe: false,
    createdAt: 1700000000000,
    author: { nickname: "我", avatarEmoji: "😎", gender: "secret", me: true },
    reported: false,
    ...over,
  };
}

describe("parseWallPost", () => {
  it("accepts a well-formed post", () => {
    expect(parseWallPost(makePost())?.id).toBe("test-1");
  });

  it("rejects non-image photos and bad shapes", () => {
    expect(parseWallPost({ ...makePost(), photo: "https://x/y.jpg" })).toBeNull();
    expect(parseWallPost(null)).toBeNull();
    expect(parseWallPost({ ...makePost(), likes: Number.NaN })).toBeNull();
    expect(
      parseWallPost({ ...makePost(), author: { nickname: "x" } }),
    ).toBeNull();
  });

  it("floors negative likes", () => {
    expect(parseWallPost(makePost({ likes: -3 }))?.likes).toBe(0);
  });
});

describe("MOCK_POSTS seeds", () => {
  it("are all valid and not mine", () => {
    expect(MOCK_POSTS.length).toBeGreaterThanOrEqual(4);
    for (const seed of MOCK_POSTS) {
      expect(parseWallPost(seed)).not.toBeNull();
      expect(seed.author.me).toBe(false);
      expect(seed.photo.startsWith("data:image/")).toBe(true);
    }
  });

  it("span inside and outside the 24h window", () => {
    const now = Date.now();
    const inside = MOCK_POSTS.filter((p) => now - p.createdAt < HOT_WINDOW_MS);
    const outside = MOCK_POSTS.filter((p) => now - p.createdAt >= HOT_WINDOW_MS);
    expect(inside.length).toBeGreaterThan(0);
    expect(outside.length).toBeGreaterThan(0);
  });
});

describe("sortHot / sortLatest", () => {
  const now = 1700000000000;
  const posts = [
    makePost({ id: "old-hot", likes: 99, createdAt: now - HOT_WINDOW_MS - 1 }),
    makePost({ id: "new-mid", likes: 10, createdAt: now - 1000 }),
    makePost({ id: "new-top", likes: 50, createdAt: now - 2000 }),
  ];

  it("hot drops out-of-window posts even with more likes", () => {
    expect(sortHot(posts, now).map((p) => p.id)).toEqual(["new-top", "new-mid"]);
  });

  it("latest is pure time desc", () => {
    expect(sortLatest(posts).map((p) => p.id)).toEqual([
      "new-mid",
      "new-top",
      "old-hot",
    ]);
  });
});

describe("toggleLike", () => {
  it("flips the flag and adjusts the count", () => {
    const on = toggleLike(makePost({ likes: 5, likedByMe: false }));
    expect(on.likedByMe).toBe(true);
    expect(on.likes).toBe(6);
    const off = toggleLike(on);
    expect(off.likedByMe).toBe(false);
    expect(off.likes).toBe(5);
  });

  it("never drops below zero", () => {
    expect(toggleLike(makePost({ likes: 0, likedByMe: true })).likes).toBe(0);
  });
});

describe("hasUnseenWall", () => {
  it("is true only when something is newer than seenAt", () => {
    const posts = [makePost({ createdAt: 100 })];
    expect(hasUnseenWall(posts, 0)).toBe(true);
    expect(hasUnseenWall(posts, 100)).toBe(false);
    expect(hasUnseenWall([], 0)).toBe(false);
  });
});

describe("persistPost / overrides", () => {
  it("merges overrides onto seeds on load", async () => {
    const { loadWall, saveOverride } = await import("./posts");
    const seed = MOCK_POSTS[0] as WallPost;
    saveOverride(seed.id, { ...seed, likes: seed.likes + 1, likedByMe: true });
    const found = loadWall().find((p) => p.id === seed.id);
    expect(found?.likes).toBe(seed.likes + 1);
    expect(found?.likedByMe).toBe(true);
    localStorage.clear();
  });

  it("filters reported posts from the wall", async () => {
    const { loadWall, saveOverride } = await import("./posts");
    const seed = MOCK_POSTS[1] as WallPost;
    saveOverride(seed.id, { ...seed, reported: true });
    expect(loadWall().some((p) => p.id === seed.id)).toBe(false);
    localStorage.clear();
  });
});

describe("audioDataUrl persistence", () => {
  it("defaults missing audioDataUrl to null (old stored posts)", async () => {
    const { parseWallPost } = await import("./posts");
    const { audioDataUrl: _drop, ...legacy } = makePost();
    void _drop;
    expect(parseWallPost(legacy)?.audioDataUrl).toBeNull();
  });

  it("accepts a small audio dataURL and rejects fakes", async () => {
    const { parseWallPost } = await import("./posts");
    expect(
      parseWallPost(makePost({ audioDataUrl: "data:audio/mp4;base64,AAA" }))
        ?.audioDataUrl,
    ).toBe("data:audio/mp4;base64,AAA");
    expect(
      parseWallPost(makePost({ audioDataUrl: "https://x/y.mp3" })),
    ).toBeNull();
  });

  it("fitAudioDataUrl caps at 400KB", async () => {
    const { AUDIO_DATAURL_MAX, fitAudioDataUrl } = await import("./posts");
    expect(AUDIO_DATAURL_MAX).toBe(400 * 1024);
    expect(fitAudioDataUrl(null)).toBeNull();
    expect(fitAudioDataUrl("x".repeat(100))).toBe("x".repeat(100));
    expect(fitAudioDataUrl("x".repeat(AUDIO_DATAURL_MAX + 1))).toBeNull();
  });
});

describe("empty voice clips (v5 legacy 416)", () => {
  it("isEmptyAudioDataUrl 只認逗號後無 payload", () => {
    expect(isEmptyAudioDataUrl("data:audio/webm;base64,")).toBe(true);
    expect(isEmptyAudioDataUrl("data:audio/webm;base64,AAA")).toBe(false);
    expect(isEmptyAudioDataUrl("no-comma")).toBe(false);
  });

  it("parse 中和空包字符串的秒數＋URL（舊帖不再 416）", () => {
    const p = parseWallPost(
      makePost({ audioSeconds: 7, audioDataUrl: "data:audio/webm;base64," }),
    );
    expect(p?.audioSeconds).toBeNull();
    expect(p?.audioDataUrl).toBeNull();
  });

  it("null dataUrl 不動秒數（會話 URL 檔靠 seconds 顯示）", () => {
    const p = parseWallPost(
      makePost({ audioSeconds: 7, audioDataUrl: null }),
    );
    expect(p?.audioSeconds).toBe(7);
  });

  it("ownPostAudioUrl 登記牆自有 URL（跟 composer 脫鉤）", () => {
    const url = ownPostAudioUrl("clip-1", new Blob(["abc"]));
    expect(url.startsWith("blob:")).toBe(true);
    expect(getPostAudioUrl("clip-1")).toBe(url);
  });
});

describe("MAX_STORED_POSTS", () => {
  it("caps local growth", () => {
    expect(MAX_STORED_POSTS).toBeLessThanOrEqual(20);
  });
});
