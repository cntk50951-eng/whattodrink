import { describe, expect, it, vi } from "vitest";

import {
  buildUserProfileModerationText,
  collectPostImageDataUrls,
  extractChatImagePaths,
  parseMinimaxReportScore,
  REPORT_AUTO_ACTION_MIN,
  REPORT_AUTO_DISMISS_MAX,
  reportedTextFromSnapshot,
  routeReport,
  scoreReportWithMinimax,
} from "./reportTriage";

const minimax = (flagged: boolean, score: number) =>
  flagged
    ? ({ flagged: true as const, categories: ["harassment"], via: "minimax" as const, score })
    : ({ flagged: false as const, via: "minimax" as const, score });

describe("routeReport 置信度分流（DEF-20261125-020〜024）", () => {
  it("分數 ≥ 0.85 → 自動處分（MiniMax 給分）", () => {
    const r = routeReport({ reasonCode: "harassment", verdict: minimax(true, REPORT_AUTO_ACTION_MIN) });
    expect(r).toMatchObject({ decision: "auto_actioned", reason: "high_confidence", score: 0.85, categories: ["harassment"] });
  });
  it("未標記且分數 ≤ 0.10 → 自動結案（MiniMax 給分）", () => {
    expect(routeReport({ reasonCode: "inappropriate", verdict: minimax(false, REPORT_AUTO_DISMISS_MAX) }).decision).toBe("auto_dismissed");
  });
  it("中間分數 → 人工（low_confidence）", () => {
    expect(routeReport({ reasonCode: null, verdict: minimax(false, 0.4) })).toMatchObject({ decision: "human", reason: "low_confidence", score: 0.4 });
    // 被標記但分數不到門檻：也不自動處分
    expect(routeReport({ reasonCode: null, verdict: minimax(true, 0.6) }).decision).toBe("human");
  });
  it("spam 也納入 AI 可判理由；underage／other 一律人工", () => {
    expect(routeReport({ reasonCode: "spam", verdict: minimax(true, 0.92) }).decision).toBe("auto_actioned");
    expect(routeReport({ reasonCode: "spam", verdict: minimax(false, 0.04) }).decision).toBe("auto_dismissed");
    for (const code of ["underage", "other"]) {
      expect(routeReport({ reasonCode: code, verdict: minimax(false, 0.01) })).toMatchObject({ decision: "human", reason: "reason_needs_human" });
    }
  });
  it("AI 不可用／沒內容／無分數回包 → 人工", () => {
    expect(routeReport({ reasonCode: null, verdict: null }).reason).toBe("ai_unavailable");
    expect(routeReport({ reasonCode: null, verdict: { flagged: false, skipped: true, reason: "no-input" } }).reason).toBe("no_content");
    expect(routeReport({ reasonCode: null, verdict: { flagged: false, skipped: true, reason: "all-failed" } }).reason).toBe("ai_unavailable");
    expect(routeReport({ reasonCode: null, verdict: { flagged: true, categories: ["minimax:porn"], via: "minimax" } })).toMatchObject({ decision: "human", reason: "ai_unavailable" });
  });
});

