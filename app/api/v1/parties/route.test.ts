import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const server = vi.hoisted(() => ({ authed: vi.fn(), service: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getAuthedClient: server.authed, createServiceClient: server.service }));
// vitest 沒有 `@/` 別名：路由的 lib 依賴照倉內慣例用相對路徑接上；本測試用不到的整包替身
vi.mock("@/lib/api/envelope", () => import("../../../../lib/api/envelope"));
vi.mock("@/lib/api/compositeCursor", () => import("../../../../lib/api/compositeCursor"));
vi.mock("@/lib/api/blocks", () => import("../../../../lib/api/blocks"));
vi.mock("@/lib/api/partyExplore", () => import("../../../../lib/api/partyExplore"));
vi.mock("@/lib/api/party", () => ({
  countGenders: () => ({ male: 0, female: 0 }),
  cancelPolicy: () => ({}),
  leavePolicy: () => ({}),
  mineOrCondition: (id: string) => `host_user_id.eq.${id}`,
}));
vi.mock("@/lib/api/cheers", () => ({}));
vi.mock("@/lib/api/clientRequestId", () => ({}));
vi.mock("@/lib/trust/ledger", () => ({ hostTrustMap: async () => new Map(), readTrust: vi.fn() }));
vi.mock("@/lib/trust/config", () => ({ TRUST_CONFIG: {} }));
vi.mock("@/lib/moderation", () => ({}));
vi.mock("@/lib/geo", () => ({ haversineMeters: () => 0 }));
vi.mock("@/lib/mode", () => ({}));

const me = "99999999-9999-4999-8999-999999999999";
const uuid = (n: number) => `00000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`;
const blockedHost = uuid(90);
const HOUR = 3600_000;
const iso = (offsetHours: number) => new Date(Date.now() + offsetHours * HOUR).toISOString();
const party = (n: number, startOffset: number, extra: Record<string, unknown> = {}) => ({
  id: uuid(n), host_user_id: uuid(50 + n), place: `bar ${n}`, city: "", lat: 22.3, lng: 114.1,
  start_at: iso(startOffset), expires_at: iso(startOffset + 3), created_at: iso(-100 + n), status: "open",
  seats_total: 4, seats_male: 0, seats_female: 0, min_members: 2, bill_intent: "aa", purposes: [], ...extra,
});

type Row = Record<string, unknown>;
/** 假查詢：真的套用篩選、排序、限頁（`or` 只認本路由用到的 keyset 寫法） */
function database(tables: Record<string, Row[]>, failing: string[] = []) {
  const from = (table: string) => {
    const filters: ((r: Row) => boolean)[] = [];
    const orders: [string, boolean][] = [];
    let max = 1000;
    const text = (r: Row, k: string) => String(r[k]);
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), chain),
      gt: (k: string, v: string) => (filters.push((r) => text(r, k) > v), chain),
      gte: (k: string, v: string) => (filters.push((r) => text(r, k) >= v), chain),
      lt: (k: string, v: string) => (filters.push((r) => text(r, k) < v), chain),
      lte: (k: string, v: string) => (filters.push((r) => text(r, k) <= v), chain),
      in: (k: string, v: unknown[]) => (filters.push((r) => v.includes(r[k])), chain),
      not: (k: string, _op: string, list: string) => (filters.push((r) => !list.slice(1, -1).split(",").includes(text(r, k))), chain),
      or: (expr: string) => {
        const keyset = expr.match(/^start_at\.(gt|lt)\.(.+?),and\(start_at\.eq\..+?,id\.(?:gt|lt)\.(.+)\)$/);
        if (keyset) {
          const [, op, at, id] = keyset;
          const beyond = (a: string, b: string) => (op === "gt" ? a > b : a < b);
          filters.push((r) => beyond(text(r, "start_at"), at) || (text(r, "start_at") === at && beyond(text(r, "id"), id)));
        }
        return chain;
      },
      order: (k: string, o: { ascending: boolean }) => (orders.push([k, o.ascending]), chain),
      limit: (n: number) => ((max = n), chain),
      then: (resolve: (v: unknown) => unknown) => {
        if (failing.includes(table)) return Promise.resolve({ data: null, error: { code: "unit" } }).then(resolve);
        const rows = (tables[table] ?? []).filter((r) => filters.every((f) => f(r))).sort((a, b) => {
          for (const [k, asc] of orders) {
            const d = text(a, k).localeCompare(text(b, k));
            if (d !== 0) return asc ? d : -d;
          }
          return 0;
        });
        return Promise.resolve({ data: rows.slice(0, max), error: null }).then(resolve);
      },
    };
    return chain;
  };
  return { from };
}

