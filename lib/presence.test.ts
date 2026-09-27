import { describe, expect, it } from "vitest";

import { ONLINE_WINDOW_MS } from "./nearby";
import {
  HEARTBEAT_MIN_MOVE_M,
  parseLiveFriendsResponse,
  parsePresenceBody,
  toLiveFriend,
} from "./presence";

const FRESH = new Date("2026-09-27T00:00:00Z").getTime();

function row(over: Record<string, unknown> = {}) {
  return {
    id: "u1",
    nickname: "阿怡",
    avatar_url: null,
    mode: "public",
    last_seen_at: new Date(FRESH).toISOString(),
    live_lat: 22.28,
    live_lng: 114.15,
    ...over,
  };
}

describe("parsePresenceBody (UR A.21)", () => {
  it("合法經緯即過（全球範圍，旅行也報）", () => {
    expect(parsePresenceBody({ lat: 22.28, lng: 114.15 })).toEqual({
      body: { lat: 22.28, lng: 114.15 },
    });
  });

  it("非對象／缺鍵／越界全擋", () => {
    expect("error" in parsePresenceBody(null)).toBe(true);
    expect("error" in parsePresenceBody({ lat: 22.28 })).toBe(true);
    expect("error" in parsePresenceBody({ lat: 100, lng: 114 })).toBe(true);
    expect("error" in parsePresenceBody({ lat: 22, lng: 200 })).toBe(true);
    expect("error" in parsePresenceBody({ lat: NaN, lng: 114 })).toBe(true);
  });

  it("位移門常數存在（客戶端節流用）", () => {
    expect(HEARTBEAT_MIN_MOVE_M).toBe(50);
  });
});

describe("toLiveFriend (UR A.21)", () => {
  it("鮮活公開好友即過", () => {
    expect(toLiveFriend(row(), FRESH)).toMatchObject({
      user_id: "u1",
      nickname: "阿怡",
      lat: 22.28,
      lng: 114.15,
      updated_at: FRESH,
    });
  });

  it("隱身一律丟（server 端過濾）", () => {
    expect(toLiveFriend(row({ mode: "stealth" }), FRESH)).toBeNull();
  });

  it("超 5min 窗即丟（沿 UR3.3 口徑）", () => {
    const stale = new Date(FRESH - ONLINE_WINDOW_MS - 1000).toISOString();
    expect(toLiveFriend(row({ last_seen_at: stale }), FRESH)).toBeNull();
  });

  it("無 live 坐標即丟", () => {
    expect(toLiveFriend(row({ live_lat: null }), FRESH)).toBeNull();
    expect(toLiveFriend(row({ live_lng: "x" }), FRESH)).toBeNull();
  });

  it("壞 id／壞名／壞頭像即丟", () => {
    expect(toLiveFriend(row({ id: 42 }), FRESH)).toBeNull();
    expect(toLiveFriend(row({ nickname: "" }), FRESH)).toBeNull();
    expect(toLiveFriend(row({ avatar_url: 42 }), FRESH)).toBeNull();
  });
});

describe("parseLiveFriendsResponse (UR A.21)", () => {
  it("好條全收，壞條丟棄", () => {
    const good = {
      user_id: "u1",
      nickname: "阿怡",
      avatar_url: null,
      lat: 22.28,
      lng: 114.15,
      updated_at: FRESH,
    };
    const out = parseLiveFriendsResponse({
      friends: [good, null, 42, { ...good, user_id: "" }, { ...good, lat: NaN }],
    });
    expect(out).toEqual([good]);
  });

  it("非對象／無 friends 陣列回空", () => {
    expect(parseLiveFriendsResponse(null)).toEqual([]);
    expect(parseLiveFriendsResponse({})).toEqual([]);
    expect(parseLiveFriendsResponse({ friends: "x" })).toEqual([]);
  });
});
