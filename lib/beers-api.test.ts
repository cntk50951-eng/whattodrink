import { afterEach, describe, expect, it, vi } from "vitest";

import { BEERS, applyBeerCatalog, beerByName, fetchBeers } from "./beers";

const PRISTINE = BEERS.map((b) => ({ ...b }));

afterEach(() => {
  vi.unstubAllGlobals();
  applyBeerCatalog(PRISTINE.map((b) => ({ ...b })));
});

function mockFetchOnce(
  ok: boolean,
  body: unknown,
  status = ok ? 200 : 500,
) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      status,
      json: () => Promise.resolve(body),
    }),
  );
}

const ROW = {
  id: "heineken",
  emoji: "🍺",
  name: "Heineken",
  category: "lager",
  tagline: "加班過的救贖",
  icon_url: "https://x/heineken.svg",
};

describe("fetchBeers", () => {
  it("成功即原地換源＋回 true（icon_url 帶上）", async () => {
    mockFetchOnce(true, { beers: [ROW] });
    await expect(fetchBeers()).resolves.toBe(true);
    expect(BEERS).toHaveLength(1);
    expect(BEERS[0]?.icon_url).toBe("https://x/heineken.svg");
  });

  it("beerByName 精確匹配，找不到回 null", () => {
    expect(beerByName("Mojito")?.id).toBe("mojito");
    expect(beerByName("不存在")).toBeNull();
  });

  it("!ok／拋錯／壞行／空表全部回 false 且目錄不動", async () => {
    mockFetchOnce(false, { error: { code: "internal" } });
    await expect(fetchBeers()).resolves.toBe(false);
    expect(BEERS).toHaveLength(15);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("offline")),
    );
    await expect(fetchBeers()).resolves.toBe(false);

    mockFetchOnce(true, { beers: [{ ...ROW, name: 42 }] });
    await expect(fetchBeers()).resolves.toBe(false);

    mockFetchOnce(true, { beers: [] });
    await expect(fetchBeers()).resolves.toBe(false);
    expect(BEERS).toHaveLength(15);
  });
});
