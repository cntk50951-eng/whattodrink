import { describe, expect, it } from "vitest";

import { ONLINE_WINDOW_MS } from "./nearby";
import {
  distanceBand,
  nextOnlineSince,
  parseRadiusKm,
  sortNearby,
  tasteGroupsOf,
  toNearbyCandidate,
} from "./nearbyPeople";

const NOW = new Date("2026-10-20T14:00:00Z").getTime();
const ME = { lat: 22.2793, lng: 114.1628 };
const iso = (ms: number) => new Date(ms).toISOString();

function row(over: Record<string, unknown> = {}) {
  return {
    id: "u1",
    nickname: "Yuki",
    avatar_url: null,
    gender: "female",
    dob: "1998-05-01",
    mode: "public",
    preferences: { favorites: ["ipa"], likes: ["single_malt"] },
    last_seen_at: iso(NOW - 60_000),
    online_since: iso(NOW - 10 * 60_000),
    live_lat: 22.2830,
    live_lng: 114.1650,
    ...over,
  };
}
const cand = (over: Record<string, unknown> = {}, my: string[] = [], km = 3) =>
  toNearbyCandidate(row(over), ME, km, my, "none", NOW);

describe("distanceBand", () => {
  it("向上取整到檔位，超過最大檔封頂", () => {
    expect(distanceBand(0)).toBe(200);
    expect(distanceBand(199)).toBe(200);
    expect(distanceBand(200)).toBe(200);
    expect(distanceBand(201)).toBe(500);
    expect(distanceBand(1500)).toBe(2000);
    expect(distanceBand(99999)).toBe(10000);
    expect(distanceBand(NaN)).toBe(200);
  });
});

describe("nextOnlineSince", () => {
  it("窗內連續心跳沿用舊起點", () => {
    const since = iso(NOW - 20 * 60_000);
    expect(nextOnlineSince(iso(NOW - 30_000), since, NOW)).toBe(since);
  });
  it("窗內但沒有舊起點：用上次心跳時間", () => {
    const last = iso(NOW - 90_000);
    expect(nextOnlineSince(last, null, NOW)).toBe(last);
  });
  it("斷開超過窗＝重新上線", () => {
    expect(nextOnlineSince(iso(NOW - ONLINE_WINDOW_MS - 1), iso(NOW - 3_600_000), NOW)).toBe(iso(NOW));
  });
  it("從沒上報＝現在", () => {
    expect(nextOnlineSince(null, null, NOW)).toBe(iso(NOW));
  });
  it("舊起點比上次心跳還晚（壞數據）＝退回上次心跳", () => {
    const last = iso(NOW - 60_000);
    expect(nextOnlineSince(last, iso(NOW), NOW)).toBe(last);
  });
});

describe("tasteGroupsOf", () => {
  it("子類歸大類、去重、封頂", () => {
    expect(tasteGroupsOf({ favorites: ["ipa", "craft"], likes: ["single_malt"] })).toEqual(["beer", "whisky"]);
    expect(tasteGroupsOf({ favorites: ["not_a_key", 3] })).toEqual([]);
    expect(tasteGroupsOf(null)).toEqual([]);
    expect(tasteGroupsOf({ favorites: ["ipa", "red", "soju", "meiguilu", "mezcal"] }, 3)).toHaveLength(3);
  });
});

describe("toNearbyCandidate", () => {
  it("正常行：回距離檔，不含精確距離與坐標", () => {
    const c = cand({}, ["beer"]);
    expect(c).not.toBeNull();
    const p = c!.person;
    expect(p.distance_band_m).toBe(500);
    expect(p.shared_taste_groups).toEqual(["beer"]);
    expect(p.taste_groups).toEqual(["beer", "whisky"]);
    expect(p.online_since).toBe(NOW - 10 * 60_000);
    expect(JSON.stringify(p)).not.toMatch(/live_lat|live_lng|"lat"|"lng"/);
  });
  it("隱身丟棄", () => expect(cand({ mode: "stealth" })).toBeNull());
  it("超過 5 分鐘窗丟棄", () => expect(cand({ last_seen_at: iso(NOW - ONLINE_WINDOW_MS - 1) })).toBeNull());
  it("未成年丟棄", () => expect(cand({ dob: "2012-01-01" })).toBeNull());
  it("無坐標／無暱稱丟棄", () => {
    expect(cand({ live_lat: null })).toBeNull();
    expect(cand({ nickname: "" })).toBeNull();
  });
  it("超出半徑丟棄", () => expect(cand({ live_lat: 22.4, live_lng: 114.3 }, [], 3)).toBeNull());
  it("online_since 缺失或晚於心跳：回退心跳時間", () => {
    expect(cand({ online_since: null })!.person.online_since).toBe(NOW - 60_000);
    expect(cand({ online_since: iso(NOW) })!.person.online_since).toBe(NOW - 60_000);
  });
});

describe("sortNearby", () => {
  it("上線時間新→舊；同時間按精確距離近→遠", () => {
    const a = cand({ id: "a", online_since: iso(NOW - 600_000), live_lat: 22.285 })!;
    const b = cand({ id: "b", online_since: iso(NOW - 120_000), live_lat: 22.300 })!;
    const c = cand({ id: "c", online_since: iso(NOW - 120_000), live_lat: 22.281 })!;
    expect(sortNearby([a, b, c]).map((p) => p.user_id)).toEqual(["c", "b", "a"]);
  });
});

describe("parseRadiusKm", () => {
  it("缺省 3、夾範圍、壞值 null", () => {
    expect(parseRadiusKm(null)).toBe(3);
    expect(parseRadiusKm("5")).toBe(5);
    expect(parseRadiusKm("99")).toBe(10);
    expect(parseRadiusKm("0.01")).toBe(0.1);
    expect(parseRadiusKm("abc")).toBeNull();
    expect(parseRadiusKm("-1")).toBeNull();
  });
});
