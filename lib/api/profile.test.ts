import { describe, expect, it } from "vitest";

import { ageOf, avatarPublicUrl, parseProfileBody, shouldOnboard } from "./profile";

describe("ageOf", () => {
  // 2026-10-04（UTC）为锚。
  const NOW = Date.parse("2026-10-04T00:00:00Z");
  it("足岁（生日过即＋1，不过即‑1）", () => {
    expect(ageOf("2000-10-03", NOW)).toBe(26);
    expect(ageOf("2000-10-04", NOW)).toBe(26);
    expect(ageOf("2000-10-05", NOW)).toBe(25);
  });
  it("未来／异形／太老回 null（不编岁数）", () => {
    expect(ageOf("2030-01-01", NOW)).toBeNull();
    expect(ageOf("1899-12-31", NOW)).toBeNull();
    expect(ageOf("not-a-date", NOW)).toBeNull();
    expect(ageOf(null, NOW)).toBeNull();
  });
});

describe("parseProfileBody", () => {
  it("四段全可选；性别只收男女", () => {
    expect(parseProfileBody({ gender: "male", dob: "2000-01-01", bio: " hi ", avatar_url: null })).toEqual({
      gender: "male",
      dob: "2000-01-01",
      bio: "hi",
      avatar_url: null,
    });
    expect(parseProfileBody({})).toEqual({});
  });
  it("非法拒（secret／异 dob／bio 截断／外桶头像；Google 头像放行）", () => {
    expect(parseProfileBody({ gender: "secret" })).toHaveProperty("error");
    expect(parseProfileBody({ dob: "01-01-2000" })).toHaveProperty("error");
    expect(parseProfileBody({ dob: "1800-01-01" })).toHaveProperty("error");
    const over = parseProfileBody({ bio: "x".repeat(200) });
    if ("error" in over) throw new Error("bio 应截断不断言");
    expect(over.bio?.length).toBe(140);
    expect(parseProfileBody({ avatar_url: "https://x.test/other/a.jpg" })).toHaveProperty("error");
    expect(parseProfileBody({ avatar_url: "https://lh3.googleusercontent.com/a/abc=s96-c" })).not.toHaveProperty(
      "error",
    );
    expect(parseProfileBody({ dob: "2020-01-01" })).toEqual({ error: "AGE_RESTRICTED" });
  });
});

describe("shouldOnboard", () => {
  const NOW = Date.parse("2026-10-04T00:00:00Z");
  it("打戳即不再弹；空戳＋7 天内新号弹；老号不扰", () => {
    expect(shouldOnboard("2026-10-01T00:00:00Z", "2026-10-01T00:00:00Z", NOW)).toBe(false);
    expect(shouldOnboard(null, "2026-10-03T00:00:00Z", NOW)).toBe(true);
    expect(shouldOnboard(null, "2026-09-01T00:00:00Z", NOW)).toBe(false);
  });
});

describe("avatarPublicUrl", () => {
  it("公開桶直拼（尾斜杠容錯）", () => {
    expect(avatarPublicUrl("https://x.supabase.co/", "avatars", "u/a.jpg")).toBe(
      "https://x.supabase.co/storage/v1/object/public/avatars/u/a.jpg",
    );
  });
});
