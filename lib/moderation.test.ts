import { describe, expect, it, vi } from "vitest";

import {
  moderateCheckin,
  moderateContent,
  moderateWithMinimax,
  moderationAction,
} from "./moderation";

function stubFetch(json: unknown, ok = true): typeof fetch {
  return vi.fn(async () =>
    new Response(JSON.stringify(json), { status: ok ? 200 : 429 }),
  ) as unknown as typeof fetch;
}

describe("moderation (UR E.2)", () => {
  it("空輸入零請求直接放行", async () => {
    const fn = stubFetch({});
    const v = await moderateContent({}, { apiKey: "k", fetchFn: fn });
    expect(v).toEqual({ flagged: false, categories: [] });
    expect(fn).not.toHaveBeenCalled();
  });
  it("乾淨回 flagged=false", async () => {
    const fn = stubFetch({
      results: [{ flagged: false, categories: { violence: false } }],
    });
    const v = await moderateContent(
      { text: "今晚第一杯", imageDataUrl: "data:image/jpeg;base64,/9j/" },
      { apiKey: "k", fetchFn: fn },
    );
    expect(v.flagged).toBe(false);
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it("命中回類別", async () => {
    const fn = stubFetch({
      results: [{ flagged: true, categories: { violence: true, sexual: false } }],
    });
    const v = await moderateContent({ text: "x" }, { apiKey: "k", fetchFn: fn });
    expect(v).toEqual({ flagged: true, categories: ["violence"] });
  });
  it("vendor 錯拋給調用方（路由定放行＋warn）", async () => {
    const fn = stubFetch({}, false);
    await expect(
      moderateContent({ text: "x" }, { apiKey: "k", fetchFn: fn }),
    ).rejects.toThrow("moderation 429");
  });
});

describe("moderateWithMinimax (UR E.2 兜底)", () => {
  it("input_sensitive=false 即放行", async () => {
    const fn = stubFetch({ input_sensitive: false });
    const v = await moderateWithMinimax({ text: "今晚第一杯" }, { apiKey: "k", fetchFn: fn });
    expect(v).toEqual({ flagged: false, categories: [] });
  });
  it("input_sensitive=true 回平台類別", async () => {
    const fn = stubFetch({ input_sensitive: true, input_sensitive_type: 2 });
    const v = await moderateWithMinimax({ text: "x" }, { apiKey: "k", fetchFn: fn });
    expect(v).toEqual({ flagged: true, categories: ["minimax:porn"] });
  });
  it("空輸入零請求", async () => {
    const fn = stubFetch({});
    await moderateWithMinimax({}, { apiKey: "k", fetchFn: fn });
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("moderateCheckin 編排 (UR E.2)", () => {
  const flagged = stubFetch({ results: [{ flagged: true, categories: { violence: true } }] });
  const mmClean = stubFetch({ input_sensitive: false });
  const mmFlag = stubFetch({ input_sensitive: true, input_sensitive_type: 5 });
  const boom = stubFetch({}, false);
  it("無輸入／無 key 即跳過（帶 reason）", async () => {
    expect(await moderateCheckin({}, {})).toEqual({ flagged: false, skipped: true, reason: "no-input" });
    expect(await moderateCheckin({ text: "x" }, {})).toEqual({ flagged: false, skipped: true, reason: "no-keys" });
  });
  it("主審乾淨即停（兜底零調用）", async () => {
    const hit: string[] = [];
    const router = vi.fn(async (url: unknown) => {
      hit.push(String(url));
      return new Response(
        JSON.stringify({ results: [{ flagged: false, categories: {} }] }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;
    const v = await moderateCheckin(
      { text: "ok" },
      { openaiKey: "k", minimaxKey: "m", fetchFn: router },
    );
    expect(v).toEqual({ flagged: false, via: "openai" });
    expect(hit).toHaveLength(1);
    expect(hit[0]).toContain("api.openai.com");
  });
  it("主審命中即拒", async () => {
    const v = await moderateCheckin({ text: "x" }, { openaiKey: "k", fetchFn: flagged });
    expect(v.flagged).toBe(true);
    if (v.flagged) expect(v.via).toBe("openai");
  });
  it("主審掛→兜底頂上（乾淨放行／命中拒）", async () => {
    const v1 = await moderateCheckin({ text: "x" }, { openaiKey: "k", minimaxKey: "m", fetchFn: boom });
    void v1;
    // boom 同時打兩家：分開驗——兜底乾淨
    const v2 = await moderateCheckin({ text: "x" }, { minimaxKey: "m", fetchFn: mmClean });
    expect(v2).toEqual({ flagged: false, via: "minimax" });
    const v3 = await moderateCheckin({ text: "x" }, { minimaxKey: "m", fetchFn: mmFlag });
    expect(v3.flagged).toBe(true);
    if (v3.flagged) expect(v3.categories).toEqual(["minimax:abusive"]);
  });
  it("全掛即 all-failed（路由转 503，不再是静默放行）", async () => {
    const v = await moderateCheckin({ text: "x" }, { openaiKey: "k", minimaxKey: "m", fetchFn: boom });
    expect(v).toEqual({
      flagged: false,
      skipped: true,
      reason: "all-failed",
      errors: [
        { vendor: "openai", status: 429 },
        { vendor: "minimax", status: 429 },
      ],
    });
    expect(moderationAction(v)).toBe("unavailable");
  });
  it("moderationAction 矩阵", () => {
    expect(moderationAction({ flagged: false, skipped: true, reason: "no-input" })).toBe("pass");
    expect(moderationAction({ flagged: false, skipped: true, reason: "no-keys" })).toBe("pass");
    expect(moderationAction({ flagged: false, via: "openai" })).toBe("pass");
    expect(moderationAction({ flagged: false, via: "minimax" })).toBe("pass");
    expect(moderationAction({ flagged: true, categories: ["violence"], via: "openai" })).toBe("reject");
    expect(moderationAction({ flagged: true, categories: ["minimax:model"], via: "minimax" })).toBe("reject");
  });
});

describe("moderateWithMinimax 模型裁决 OR (DEF-20260929-001)", () => {
  const mmReply = (text: string) =>
    vi.fn(async () =>
      new Response(
        JSON.stringify({ input_sensitive: false, choices: [{ message: { content: text } }] }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;
  it("平台干净＋模型 BLOCK 即拦", async () => {
    const v = await moderateWithMinimax({ text: "I want to kill them" }, { apiKey: "k", fetchFn: mmReply("BLOCK") });
    expect(v).toEqual({ flagged: true, categories: ["minimax:model"] });
  });
  it("平台干净＋模型 PASS 即放", async () => {
    const v = await moderateWithMinimax({ text: "今晚第一杯" }, { apiKey: "k", fetchFn: mmReply("PASS") });
    expect(v).toEqual({ flagged: false, categories: [] });
  });
  it("模型胡言（非 BLOCK 开头）按干净处理，平台信号不受影响", async () => {
    const v = await moderateWithMinimax({ text: "hi" }, { apiKey: "k", fetchFn: mmReply("OK 收到") });
    expect(v).toEqual({ flagged: false, categories: [] });
    const plat = stubFetch({ input_sensitive: true, input_sensitive_type: 2 });
    const v2 = await moderateCheckin({ text: "x" }, { minimaxKey: "m", fetchFn: plat });
    expect(v2.flagged).toBe(true);
  });
  it("401 地域／凭据错也下沉兜底（不吞状态，调用方可大声）", async () => {
    const bad = vi.fn(async () => new Response("{}", { status: 403 })) as unknown as typeof fetch;
    const v = await moderateCheckin(
      { text: "x" },
      { openaiKey: "k", minimaxKey: "m", fetchFn: bad },
    );
    // minimax 同样 403 → all-failed（路由 503），且 errors 记下两家状态
    expect(v).toEqual({
      flagged: false,
      skipped: true,
      reason: "all-failed",
      errors: [
        { vendor: "openai", status: 403 },
        { vendor: "minimax", status: 403 },
      ],
    });
  });
});

describe("图片进审核 body (UR E.2 图片审核)", () => {
  it("OpenAI body 带 image_url", async () => {
    let body = "";
    const fn = vi.fn(async (url: unknown, init: unknown) => {
      body = String((init as { body: string }).body);
      return new Response(JSON.stringify({ results: [{ flagged: false, categories: {} }] }), { status: 200 });
    }) as unknown as typeof fetch;
    await moderateContent(
      { text: "t", imageDataUrl: "data:image/jpeg;base64,/9j/" },
      { apiKey: "k", fetchFn: fn },
    );
    expect(fn).toHaveBeenCalledTimes(1);
    expect(body).toContain('"type":"image_url"');
    expect(body).toContain("data:image/jpeg;base64,/9j/");
  });
  it("Minimax body 带 image_url（detail low 省 token）", async () => {
    let body = "";
    const fn = vi.fn(async (url: unknown, init: unknown) => {
      body = String((init as { body: string }).body);
      return new Response(JSON.stringify({ input_sensitive: false, choices: [{ message: { content: "PASS" } }] }), { status: 200 });
    }) as unknown as typeof fetch;
    await moderateWithMinimax(
      { imageDataUrl: "data:image/jpeg;base64,/9j/" },
      { apiKey: "k", fetchFn: fn },
    );
    expect(body).toContain('"type":"image_url"');
    expect(body).toContain('"detail":"low"');
  });
});
