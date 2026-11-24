import { describe, expect, it } from "vitest";

import { IVY_REPORT_REPLY_MAX, IVY_REPORT_USER_TEXT_MAX, parseIvyReport } from "./barReport";

describe("parseIvyReport", () => {
  it("完整輸入原樣通過（去首尾空白）", () => {
    expect(
      parseIvyReport({ reply_text: "  hello  ", user_text: " hi ", reason: "sexual", lang: "yue", platform: "aos" }),
    ).toEqual({ replyText: "hello", userText: "hi", reason: "sexual", lang: "yue", platform: "aos" });
  });

  it("只有 reply_text：reason 缺省 other、lang 缺省 en、platform 缺省 unknown", () => {
    expect(parseIvyReport({ reply_text: "x" })).toEqual({
      replyText: "x",
      userText: "",
      reason: "other",
      lang: "en",
      platform: "unknown",
    });
  });

  it("非法 reason／platform 回落，不拋錯", () => {
    const r = parseIvyReport({ reply_text: "x", reason: "<script>", platform: "web" });
    expect(r?.reason).toBe("other");
    expect(r?.platform).toBe("unknown");
  });

  it("缺 reply_text、空白、非字串、非物件一律 null", () => {
    expect(parseIvyReport({})).toBeNull();
    expect(parseIvyReport({ reply_text: "   " })).toBeNull();
    expect(parseIvyReport({ reply_text: 5 })).toBeNull();
    expect(parseIvyReport(null)).toBeNull();
    expect(parseIvyReport("x")).toBeNull();
  });

  it("超長文字被截斷到上限", () => {
    const r = parseIvyReport({ reply_text: "a".repeat(5000), user_text: "b".repeat(5000) });
    expect(r?.replyText.length).toBe(IVY_REPORT_REPLY_MAX);
    expect(r?.userText.length).toBe(IVY_REPORT_USER_TEXT_MAX);
  });
});
