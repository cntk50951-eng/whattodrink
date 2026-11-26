import { beforeEach, describe, expect, it, vi } from "vitest";

// DEF-20261125-032：訪客讀公開帖詳情（主行走匿名 RLS 會話；非 public／不存在一律 404；本人狀態恆 false）。
const st = vi.hoisted(() => ({
  row: null as Record<string, unknown> | null,
  userId: null as string | null,
  calls: [] as string[],
}));

const ROW = {
  id: "c-1", user_id: "author-1", visibility: "public", photo_url: "https://cdn/x.jpg", note: "hi", audio_url: null,
  audio_seconds: null, transcript: null, created_at: "2026-11-19T10:00:00Z", place_name: "Bar", lat: 22.318765, lng: 114.169321,
  beer_id: null, rating: null, tags: ["t"], hashtags: ["h"], kind: "post", expires_at: null,
};

/** 可鏈式的假 query：任何方法回自己；await／maybeSingle 回按表配置的結果 */
function query(table: string, result: () => Record<string, unknown>) {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "limit", "in", "or"]) q[m] = () => q;
  q.maybeSingle = async () => {
    st.calls.push(`${table}.maybeSingle`);
    return result();
  };
  q.then = (ok: (v: unknown) => unknown) => Promise.resolve(result()).then(ok);
  return q;
}

const anonClient = {
  from: (t: string) => query(`anon:${t}`, () => (t === "checkins" ? { data: st.row, error: null } : { data: null, error: null })),
};
const serviceClient = {
  from: (t: string) => {
    st.calls.push(`service:${t}`);
    if (t === "users") return query(t, () => ({ data: { nickname: "Author", avatar_url: null }, error: null }));
    if (t === "checkin_ratings") return query(t, () => ({ data: [{ user_id: "u9", rating: 4 }], error: null }));
    if (t === "cheers") return query(t, () => ({ data: [], count: 2, error: null }));
    return query(t, () => ({ data: null, count: 3, error: null }));
  },
};

vi.mock("@/lib/supabase/server", () => ({
  getAuthedClient: async () => ({ supabase: anonClient, userId: st.userId }),
  createServiceClient: async () => serviceClient,
}));
vi.mock("@/lib/api/envelope", () => import("../../../../../lib/api/envelope"));
vi.mock("@/lib/api/checkins", () => import("../../../../../lib/api/checkins"));
vi.mock("@/lib/api/rating", () => import("../../../../../lib/api/rating"));
vi.mock("@/lib/api/pins", () => import("../../../../../lib/api/pins"));
vi.mock("@/lib/friends", () => import("../../../../../lib/friends"));
vi.mock("@/lib/api/blocks", () => ({
  getBlockedUserIds: async () => {
    st.calls.push("blocks");
    return new Set<string>();
  },
  isPairBlocked: async () => {
    st.calls.push("pairBlocked");
    return false;
  },
  withBlockGuard: <T,>(h: T) => h,
}));

import { GET } from "./route";

const call = () => GET(new Request("http://localhost/api/v1/checkins/c-1"), { params: Promise.resolve({ id: "c-1" }) });

describe("GET /checkins/:id 訪客（DEF-20261125-032）", () => {
  beforeEach(() => {
    st.row = { ...ROW };
    st.userId = null;
    st.calls = [];
  });

  it("公開帖：200，帶照片／備註／標籤／計數，本人狀態全 false，不查封鎖", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    const { checkin } = await res.json();
    expect(checkin).toMatchObject({
      id: "c-1", photo_url: "https://cdn/x.jpg", note: "hi", tags: ["t"], hashtags: ["h"],
      like_count: 3, want_count: 3, comment_count: 3, cheers_count: 2, rating_count: 1,
      liked_by_me: false, saved_by_me: false, wanted_by_me: false, cheered_by_me: false,
      rated_by_me: false, my_rating: null, is_author: false, nickname: "Author",
    });
    // 座標與公開釘同口徑截斷（不外泄精確位置）
    expect(checkin.lat).toBe(22.318);
    expect(checkin.lng).toBe(114.169);
    expect(st.calls).not.toContain("blocks");
    expect(st.calls).not.toContain("pairBlocked");
  });

  it("非公開（好友／私密）：404，不洩露存在", async () => {
    st.row = { ...ROW, visibility: "friends" };
    expect((await call()).status).toBe(404);
    st.row = { ...ROW, visibility: "private" };
    expect((await call()).status).toBe(404);
  });

  it("RLS 看不到（不存在／非公開）：404，不走歸檔回退", async () => {
    st.row = null;
    expect((await call()).status).toBe(404);
    expect(st.calls).not.toContain("service:checkins_archive");
  });
});
