import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";
import { POST as PLAN } from "../../search/plan/route";

const server = vi.hoisted(() => ({ authed: vi.fn(), service: vi.fn(), llm: vi.fn(), moderate: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getAuthedClient: server.authed, createServiceClient: server.service }));
vi.mock("@/lib/minimax", () => ({ minimaxChat: server.llm }));
vi.mock("@/lib/moderation", () => ({ moderateCheckin: server.moderate, moderationAction: () => "allow" }));
vi.mock("@/lib/searchQueryGuard", () => ({ matchBlockedSearchTerm: () => null }));
// vitest 沒有 `@/` 別名：用到的 lib 以相對路徑接上
vi.mock("@/lib/api/envelope", () => import("../../../../../lib/api/envelope"));
vi.mock("@/lib/api/userRead", () => import("../../../../../lib/api/userRead"));
vi.mock("@/lib/api/blocks", () => import("../../../../../lib/api/blocks"));
vi.mock("@/lib/api/cheers", () => ({ isMinorDob: (d: string) => d > "2010" }));
vi.mock("@/lib/api/profile", () => import("../../../../../lib/api/profile"));
vi.mock("@/lib/api/taste", () => import("../../../../../lib/api/taste"));
vi.mock("@/lib/geo", () => ({ haversineMeters: () => 0 }));
vi.mock("@/lib/meet", () => import("../../../../../lib/meet"));
vi.mock("@/lib/meetSuggestions", () => ({ pickSuggestionLang: () => "zh-Hant" }));
vi.mock("@/lib/searchPlan", () => import("../../../../../lib/searchPlan"));
vi.mock("@/lib/api/party", () => ({ hkDayStartISO: () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10) }));

type Row = Record<string, unknown>;
const me = "11111111-1111-4111-8111-111111111111";
const person = (id: string, nickname: string, extra: Row = {}) => ({
  id, nickname, gender: "female", dob: "1998-01-01", discoverable: true, mode: "public", interests: [], languages: [],
  info_visibility: { interests: "public" }, preferences: null, last_seen_at: null, ...extra,
});

function setup(opts: { users: Row[]; emailTarget?: string | null; used?: number; failRead?: string }) {
  const writes: Row[] = [];
  const rpc = vi.fn(async () => ({ data: { allowed: true, user_id: opts.emailTarget ?? null }, error: null }));
  const today = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
  const mine = { id: me, gender: "male", dob: "1990-01-01", meet_search_date: today, meet_search_count: opts.used ?? 0 };
  const from = (table: string) => {
    const filters: ((r: Row) => boolean)[] = [];
    const chain: Record<string, unknown> = {};
    const rows = () => (table === "users" ? [mine as Row, ...opts.users] : []).filter((r) => filters.every((f) => f(r)));
    let columns = "";
    for (const k of ["or", "order", "limit"]) chain[k] = () => chain;
    chain.select = (c: string) => ((columns = c), chain);
    chain.eq = (k: string, v: unknown) => (filters.push((r) => r[k] === v), chain);
    chain.neq = (k: string, v: unknown) => (filters.push((r) => r[k] !== v), chain);
    chain.in = (k: string, v: unknown[]) => (filters.push((r) => v.includes(r[k])), chain);
    chain.ilike = (k: string, p: string) => (filters.push((r) => String(r[k]).toLowerCase().includes(p.slice(1, -1).toLowerCase())), chain);
    chain.maybeSingle = async () =>
      table === "users" && columns === opts.failRead ? { data: null, error: { code: "unit" } } : { data: rows()[0] ?? null, error: null };
    chain.update = (v: Row) => (writes.push(v), { eq: async () => ({ error: null }) });
    chain.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: rows(), error: null }).then(res);
    return chain;
  };
  const db = { from, rpc };
  server.authed.mockResolvedValue({ supabase: db, userId: me });
  server.service.mockResolvedValue(db);
  return { rpc, writes };
}
const call = async (handler: typeof POST, body: unknown) => {
  const res = await handler(new Request("http://localhost/x", { method: "POST", body: JSON.stringify(body) }));
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
};
const results = (b: Record<string, unknown>) => (b.results as { nickname: string; score: number }[]).map((r) => [r.nickname, r.score]);

describe("UR I.4 meet search", () => {
  beforeEach(() => vi.resetAllMocks());

  it("nickname search: exact name first and matched people are not 0%", async () => {
    setup({ users: [person("a", "Big chris"), person("b", "chris"), person("c", "Chris Wong"), person("d", "May")] });
    const out = await call(POST, { criteria: { nickname: "chris" } });
    expect(results(out.body)).toEqual([["chris", 100], ["Chris Wong", 100], ["Big chris", 100]]);
  });
  it("drops people who match none of the asked preferences", async () => {
    setup({ users: [person("a", "hiker", { interests: ["hiking"] }), person("b", "nobody")] });
    const out = await call(POST, { criteria: { interests: ["hiking"] } });
    expect(results(out.body)).toEqual([["hiker", 100]]);
  });
  it("email: found without stats, costs one search, never reaches moderation or the model", async () => {
    const { rpc, writes } = setup({ users: [person("a", "chris", { discoverable: false })], emailTarget: "a", used: 3 });
    const out = await call(POST, { query: "找 Chris@Example.com" });
    expect(results(out.body)).toEqual([["chris", 100]]);
    expect(out.body.stats).toBeUndefined();
    expect(JSON.stringify(out.body.results)).not.toContain("@");
    expect(rpc).toHaveBeenCalledWith("meet_lookup_by_email", expect.objectContaining({ p_email: "chris@example.com", p_limit: 10 }));
    expect(writes).toEqual([expect.objectContaining({ meet_search_count: 4 })]);
    expect(server.llm).not.toHaveBeenCalled();
    expect(server.moderate).not.toHaveBeenCalled();
  });
  it("email: unknown, not opted in and stealth look the same", async () => {
    const ask = async (users: Row[], emailTarget: string | null) => {
      setup({ users, emailTarget });
      const { body } = await call(POST, { criteria: { email: "x@example.com" } });
      const same: Record<string, unknown> = { ...body, remaining_today: 0 };
      return same;
    };
    const unknown = await ask([], null);
    expect(await ask([person("a", "s", { mode: "stealth" })], "a")).toEqual(unknown);
    expect(await ask([person("a", "kid", { dob: "2012-01-01" })], "a")).toEqual(unknown);
    expect(unknown.stats).toBeUndefined();
    expect(unknown.relaxed).toBeUndefined();
  });
  it("email: refused once the daily searches are used up, without looking", async () => {
    const { rpc } = setup({ users: [], used: 10 });
    expect((await call(POST, { criteria: { email: "x@example.com" } })).status).toBe(429);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("plan: a query with an email stays on the server", async () => {
    const { writes } = setup({ users: [], used: 2 });
    const out = await call(PLAN, { query: "搵 x@example.com" });
    expect(out.body).toEqual({ intents: [{ type: "people", criteria: { email: "x@example.com" } }], ignored: [], remaining_today: 7 });
    expect(writes).toEqual([]);
    expect(server.llm).not.toHaveBeenCalled();
    expect(server.moderate).not.toHaveBeenCalled();
  });
  it("refuses instead of granting free searches when the daily count cannot be read", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const count = "meet_search_date,meet_search_count";
    const { rpc } = setup({ users: [], failRead: count });
    expect((await call(PLAN, { query: "搵 x@example.com" })).status).toBe(503);
    expect((await call(POST, { criteria: { email: "x@example.com" } })).status).toBe(503);
    expect(rpc).not.toHaveBeenCalled();
  });
});
