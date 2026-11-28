import { describe, expect, it } from "vitest";
import { exploreCursorFilter, exploreFetchLimit, explorePage, parseExploreParams, partyMemberAccess } from "./partyExplore";

const id = "11111111-1111-4111-8111-111111111111";
const params = (q: string) => parseExploreParams(new URLSearchParams(q));

describe("UR E.34 parseExploreParams", () => {
  it("leaves the default list alone when view is absent or unknown", () => {
    expect(params("limit=30")).toBeNull();
    expect(params("view=other&phase=ended")).toBeNull();
  });
  it("requires a known phase and well formed window and cursor", () => {
    for (const q of ["view=explore", "view=explore&phase=all", "view=explore&phase=ended&from=nope", "view=explore&phase=ended&cursor=abc",
      "view=explore&phase=ended&from=2026-11-28T00:00:00Z&to=2026-11-27T00:00:00Z"]) expect(params(q)).toHaveProperty("error");
  });
  it("normalizes the window and accepts a start_at cursor", () => {
    const q = new URLSearchParams({ view: "explore", phase: "ended", from: "2026-11-25T00:00:00+08:00", to: "2026-11-29T00:00:00+08:00", cursor: `2026-11-27T10:00:00+00:00|${id}` });
    expect(parseExploreParams(q)).toEqual({ phase: "ended", from: "2026-11-24T16:00:00.000Z", to: "2026-11-28T16:00:00.000Z", cursor: { startAt: "2026-11-27T10:00:00+00:00", id } });
  });
  it("pages forward for active and backward for ended", () => {
    const c = { startAt: "2026-11-27T10:00:00+00:00", id };
    expect(exploreCursorFilter("active", c)).toBe(`start_at.gt.${c.startAt},and(start_at.eq.${c.startAt},id.gt.${id})`);
    expect(exploreCursorFilter("ended", c)).toBe(`start_at.lt.${c.startAt},and(start_at.eq.${c.startAt},id.lt.${id})`);
  });
});

describe("UR E.34 explorePage", () => {
  const row = (n: number, host = "h") => ({ id: `p${n}`, host_user_id: host, start_at: `2026-11-2${n}T00:00:00+00:00` });
  const none = { excludedHosts: new Set<string>(), excludedParties: new Set<string>() };
  it("returns a cursor only when another row exists", () => {
    const fetchLimit = exploreFetchLimit(2, 0);
    expect(fetchLimit).toBe(3);
    expect(explorePage([row(1), row(2), row(3)], { limit: 2, fetchLimit, ...none })).toEqual({ list: [row(1), row(2)], next_cursor: "2026-11-22T00:00:00+00:00|p2" });
    expect(explorePage([row(1), row(2)], { limit: 2, fetchLimit, ...none })).toEqual({ list: [row(1), row(2)], next_cursor: null });
    expect(explorePage([], { limit: 2, fetchLimit, ...none }).next_cursor).toBeNull();
  });
  it("keeps paging when filtering in memory empties a full batch", () => {
    const excluded = { excludedHosts: new Set(["blocked"]), excludedParties: new Set<string>() };
    const rows = [row(1, "blocked"), row(2, "blocked"), row(3, "blocked")];
    expect(explorePage(rows, { limit: 1, fetchLimit: 3, ...excluded })).toEqual({ list: [], next_cursor: "2026-11-23T00:00:00+00:00|p3" });
  });
});

describe("UR E.34 partyMemberAccess", () => {
  const base = { status: "open", expiresAtMs: 1000, viewerId: "me", isMember: false, nowMs: 2000 };
  it("limits only normally ended parties", () => {
    expect(partyMemberAccess(base)).toBe("host_only");
    expect(partyMemberAccess({ ...base, isMember: true })).toBe("all");
    expect(partyMemberAccess({ ...base, viewerId: null })).toBe("login");
    expect(partyMemberAccess({ ...base, expiresAtMs: 3000, viewerId: null })).toBe("all");
    expect(partyMemberAccess({ ...base, status: "cancelled", viewerId: null })).toBe("all");
  });
});
