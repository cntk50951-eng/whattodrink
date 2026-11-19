import { beforeEach, describe, expect, it, vi } from "vitest";

// C-01：POST /api/v1/checkins 的 Idempotency-Key 行為（重放短路、舊庫降級、並發衝突、header 不合法照常發）。
const st = vi.hoisted(() => ({
  existing: null as Record<string, unknown> | null,       // (user_id, client_key) 已有的那則
  lookupError: null as { code: string; message: string } | null,
  insertErrors: [] as Array<{ code: string; message: string; details?: string } | null>, // 依序回的插入錯誤（null＝成功）
  inserts: [] as Array<Record<string, unknown>>,
  moderation: vi.fn(),
  grant: vi.fn(),
}));

const ROW = {
  id: "c-1", beer_id: null, lat: 22.3, lng: 114.1, place_name: "Bar", kind: "post", visibility: "public",
  expires_at: null, created_at: "2026-11-19T10:00:00Z", photo_url: null, note: "hi", audio_url: null,
  audio_seconds: null, transcript: "", tags: [], hashtags: ["a"],
};

vi.mock("@/lib/api/envelope", () => import("../../../../lib/api/envelope"));
vi.mock("@/lib/api/checkins", () => import("../../../../lib/api/checkins"));
vi.mock("@/lib/api/checkinIdempotency", () => import("../../../../lib/api/checkinIdempotency"));
vi.mock("@/lib/api/privacy", () => import("../../../../lib/api/privacy"));
vi.mock("@/lib/hashtagLibrary", () => ({ recordUserHashtags: async () => {} }));
vi.mock("@/lib/accountDeletion", () => ({ isDeletionPending: async () => false }));
vi.mock("@/lib/moderation", () => ({
  moderateCheckin: (...a: unknown[]) => st.moderation(...a),
  moderationAction: () => "allow",
}));
vi.mock("@/lib/barCredits", () => ({ grantPostCredit: (...a: unknown[]) => st.grant(...a) }));
vi.mock("@/lib/supabase/server", () => {
  const db = {
    auth: { getUser: async () => ({ data: { user: null } }) },
    from: (table: string) => {
      let mode: "select" | "insert" = "select";
      let keyed = false;
      const q: Record<string, unknown> = {
        select: () => q,
        eq: (col: string) => { if (col === "client_key") keyed = true; return q; },
        insert: (row: Record<string, unknown>) => { mode = "insert"; st.inserts.push(row); return q; },
        single: async () => {
          const err = st.insertErrors.length > 0 ? st.insertErrors.shift() ?? null : null;
          return err === null ? { data: ROW, error: null } : { data: null, error: err };
        },
        maybeSingle: async () => {
          if (table === "checkins" && keyed) {
            return st.lookupError !== null ? { data: null, error: st.lookupError } : { data: st.existing, error: null };
          }
          if (table === "users") return { data: { id: "me", mode: "public", checkin_visibility: null }, error: null };
          return { data: null, error: null };
        },
      };
      void mode;
      return q;
    },
  };
  return { getAuthedClient: async () => ({ userId: "me", supabase: db }), createServiceClient: async () => db };
});

import { POST } from "./route";

const KEY = "3F2504E0-4F89-11D3-9A0C-0305E82C3301";
const body = { lat: 22.3, lng: 114.1, kind: "post", note: "hi", beer_id: null };
const req = (key?: string) =>
  new Request("https://example.invalid/api/v1/checkins", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(key !== undefined ? { "Idempotency-Key": key } : {}) },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  st.existing = null; st.lookupError = null; st.insertErrors = []; st.inserts = [];
  st.moderation.mockReset(); st.moderation.mockResolvedValue({ flagged: false, skipped: true });
  st.grant.mockReset(); st.grant.mockResolvedValue(null);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /checkins 發布冪等", () => {
  it("同 key 已有那則：直接回同一則（201），不審核、不插入、不發積分、不帶 bar_reward", async () => {
    st.existing = ROW;
    const res = await POST(req(KEY));
    expect(res.status).toBe(201);
    const j = await res.json();
    expect(j.checkin.id).toBe("c-1");
    expect(j.checkin.hashtags).toEqual(["a"]);
    expect(j.bar_reward).toBeUndefined();
    expect(st.moderation).not.toHaveBeenCalled();
    expect(st.inserts).toHaveLength(0);
    expect(st.grant).not.toHaveBeenCalled();
  });

  it("第一次發：照常審核並插入，client_key 隨單落庫", async () => {
    const res = await POST(req(KEY));
    expect(res.status).toBe(201);
    expect(st.moderation).toHaveBeenCalledTimes(1);
    expect(st.inserts).toHaveLength(1);
    expect(st.inserts[0].client_key).toBe(KEY);
  });

  it("沒帶或不合法的 key：照常發（不報 400），也不寫 client_key", async () => {
    for (const k of [undefined, "short", "has space and more chars"]) {
      st.inserts = [];
      const res = await POST(req(k));
      expect(res.status).toBe(201);
      expect(st.inserts[0]).not.toHaveProperty("client_key");
    }
  });

  it("0078 還沒跑（查 client_key 就報列不存在）：整單降級成沒有冪等，貼文仍是 public，不掉進私密回退", async () => {
    st.lookupError = { code: "42703", message: 'column "client_key" does not exist' };
    const res = await POST(req(KEY));
    expect(res.status).toBe(201);
    expect(st.inserts).toHaveLength(1);
    expect(st.inserts[0]).not.toHaveProperty("client_key");
    expect(st.inserts[0].visibility).toBe("public");
  });

  it("插入時才發現 client_key 列不存在：去掉該列重試，不走 0007 的私密回退", async () => {
    st.insertErrors = [{ code: "42703", message: 'column "client_key" of relation "checkins" does not exist' }];
    const res = await POST(req(KEY));
    expect(res.status).toBe(201);
    expect(st.inserts).toHaveLength(2);
    expect(st.inserts[0].client_key).toBe(KEY);
    expect(st.inserts[1]).not.toHaveProperty("client_key");
    expect(st.inserts[1].visibility).toBe("public");
  });

  it("並發重送：插入撞 client_key 唯一索引（23505）→ 回先插入的那則", async () => {
    st.insertErrors = [{ code: "23505", message: 'duplicate key value violates unique constraint "checkins_user_client_key_uniq"' }];
    // 第一次查（預檢）沒有，撞衝突後再查才有
    let calls = 0;
    const orig = st.existing;
    Object.defineProperty(st, "existing", { configurable: true, get: () => (++calls >= 2 ? ROW : orig), set: () => {} });
    const res = await POST(req(KEY));
    expect(res.status).toBe(201);
    expect((await res.json()).checkin.id).toBe("c-1");
    expect(st.grant).not.toHaveBeenCalled();
  });
});
