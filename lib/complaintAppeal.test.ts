import { describe, expect, it } from "vitest";
import { isAdverseParty } from "./complaintAppeal";

describe("isAdverseParty", () => {
  it("upheld: only target may appeal", () => {
    expect(isAdverseParty("upheld", false, true)).toBe(true);
    expect(isAdverseParty("upheld", true, false)).toBe(false);
  });
  it("dismissed/malicious: only filer may appeal", () => {
    for (const s of ["dismissed", "malicious"]) {
      expect(isAdverseParty(s, true, false)).toBe(true);
      expect(isAdverseParty(s, false, true)).toBe(false);
    }
  });
  it("undecided: nobody", () => {
    expect(isAdverseParty("escalated", true, false)).toBe(false);
  });
});
