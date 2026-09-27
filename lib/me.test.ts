import { describe, expect, it } from "vitest";

import { MOCK_ME, parseGender } from "./me";

describe("parseGender", () => {
  it("三態原樣通過", () => {
    expect(parseGender("male")).toBe("male");
    expect(parseGender("female")).toBe("female");
    expect(parseGender("secret")).toBe("secret");
  });

  it("空／缺／非法一律回 secret（不替用戶定性別）", () => {
    expect(parseGender(null)).toBe("secret");
    expect(parseGender(undefined)).toBe("secret");
    expect(parseGender("")).toBe("secret");
    expect(parseGender("MALE")).toBe("secret");
    expect(parseGender(123)).toBe("secret");
  });

  it("MOCK 默認即 secret（占位口徑不變）", () => {
    expect(MOCK_ME.gender).toBe("secret");
    expect(parseGender(MOCK_ME.gender)).toBe("secret");
  });
});
