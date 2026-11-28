import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const auth = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getAuthedClient: auth.get }));
// vitest 沒有 `@/` 別名（無 vitest.config）：路由的 lib 依賴照倉內慣例用相對路徑接上
vi.mock("@/lib/api/checkins", () => import("../../../../../../lib/api/checkins"));
vi.mock("@/lib/api/envelope", () => import("../../../../../../lib/api/envelope"));
vi.mock("@/lib/api/mineShare", () => import("../../../../../../lib/api/mineShare"));

const uid = "99999999-9999-9999-9999-999999999999";
const idOf = (n: number) => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, "0")}`;
const row = (n: number, at: string, extra: Record<string, unknown> = {}) => ({
  id: idOf(n), beer_id: null, lat: 22.3, lng: 114.1, place_name: "Central", kind: "post",
  visibility: "public", expires_at: null, created_at: at, photo_thumb: "data:image/jpeg;base64,dGh1bWI=",
  note: "hi", beers: null, ...extra,
});
const archived = (n: number, at: string) => {
  const r: Record<string, unknown> = row(n, at, { kind: "flash", visibility: "friends" });
  delete r.beers;
  return r;
};

type Call = { table: string; ops: [string, unknown[]][] };
/** 鏈式假查詢：記下每次呼叫；await 時按表名依序吐預設回包 */
function fakeSupabase(replies: Record<string, { data: unknown; error: unknown }[]>) {
  const calls: Call[] = [];
  const from = (table: string) => {
    const call: Call = { table, ops: [] };
    calls.push(call);
    const chain: Record<string, unknown> = {};
    for (const op of ["select", "eq", "in", "or", "order", "limit", "ilike"]) {
      chain[op] = (...args: unknown[]) => {
        call.ops.push([op, args]);
        return chain;
      };
    }
    chain.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve(replies[table]?.shift() ?? { data: [], error: null }).then(resolve);
    return chain;
  };
  return { supabase: { from }, calls };
}
const req = (params: Record<string, string> = {}) =>
  new Request(`http://localhost/api/v1/checkins/mine/share?${new URLSearchParams(params)}`);
const opsOf = (c: Call, op: string) => c.ops.filter(([name]) => name === op).map(([, args]) => args);

describe("share picker pagination API", () => {
  beforeEach(() => vi.resetAllMocks());

  it("rejects guests and bad parameters before querying", async () => {
    const { supabase, calls } = fakeSupabase({});
    auth.get.mockResolvedValue({ supabase, userId: null });
    expect((await GET(req())).status).toBe(401);
    auth.get.mockResolvedValue({ supabase, userId: uid });
    const invalid: Record<string, string>[] = [{ limit: "0" }, { limit: "51" }, { scope: "all" }, { cursor: "x|y" }];
    for (const bad of invalid) {
      expect((await GET(req(bad))).status).toBe(400);
    }
    expect(calls).toHaveLength(0);
  });

  it("pages shareable rows newest first and keeps microseconds in the cursor", async () => {
    const t = "2026-11-20T10:00:00.123456+00:00";
    const { supabase, calls } = fakeSupabase({
      checkins: [{ data: [row(3, "2026-11-21T10:00:00+00:00"), row(2, t), row(1, "2026-11-19T10:00:00+00:00")], error: null }],
    });
    auth.get.mockResolvedValue({ supabase, userId: uid });
    const res = await GET(req({ limit: "2" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    const body = await res.json();
    expect(body.checkins.map((c: { id: string }) => c.id)).toEqual([idOf(3), idOf(2)]);
    expect(body.checkins[0].photo_url).toBe("data:image/jpeg;base64,dGh1bWI=");
    expect(body.next_cursor).toBe(`${t}|${idOf(2)}`);
    expect(calls.map((c) => c.table)).toEqual(["checkins"]);
    expect(opsOf(calls[0], "eq")).toContainEqual(["user_id", uid]);
    expect(opsOf(calls[0], "in")).toContainEqual(["visibility", ["public", "friends"]]);
    expect(String(opsOf(calls[0], "or")[0][0])).toMatch(/^kind\.neq\.flash,expires_at\.is\.null,expires_at\.gt\./);
    expect(opsOf(calls[0], "limit")).toContainEqual([3]);
  });

  it("applies the cursor and a cleaned search that also matches drink names", async () => {
    const at = "2026-11-20T10:00:00.5+00:00";
    const { supabase, calls } = fakeSupabase({ beers: [{ data: [{ id: "hazy-ipa" }], error: null }] });
    auth.get.mockResolvedValue({ supabase, userId: uid });
    const res = await GET(req({ cursor: `${at}|${idOf(5)}`, q: ' IPA"),id.neq.(x ' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ checkins: [], next_cursor: null });
    const ors = opsOf(calls[1], "or").map((a) => String(a[0]));
    expect(ors).toContain('place_name.ilike."%IPA id.neq. x%",note.ilike."%IPA id.neq. x%",beer_id.in.(hazy-ipa)');
    expect(ors).toContain(`created_at.lt.${at},and(created_at.eq.${at},id.lt.${idOf(5)})`);
  });

  it("merges blocked rows with the archive and drops archived copies that are still live", async () => {
    const { supabase, calls } = fakeSupabase({
      checkins: [
        { data: [row(4, "2026-11-22T10:00:00+00:00", { visibility: "private" })], error: null },
        { data: [{ id: idOf(2) }], error: null }, // 去重查詢：2 號主表仍在
      ],
      checkins_archive: [{ data: [archived(3, "2026-11-21T10:00:00+00:00"), archived(2, "2026-11-20T10:00:00+00:00")], error: null }],
    });
    auth.get.mockResolvedValue({ supabase, userId: uid });
    const body = await (await GET(req({ scope: "blocked" }))).json();
    expect(body.checkins.map((c: { id: string }) => c.id)).toEqual([idOf(4), idOf(3)]);
    expect(body.next_cursor).toBeNull();
    expect(String(opsOf(calls[0], "or")[0][0])).toMatch(/^visibility\.eq\.private,and\(kind\.eq\.flash,expires_at\.lte\./);
    expect(opsOf(calls[1], "in")).toHaveLength(0);
  });

  it("reports more pages when either source is truncated", async () => {
    const { supabase } = fakeSupabase({
      checkins: [{ data: [], error: null }, { data: [], error: null }],
      checkins_archive: [{ data: [archived(3, "2026-11-21T10:00:00+00:00"), archived(2, "2026-11-20T10:00:00+00:00")], error: null }],
    });
    auth.get.mockResolvedValue({ supabase, userId: uid });
    const body = await (await GET(req({ scope: "blocked", limit: "1" }))).json();
    expect(body.checkins).toHaveLength(1);
    expect(body.next_cursor).toBe(`2026-11-21T10:00:00+00:00|${idOf(3)}`);
  });

  it("fails closed when the main query errors", async () => {
    const { supabase } = fakeSupabase({ checkins: [{ data: null, error: { code: "XX000", message: "boom" } }] });
    auth.get.mockResolvedValue({ supabase, userId: uid });
    expect((await GET(req())).status).toBe(500);
  });
});