function setup(viewer: string | null, extra: Record<string, Row[]> = {}, failing: string[] = []) {
  const tables: Record<string, Row[]> = {
    parties: [
      party(1, 5), party(2, 1), party(3, -1), // 未結束：3 進行中、2 與 1 未開始
      party(4, -10), party(5, -30), party(6, -80), // 已結束
      party(7, -20, { status: "cancelled" }), party(8, 2, { status: "cancelled" }),
      party(9, -12, { host_user_id: blockedHost }),
    ],
    joins: [], users: [], party_attendance: [], party_hides: [],
    cheers_blocks: [{ blocker_id: me, blocked_id: blockedHost }],
    ...extra,
  };
  const db = database(tables, failing);
  server.authed.mockResolvedValue({ supabase: db, userId: viewer });
  server.service.mockResolvedValue(db);
}
async function list(params: Record<string, string>) {
  const res = await GET(new Request(`http://localhost/api/v1/parties?${new URLSearchParams(params)}`));
  const body = (await res.json()) as { items?: { id: string }[]; next_cursor?: string | null };
  return { status: res.status, ids: (body.items ?? []).map((i) => i.id), next: body.next_cursor ?? null };
}
const ids = (...n: number[]) => n.map(uuid);

describe("UR E.34 party explore list", () => {
  beforeEach(() => vi.resetAllMocks());

  it("keeps the default list unchanged: open and unexpired, newest created first", async () => {
    setup(me);
    expect((await list({})).ids).toEqual(ids(3, 2, 1));
  });
  it("pages active parties by start time and never repeats or skips", async () => {
    setup(me);
    const first = await list({ view: "explore", phase: "active", limit: "2" });
    expect(first.ids).toEqual(ids(3, 2));
    const second = await list({ view: "explore", phase: "active", limit: "2", cursor: first.next as string });
    expect(second.ids).toEqual(ids(1));
    expect(second.next).toBeNull();
  });
  it("pages ended parties newest first, without cancelled or blocked hosts", async () => {
    setup(me);
    const first = await list({ view: "explore", phase: "ended", limit: "2" });
    expect(first.ids).toEqual(ids(4, 5));
    expect((await list({ view: "explore", phase: "ended", limit: "2", cursor: first.next as string })).ids).toEqual(ids(6));
  });
  it("limits to the requested start window", async () => {
    setup(me);
    expect((await list({ view: "explore", phase: "ended", from: iso(-40), to: iso(-11) })).ids).toEqual(ids(5));
  });
  it("does not bring back parties the viewer deleted", async () => {
    setup(me, { party_hides: [{ user_id: me, party_id: uuid(4) }] });
    expect((await list({ view: "explore", phase: "ended" })).ids).toEqual(ids(5, 6));
  });
  it("requires sign in for ended parties but lets guests browse active ones", async () => {
    setup(null);
    expect((await list({ view: "explore", phase: "ended" })).status).toBe(401);
    expect((await list({ view: "explore", phase: "active" })).ids).toEqual(ids(3, 2, 1));
  });
  it("refuses to answer when blocks cannot be checked", async () => {
    setup(me, {}, ["cheers_blocks"]);
    expect((await list({ view: "explore", phase: "ended" })).status).toBe(503);
  });
  it("rejects bad explore parameters", async () => {
    setup(me);
    expect((await list({ view: "explore" })).status).toBe(400);
  });
});
