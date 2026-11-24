import { describe, expect, it } from "vitest";

import { blockedIdsFromRows } from "./blocks";

describe("blockedIdsFromRows", () => {
  it("extracts peer user ids bidirectionally", () => {
    const out = blockedIdsFromRows("u1", [
      { blocker_id: "u1", blocked_id: "u2" },
      { blocker_id: "u3", blocked_id: "u1" },
      { blocker_id: "u4", blocked_id: "u5" },
      { blocker_id: "u1", blocked_id: "" },
    ]);
    expect([...out].sort()).toEqual(["u2", "u3"]);
  });

  it("returns empty set for empty viewerId", () => {
    expect(blockedIdsFromRows("", [{ blocker_id: "u1", blocked_id: "u2" }]).size).toBe(0);
  });
});
