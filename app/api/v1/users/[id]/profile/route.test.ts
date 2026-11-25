import { beforeEach, describe, expect, it, vi } from "vitest";

// iOS DEF-20261125-005：匿名看他人主頁。只放行對方 mode=public，且只給陌生人視角
// （只 public 帖、無座標、無共同好友數、不查封鎖／好友關係）；好友模式／隱身／me 一律 401。
const TARGET = "11111111-1111-4111-8111-111111111111";

const state = vi.hoisted(() => ({
  userId: null as string | null,
  mode: "public",
  tables: [] as string[],
  blockChecks: 0,
}));

vi.mock("@/lib/api/envelope", () => import("../../../../../../lib/api/envelope"));
vi.mock("@/lib/api/checkins", () => import("../../../../../../lib/api/checkins"));
vi.mock("@/lib/api/privacy", () => import("../../../../../../lib/api/privacy"));
vi.mock("@/lib/friends", () => import("../../../../../../lib/friends"));
vi.mock("@/lib/api/profile", () => import("../../../../../../lib/api/profile"));
vi.mock("@/lib/api/taste", () => import("../../../../../../lib/api/taste"));
vi.mock("@/lib/api/blocks", async () => {
  const real = await import("../../../../../../lib/api/blocks");
  return {
    ...real,
    isPairBlocked: async () => {
      state.blockChecks += 1;
      return false;
    },
  };
});

const CHECKINS = [
  { id: "c-pub", user_id: TARGET, kind: "photo", visibility: "public", created_at: "2026-11-20T12:00:00Z", lat: 22.28, lng: 114.15, place_name: "中環", tags: [], hashtags: [] },
  { id: "c-fri", user_id: TARGET, kind: "photo", visibility: "friends", created_at: "2026-11-19T12:00:00Z", lat: 22.28, lng: 114.15, place_name: "灣仔", tags: [], hashtags: [] },
  { id: "c-pri", user_id: TARGET, kind: "photo", visibility: "private", created_at: "2026-11-18T12:00:00Z", lat: 22.28, lng: 114.15, place_name: "銅鑼灣", tags: [], hashtags: [] },
];

vi.mock("@/lib/supabase/server", () => {
  const db = {
    from: (table: string) => {
      state.tables.push(table);
      const rows = (): unknown[] => (table === "checkins" ? CHECKINS : []);
      const user = {
        id: TARGET, nickname: "Chris", avatar_url: null, gender: "male", dob: "1995-01-01", bio: "hi",
        mode: state.mode, created_at: "2026-01-01T00:00:00Z", preferences: null, height_cm: null,
        occupation: null, languages: null, interests: null, info_visibility: null,
      };
      const q: Record<string, unknown> = {};
      const chain = () => q;
      for (const m of ["select", "eq", "neq", "in", "or", "order", "limit", "gte", "lte", "gt", "lt", "is", "not", "range", "filter", "match", "contains"]) {
        q[m] = chain;
      }
      q.maybeSingle = async () => ({ data: table === "users" ? user : null, error: null });
      q.single = q.maybeSingle;
      q.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: rows(), error: null, count: 0 }).then(resolve);
      return q;
    },
  };
  return {
    getAuthedClient: async () => ({ userId: state.userId, supabase: db }),
    createServiceClient: async () => db,
  };
});

import { GET } from "./route";

const call = (id: string) =>
  GET(new Request(`https://example.invalid/api/v1/users/${id}/profile`), { params: Promise.resolve({ id }) });

beforeEach(() => {
  state.userId = null;
  state.mode = "public";
  state.tables = [];
  state.blockChecks = 0;
});

describe("GET /users/{id}/profile 匿名", () => {
  it("對方 public：200 陌生人視角，只有 public 帖、無座標、無共同好友數", async () => {
    const res = await call(TARGET);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data?: Record<string, unknown> } & Record<string, unknown>;
    const data = (body.data ?? body) as Record<string, unknown>;
    expect(data.relationship).toBe("none");
    expect(data.mutual_friends_count).toBeNull();
    const recent = data.recent_checkins as Array<Record<string, unknown>>;
    expect(recent.map((r) => r.id)).toEqual(["c-pub"]);
    expect(recent[0].lat).toBeUndefined();
    expect(recent[0].lng).toBeUndefined();
    expect((data.user as Record<string, unknown>).mode).toBeUndefined();
    // 訪客沒有身份：不查封鎖、不查好友關係
    expect(state.blockChecks).toBe(0);
    expect(state.tables).not.toContain("friendships");
  });

  it.each(["friends", "stealth"])("對方 %s：401（登入後查看）", async (mode) => {
    state.mode = mode;
    const res = await call(TARGET);
    expect(res.status).toBe(401);
  });

  it("me：401", async () => {
    const res = await call("me");
    expect(res.status).toBe(401);
  });

  it("已登入照舊走封鎖與好友關係檢查", async () => {
    state.userId = "22222222-2222-4222-8222-222222222222";
    state.mode = "stealth";
    const res = await call(TARGET);
    expect(res.status).toBe(200);
    expect(state.blockChecks).toBe(1);
    expect(state.tables).toContain("friendships");
  });
});
