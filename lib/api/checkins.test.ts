import { describe, expect, it } from "vitest";

import {
  mineRowToWantRecord,
  parseCreateCheckinBody,
  parseMineParams,
  toMineRow,
} from "./checkins";

describe("parseCreateCheckinBody (UR A.10)", () => {
  it("合法 want 打卡过", () => {
    const res = parseCreateCheckinBody({
      beer_id: "heineken",
      lat: 22.28,
      lng: 114.15,
      place_name: "中环",
    });
    expect("body" in res && res.body.beer_id).toBe("heineken");
  });

  it("缺 beer_id → invalid_params", () => {
    const res = parseCreateCheckinBody({ lat: 22, lng: 114 });
    expect("error" in res).toBe(true);
  });

  it("lat 越界 → 400", () => {
    const res = parseCreateCheckinBody({ beer_id: "heineken", lat: 100, lng: 114 });
    expect("error" in res).toBe(true);
  });

  it("place_name 空串归 null", () => {
    const res = parseCreateCheckinBody({ beer_id: "heineken", lat: 22, lng: 114, place_name: "  " });
    if ("body" in res) expect(res.body.place_name).toBeNull();
    else throw new Error("expected body");
  });
});

describe("parseMineParams", () => {
  it("默认 30", () => {
    const res = parseMineParams(new URLSearchParams());
    expect("limit" in res && res.limit).toBe(30);
  });
  it("非法 limit → 400", () => {
    const res = parseMineParams(new URLSearchParams({ limit: "999" }));
    expect("error" in res).toBe(true);
  });
});

describe("toMineRow / mineRowToWantRecord", () => {
  const raw = {
    id: "11111111-1111-1111-1111-111111111111",
    beer_id: "heineken",
    lat: 22.28,
    lng: 114.15,
    place_name: "中环",
    created_at: "2026-09-15T08:00:00.000Z",
    beers: {
      id: "heineken",
      name: "Heineken",
      emoji: "🍺",
      category: "lager",
      tagline: "",
      icon_url: null,
    },
  };
  it("合法行映射过", () => {
    const row = toMineRow(raw);
    expect(row?.id).toBe(raw.id);
  });
  it("坏行回 null", () => {
    expect(toMineRow({ ...raw, created_at: "bad" })).toBeNull();
  });
  it("WantRecord 合成", () => {
    const row = toMineRow(raw) as NonNullable<ReturnType<typeof toMineRow>>;
    const want = mineRowToWantRecord(row);
    expect(want?.beer.id).toBe("heineken");
    expect(want?.placeName).toBe("中环");
    expect(want?.at).toBe(Date.parse(raw.created_at));
  });
  it("缺坐标回 null", () => {
    const row = toMineRow({ ...raw, lat: null }) as NonNullable<ReturnType<typeof toMineRow>>;
    expect(mineRowToWantRecord(row)).toBeNull();
  });
});
