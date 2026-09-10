import { describe, expect, it } from "vitest";

import { toBeersJson } from "./beers";
import { apiError, apiOk } from "./envelope";

const ROW = {
  id: "heineken",
  emoji: "🍺",
  name: "Heineken",
  category: "lager",
  tagline: "加班過的救贖",
  icon_url: null,
};

describe("toBeersJson", () => {
  it("整批合法行原樣轉", () => {
    expect(toBeersJson([ROW, { ...ROW, id: "asahi" }])).toHaveLength(2);
  });

  it("空表回空陣列（不是 null）", () => {
    expect(toBeersJson([])).toEqual([]);
  });

  it("壞行整批 null（不斷尾）", () => {
    expect(toBeersJson([ROW, { ...ROW, name: 42 }])).toBeNull();
    expect(toBeersJson("nope")).toBeNull();
  });

  it("icon_url 可為 URL 或 null，缺鍵即壞行", () => {
    expect(
      toBeersJson([{ ...ROW, icon_url: "https://x/heineken.svg" }])?.[0]
        ?.icon_url,
    ).toBe("https://x/heineken.svg");
    const { icon_url: _drop, ...noIcon } = ROW;
    void _drop;
    expect(toBeersJson([noIcon])).toBeNull();
  });
});

describe("envelope", () => {
  it("apiOk 包裸數據＋200", async () => {
    const res = apiOk({ beers: [] });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ beers: [] });
  });

  it("apiError 包 code＋狀態", async () => {
    const res = apiError("internal", "boom", 500);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: { code: "internal", message: "boom" },
    });
  });
});
