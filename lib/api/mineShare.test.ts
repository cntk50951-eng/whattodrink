import { describe, expect, it } from "vitest";

import { cleanShareQuery, compareNewestFirst, cutSharePage, parseMineShareParams, shareSearchFilter } from "./mineShare";

describe("share picker pagination helpers", () => {
  it("cleans search text so it cannot change the filter", () => {
    expect(cleanShareQuery(null)).toBeNull();
    expect(cleanShareQuery('  ,()*"\\%_ ')).toBeNull();
    expect(cleanShareQuery("St. Regis (中環)")).toBe("St. Regis 中環");
    expect(Array.from(cleanShareQuery("酒".repeat(60)) ?? "")).toHaveLength(24);
  });

  it("defaults to shareable, 20 per page", () => {
    expect(parseMineShareParams(new URLSearchParams())).toEqual({ scope: "shareable", limit: 20, cursor: null, q: null });
  });

  it("drops beer ids that are not plain identifiers", () => {
    expect(shareSearchFilter("ipa", ["a-1", "b),x"])).toBe('place_name.ilike."%ipa%",note.ilike."%ipa%",beer_id.in.(a-1)');
  });

  it("orders by microseconds within the same millisecond, then by id", () => {
    const a = { id: "a", created_at: "2026-11-20T10:00:00.123001+00:00" };
    const b = { id: "b", created_at: "2026-11-20T10:00:00.123002+00:00" };
    const c = { id: "c", created_at: "2026-11-20T10:00:00.123002+00:00" };
    const d = { id: "d", created_at: "2026-11-20T10:00:00+00:00" };
    expect([a, d, b, c].sort(compareNewestFirst).map((r) => r.id)).toEqual(["c", "b", "a", "d"]);
  });

  it("only returns a cursor when there is another row", () => {
    const rows = [{ id: "a", created_at: "2026-11-20T10:00:00+00:00" }];
    expect(cutSharePage(rows, 1).nextCursor).toBeNull();
    expect(cutSharePage([...rows, { id: "b", created_at: "2026-11-19T10:00:00+00:00" }], 1).nextCursor).toBe("2026-11-20T10:00:00+00:00|a");
  });
});
