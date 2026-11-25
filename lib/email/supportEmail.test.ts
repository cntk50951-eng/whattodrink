import { describe, expect, it, vi } from "vitest";

import { RESEND_ENDPOINT, buildReportEmail, sendSupportEmail } from "./supportEmail";

const input = {
  reportId: "abcdef12-3456-4789-8abc-def012345678",
  targetType: "post",
  reasonCode: "harassment",
  reasonText: "  他在留言罵人  ",
  targetName: "Chris",
  routeReason: "low_confidence" as const,
  score: 0.42,
  categories: [] as string[],
  siteUrl: "https://example.invalid/",
};

describe("buildReportEmail", () => {
  it("主旨與正文含案件、理由、分數、後台連結", () => {
    const m = buildReportEmail(input);
    expect(m.subject).toBe("[待人工審核] 帖子舉報・騷擾・abcdef12");
    expect(m.text).toContain("被舉報人：Chris");
    expect(m.text).toContain("補充：他在留言罵人");
    expect(m.text).toContain("轉人工原因：AI 置信度不足");
    expect(m.text).toContain("AI 分數：0.42");
    expect(m.text).toContain("https://example.invalid/innerharbour/user-reports/abcdef12-3456-4789-8abc-def012345678");
  });
  it("沒分數寫明 AI 未給分", () => {
    expect(buildReportEmail({ ...input, score: null }).text).toContain("AI 分數：無（AI 未給分）");
  });
});

describe("sendSupportEmail（Resend REST）", () => {
  it("POST /emails，帶 Bearer 與 Idempotency-Key，body 有 from/to/subject/text", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ id: "em_1" }), { status: 200 }));
    const r = await sendSupportEmail({ subject: "s", text: "t" }, { idempotencyKey: "report-human-1", apiKey: "re_x", to: "support@x.invalid", from: "A <a@x.invalid>", fetchFn });
    expect(r).toEqual({ ok: true, id: "em_1" });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(RESEND_ENDPOINT);
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer re_x");
    expect(headers["Idempotency-Key"]).toBe("report-human-1");
    expect(JSON.parse(String(init.body))).toEqual({ from: "A <a@x.invalid>", to: ["support@x.invalid"], subject: "s", text: "t" });
  });
  it("沒 key 不發請求、回失敗；非 2xx 回狀態碼；網路錯誤不拋", async () => {
    const fetchFn = vi.fn();
    expect((await sendSupportEmail({ subject: "s", text: "t" }, { idempotencyKey: "k", apiKey: "", fetchFn })).ok).toBe(false);
    expect(fetchFn).not.toHaveBeenCalled();
    const bad = vi.fn(async () => new Response(JSON.stringify({ name: "validation_error" }), { status: 403 }));
    expect(await sendSupportEmail({ subject: "s", text: "t" }, { idempotencyKey: "k", apiKey: "re_x", fetchFn: bad })).toMatchObject({ ok: false, status: 403 });
    const boom = vi.fn(async () => { throw new Error("offline"); });
    expect(await sendSupportEmail({ subject: "s", text: "t" }, { idempotencyKey: "k", apiKey: "re_x", fetchFn: boom })).toMatchObject({ ok: false, error: "offline" });
  });
});
