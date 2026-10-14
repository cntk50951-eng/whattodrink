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

import { appellantRole } from "./complaintAppeal";

describe("appellantRole", () => {
  it("pending / maintained: the adverse party appealed", () => {
    expect(appellantRole("uphold", "pending")).toBe("target");
    expect(appellantRole("dismiss", "pending")).toBe("filer");
    expect(appellantRole("malicious", "dismissed")).toBe("filer");
  });
  it("revised: appellant is now the favoured party", () => {
    expect(appellantRole("dismiss", "upheld")).toBe("target"); // 原判成立→被投訴人申訴→改判駁回
    expect(appellantRole("uphold", "upheld")).toBe("filer"); // 原判駁回→投訴人申訴→改判成立
  });
  it("no appeal / no decision → null", () => {
    expect(appellantRole("uphold", null)).toBeNull();
    expect(appellantRole(null, "pending")).toBeNull();
  });
});
