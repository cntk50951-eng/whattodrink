import { describe, expect, it } from "vitest";

import {
  canViewCheckin,
  mineRowToWantRecord,
  parseCreateCheckinBody,
  parseMineParams,
  toMineRow,
} from "./checkins";

describe("parseCreateCheckinBody (UR A.10 → A.12 kind)", () => {
  it("合法 want 打卡过（flash）", () => {
    const res = parseCreateCheckinBody({
      beer_id: "heineken",
      lat: 22.28,
      lng: 114.15,
      place_name: "中环",
      kind: "flash",
    });
    expect("body" in res && res.body.beer_id).toBe("heineken");
    if ("body" in res) expect(res.body.kind).toBe("flash");
  });
  it("合法 post 打卡过", () => {
    const res = parseCreateCheckinBody({
      beer_id: "asahi",
      lat: 22.28,
      lng: 114.15,
      kind: "post",
    });
    expect("body" in res && (res.body as { kind: string }).kind).toBe("post");
  });
  it("缺 kind 回退 flash（舊客戶端兼容）", () => {
    const res = parseCreateCheckinBody({
      beer_id: "heineken",
      lat: 22.28,
      lng: 114.15,
    });
    expect("body" in res && (res.body as { kind: string }).kind).toBe("flash");
  });
  it("非法 kind → 400", () => {
    const res = parseCreateCheckinBody({ beer_id: "heineken", lat: 22.28, lng: 114.15, kind: "bad" });
    expect("error" in res).toBe(true);
  });

  it("缺 beer_id → null（UR E.3 酒可选，纯照片打卡）", () => {
    const res = parseCreateCheckinBody({ lat: 22, lng: 114 });
    if ("body" in res) expect(res.body.beer_id).toBeNull();
    else throw new Error("expected body");
  });

  it("beer_id 空串／null → null", () => {
    for (const v of ["  ", null]) {
      const res = parseCreateCheckinBody({ beer_id: v, lat: 22, lng: 114 });
      if ("body" in res) expect(res.body.beer_id).toBeNull();
      else throw new Error("expected body");
    }
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

describe("toMineRow / mineRowToWantRecord (A.12 kind/visibility)", () => {
  const raw = {
    id: "11111111-1111-1111-1111-111111111111",
    beer_id: "heineken",
    lat: 22.28,
    lng: 114.15,
    place_name: "中环",
    kind: "flash" as const,
    visibility: "public" as const,
    expires_at: "2026-09-16T08:00:00.000Z",
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
    expect(row?.kind).toBe("flash");
    expect(row?.visibility).toBe("public");
  });
  it("post 行無 expires", () => {
    const postRaw = { ...raw, kind: "post" as const, expires_at: null, visibility: "friends" as const };
    const row = toMineRow(postRaw);
    expect(row?.kind).toBe("post");
    expect(row?.expires_at).toBeNull();
  });
  it("坏行回 null", () => {
    expect(toMineRow({ ...raw, created_at: "bad" })).toBeNull();
  });
  it("WantRecord 合成含 kind/visibility/expiresAt", () => {
    const row = toMineRow(raw) as NonNullable<ReturnType<typeof toMineRow>>;
    const want = mineRowToWantRecord(row);
    expect(want?.beer?.id).toBe("heineken");
    expect(want?.placeName).toBe("中环");
    expect(want?.at).toBe(Date.parse(raw.created_at));
    expect(want?.kind).toBe("flash");
    expect(want?.visibility).toBe("public");
    expect(want?.expiresAt).toBe(Date.parse(raw.expires_at as string));
    expect(want?.id).toBe(raw.id);
  });
  it("无酒行不断（UR E.3 纯照片打卡回显）", () => {
    const row = toMineRow({ ...raw, beer_id: null, beers: null }) as NonNullable<
      ReturnType<typeof toMineRow>
    >;
    const want = mineRowToWantRecord(row);
    expect(want).not.toBeNull();
    expect(want?.beer).toBeNull();
  });
  it("缺坐标回 null", () => {
    const row = toMineRow({ ...raw, lat: null }) as NonNullable<ReturnType<typeof toMineRow>>;
    expect(mineRowToWantRecord(row)).toBeNull();
  });
});

describe("parseCreateCheckinBody 三件套 (UR E.2)", () => {
  const BASE = {
    beer_id: "asahi",
    lat: 22.28,
    lng: 114.15,
    kind: "flash" as const,
  };
  it("三件套合法即收", () => {
    const res = parseCreateCheckinBody({
      ...BASE,
      photo_url: "data:image/jpeg;base64,/9j/",
      note: "今晚第一杯",
      audio_url: "data:audio/webm;base64,GkXf",
      audio_seconds: 12,
      transcript: "好飲",
    });
    expect("body" in res && res.body.photo_url).toBe("data:image/jpeg;base64,/9j/");
    expect("body" in res && res.body.note).toBe("今晚第一杯");
    expect("body" in res && res.body.audio_seconds).toBe(12);
  });
  it("壞值即 400（非圖／超長／note 超限／秒數超限）", () => {
    expect(
      parseCreateCheckinBody({ ...BASE, photo_url: "http://x/y.jpg" }),
    ).toEqual({ error: expect.stringContaining("photo_url") });
    expect(
      parseCreateCheckinBody({ ...BASE, note: "a".repeat(501) }),
    ).toEqual({ error: expect.stringContaining("note") });
    expect(
      parseCreateCheckinBody({
        ...BASE,
        audio_url: "data:audio/webm;base64,x",
        audio_seconds: 99,
      }),
    ).toEqual({ error: expect.stringContaining("audio_seconds") });
  });
  it("無音頻 URL 時秒數不寫入", () => {
    const res = parseCreateCheckinBody({ ...BASE, audio_seconds: 5 });
    expect("body" in res && res.body.audio_seconds).toBeUndefined();
  });
});

describe("canViewCheckin (UR E.2)", () => {
  it("本人全見／public 全見", () => {
    expect(canViewCheckin("u1", "u1", "private", [])).toBe(true);
    expect(canViewCheckin("u1", "u2", "public", [])).toBe(true);
  });
  it("friends 僅互好友見", () => {
    expect(canViewCheckin("u1", "u2", "friends", ["u2"])).toBe(true);
    expect(canViewCheckin("u1", "u2", "friends", ["u3"])).toBe(false);
    expect(canViewCheckin("u1", "u2", "private", ["u2"])).toBe(false);
  });
  it("陌生／缺主全擋", () => {
    expect(canViewCheckin("u1", "u2", "private", [])).toBe(false);
    expect(canViewCheckin("u1", null, "public", [])).toBe(true);
    expect(canViewCheckin("u1", null, "friends", [])).toBe(false);
  });
});

describe("toMineRow 三件套回顯 (UR E.2)", () => {
  it("三件套進 MineRowJson", () => {
    const row = toMineRow({
      id: "c1",
      beer_id: "asahi",
      lat: 22.28,
      lng: 114.15,
      place_name: null,
      kind: "flash",
      visibility: "public",
      expires_at: null,
      created_at: "2026-09-27T10:00:00.000Z",
      photo_url: "data:image/jpeg;base64,/9j/",
      note: "好飲",
      audio_url: null,
      audio_seconds: null,
      transcript: null,
      beers: null,
    });
    expect(row?.photo_url).toBe("data:image/jpeg;base64,/9j/");
    expect(row?.note).toBe("好飲");
  });
});