describe("parseMinimaxReportScore & scoreReportWithMinimax（與 Ivy Bar 同源 MiniMax-M3）", () => {
  it("解析純 JSON 與 markdown 圍欄 JSON，分數鉗在 0..1", () => {
    expect(parseMinimaxReportScore('{"flagged":true,"score":0.92,"categories":["Harassment"]}')).toEqual({
      flagged: true,
      score: 0.92,
      categories: ["harassment"],
    });
    expect(parseMinimaxReportScore('```json\n{"flagged":false,"score":0.03,"categories":[]}\n```')).toEqual({
      flagged: false,
      score: 0.03,
      categories: [],
    });
    expect(parseMinimaxReportScore("not json")).toBeNull();
  });

  it("缺內容或缺 key 跳過零請求", async () => {
    const fetchFn = vi.fn();
    expect(await scoreReportWithMinimax({}, { apiKey: "k", fetchFn: fetchFn as never })).toEqual({
      flagged: false, skipped: true, reason: "no-input",
    });
    expect(await scoreReportWithMinimax({ text: "hello" }, { apiKey: "", fetchFn: fetchFn as never })).toEqual({
      flagged: false, skipped: true, reason: "no-keys",
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("正常調用 api.minimaxi.com MiniMax-M3 並回傳分數", async () => {
    let calledUrl = "";
    let calledModel = "";
    const fetchFn = vi.fn(async (url: unknown, init?: RequestInit) => {
      calledUrl = String(url);
      calledModel = (JSON.parse(String(init?.body ?? "{}")) as { model?: string }).model ?? "";
      return new Response(JSON.stringify({
        base_resp: { status_code: 0 },
        choices: [{ message: { content: '{"flagged":false,"score":0.04,"categories":[]}' } }],
      }), { status: 200 });
    });
    const r = await scoreReportWithMinimax(
      { text: "中環飲杯 IPA 好正" },
      { apiKey: "mk", reasonCode: "harassment", fetchFn: fetchFn as never },
    );
    expect(calledUrl).toBe("https://api.minimaxi.com/v1/chat/completions");
    expect(calledModel).toBe("MiniMax-M3");
    expect(r).toEqual({ flagged: false, via: "minimax", score: 0.04 });
  });

  it("命中平台 input_sensitive 直接高置信違規（score=0.95）", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ input_sensitive: true, input_sensitive_type: 5 }), { status: 200 }));
    const r = await scoreReportWithMinimax({ text: "x" }, { apiKey: "mk", fetchFn: fetchFn as never });
    expect(r).toEqual({ flagged: true, categories: ["minimax:abusive"], via: "minimax", score: 0.95 });
  });

  it("格式壞或 502 會重試一次，兩次全敗回 all-failed", async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "oops" } }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: '{"flagged":true,"score":0.91,"categories":["harassment"]}' } }],
      }), { status: 200 }));
    const ok = await scoreReportWithMinimax({ text: "罵人" }, { apiKey: "mk", fetchFn: fetchFn as never });
    expect(ok).toEqual({ flagged: true, categories: ["harassment"], via: "minimax", score: 0.91 });
    expect(fetchFn).toHaveBeenCalledTimes(2);

    const failFetch = vi.fn(async () => new Response("{}", { status: 502 }));
    const bad = await scoreReportWithMinimax({ text: "x" }, { apiKey: "mk", fetchFn: failFetch as never });
    expect(bad).toMatchObject({ flagged: false, skipped: true, reason: "all-failed" });
  });
});

describe("reportedTextFromSnapshot 與多媒體／檔案輔助函數", () => {
  it("只取被舉報人說的話", () => {
    const snap = [
      { who: "reporter", kind: "text", text: "你好", at: null },
      { who: "reported", kind: "text", text: "  罵人的話 ", at: null },
      { who: "other", kind: "text", text: "旁人", at: null },
      { who: "reported", kind: "image", text: "", at: null },
    ];
    expect(reportedTextFromSnapshot(snap)).toBe("罵人的話");
    expect(reportedTextFromSnapshot(null)).toBe("");
  });

  it("collectPostImageDataUrls 去重、過濾非 data:image/ 並上限 4 張", () => {
    const a = "data:image/jpeg;base64,AAA";
    const b = "data:image/png;base64,BBB";
    const c = "data:image/webp;base64,CCC";
    const d = "data:image/jpeg;base64,DDD";
    const e = "data:image/jpeg;base64,EEE";
    expect(collectPostImageDataUrls({ photo_url: a, photo_urls: [a, "https://bad.example/x.jpg", b, c, d, e] })).toEqual([a, b, c, d]);
    expect(collectPostImageDataUrls({ photo_url: b, photo_urls: null })).toEqual([b]);
  });

  it("extractChatImagePaths 只收被舉報人的有效 chat-images 路徑，攔路徑穿越", () => {
    const paths = extractChatImagePaths([
      { sender_id: "u2", kind: "image", attachments: [{ bucket: "chat-images", path: "u2/a.jpg" }] },
      { sender_id: "u1", kind: "image", attachments: [{ bucket: "chat-images", path: "u1/mine.jpg" }] },
      { sender_id: "u2", kind: "image", attachments: [{ bucket: "chat-images", path: "../secret/x.jpg" }, { bucket: "chat-voice", path: "u2/v.m4a" }] },
      { sender_id: "u2", kind: "image", attachments: [{ bucket: "chat-images", path: "u2/a.jpg" }, { bucket: "chat-images", path: "u2/b.png" }] },
    ], "u2");
    expect(paths).toEqual(["u2/a.jpg", "u2/b.png"]);
  });

  it("buildUserProfileModerationText 組裝暱稱與簡介", () => {
    expect(buildUserProfileModerationText({ nickname: "  酒鬼小王 ", bio: "加微信買幣" })).toBe("用戶暱稱：酒鬼小王\n個人簡介：加微信買幣");
    expect(buildUserProfileModerationText({ nickname: " ", bio: null })).toBe("");
  });
});
