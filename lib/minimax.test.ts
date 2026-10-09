import { describe, expect, it, vi } from "vitest";

import { minimaxChat, minimaxTts } from "./minimax";

function stubFetch(json: unknown, ok = true, status = 200): typeof fetch {
  return vi.fn(async () => new Response(JSON.stringify(json), { status: ok ? status : status })) as unknown as typeof fetch;
}

describe("minimaxChat", () => {
  it("正常回正文", async () => {
    const fn = stubFetch({
      base_resp: { status_code: 0 },
      choices: [{ message: { content: "欢迎光临" } }],
    });
    await expect(
      minimaxChat([{ role: "user", content: "hi" }], { apiKey: "k", fetchFn: fn }),
    ).resolves.toBe("欢迎光临");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("数组 content 拼起来", async () => {
    const fn = stubFetch({
      base_resp: { status_code: 0 },
      choices: [{ message: { content: [{ text: "你好" }, { text: "呀" }] } }],
    });
    await expect(
      minimaxChat([{ role: "user", content: "hi" }], { apiKey: "k", fetchFn: fn }),
    ).resolves.toBe("你好呀");
  });

  it("HTTP 错抛 MinimaxError", async () => {
    const fn = stubFetch({}, false, 429);
    await expect(
      minimaxChat([{ role: "user", content: "hi" }], { apiKey: "k", fetchFn: fn }),
    ).rejects.toMatchObject({ name: "MinimaxError", status: 429 });
  });

  it("空回复抛（不把空字串当台词）", async () => {
    const fn = stubFetch({ base_resp: { status_code: 0 }, choices: [] });
    await expect(
      minimaxChat([{ role: "user", content: "hi" }], { apiKey: "k", fetchFn: fn }),
    ).rejects.toThrow("empty reply");
  });

  it("平台错码抛", async () => {
    const fn = stubFetch({ base_resp: { status_code: 2013, status_msg: "bad" } });
    await expect(
      minimaxChat([{ role: "user", content: "hi" }], { apiKey: "k", fetchFn: fn }),
    ).rejects.toThrow("bad");
  });
});

describe("minimaxTts", () => {
  it("hex 解成 mp3", async () => {
    const fn = stubFetch({
      base_resp: { status_code: 0 },
      data: { audio: "494433040000", status: 2 },
    });
    const buf = await minimaxTts("你好", { apiKey: "k", fetchFn: fn });
    expect(buf.subarray(0, 3).toString()).toBe("ID3");
  });

  it("英文台词走 English boost，中文走 Chinese", async () => {
    const seen: string[] = [];
    const fn = vi.fn(async (_url: unknown, init?: { body?: unknown }) => {
      seen.push(String(init?.body ?? ""));
      return new Response(
        JSON.stringify({ base_resp: { status_code: 0 }, data: { audio: "494433040000", status: 2 } }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;
    await minimaxTts("Hey there, handsome", { apiKey: "k", fetchFn: fn });
    await minimaxTts("晚上好呀", { apiKey: "k", fetchFn: fn });
    const boosts = seen.map((b) => (JSON.parse(b) as { language_boost?: string }).language_boost);
    expect(boosts).toEqual(["English", "Chinese"]);
  });

  it("平台错码抛", async () => {
    const fn = stubFetch({ base_resp: { status_code: 2013, status_msg: "bad" } });
    await expect(minimaxTts("你好", { apiKey: "k", fetchFn: fn })).rejects.toThrow("bad");
  });

  it("HTTP 错抛 MinimaxError", async () => {
    const fn = stubFetch({}, false, 500);
    await expect(minimaxTts("你好", { apiKey: "k", fetchFn: fn })).rejects.toMatchObject({
      name: "MinimaxError",
      status: 500,
    });
  });
});

describe("minimaxTts languageBoost", () => {
  it("显式优先于自动判断", async () => {
    const seen: string[] = [];
    const fn = (async (_url: unknown, init?: { body?: unknown }) => {
      seen.push(String(init?.body ?? ""));
      return new Response(
        JSON.stringify({ base_resp: { status_code: 0 }, data: { audio: "494433040000", status: 2 } }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;
    await minimaxTts("有咩推介", { apiKey: "k", fetchFn: fn, languageBoost: "Chinese,Yue" });
    const boosts = seen.map((b) => (JSON.parse(b) as { language_boost?: string }).language_boost);
    expect(boosts).toEqual(["Chinese,Yue"]);
  });
});
