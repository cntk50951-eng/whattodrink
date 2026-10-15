/**
 * 足跡回放（好友版）純函數。給好友／陌生人看的數據要先「變鈍」：
 * 只含公開／好友可見打卡、最近 30 天、最近 24 小時不出現、坐標模糊到約 100 米、不帶照片／文字／打卡 id。
 * 本人看自己不走這裡（App 用本地完整數據）。
 */

export const TRAIL_WINDOW_MS = 30 * 24 * 3600 * 1000;
export const TRAIL_DELAY_MS = 24 * 3600 * 1000;

export type TrailVisibility = "off" | "friends";

export function parseTrailVisibility(v: unknown): TrailVisibility {
  return v === "friends" ? "friends" : "off";
}

/** 小數 3 位≈110 米（緯度方向）。 */
export function fuzzCoord(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export type ReplayStop = {
  at: string;
  lat: number;
  lng: number;
  place_name: string | null;
  emoji: string | null;
};

type Row = Record<string, unknown>;

/** 打卡行（主表＋歸檔表合併後）→ 好友版站點，時間升序。 */
export function buildReplayStops(rows: Row[], emojiByBeer: ReadonlyMap<string, string>, nowMs: number): ReplayStop[] {
  const out: (ReplayStop & { ms: number })[] = [];
  for (const r of rows) {
    if (r.visibility !== "public" && r.visibility !== "friends") continue;
    if (typeof r.created_at !== "string") continue;
    const ms = Date.parse(r.created_at);
    if (!Number.isFinite(ms)) continue;
    if (ms > nowMs - TRAIL_DELAY_MS || ms < nowMs - TRAIL_WINDOW_MS) continue;
    if (typeof r.lat !== "number" || typeof r.lng !== "number" || !Number.isFinite(r.lat) || !Number.isFinite(r.lng)) continue;
    const place = typeof r.place_name === "string" && r.place_name.trim() !== "" ? r.place_name.trim().slice(0, 60) : null;
    const emoji = typeof r.beer_id === "string" ? (emojiByBeer.get(r.beer_id) ?? null) : null;
    out.push({ ms, at: new Date(ms).toISOString(), lat: fuzzCoord(r.lat), lng: fuzzCoord(r.lng), place_name: place, emoji });
  }
  return out.sort((a, b) => a.ms - b.ms).map((s) => ({ at: s.at, lat: s.lat, lng: s.lng, place_name: s.place_name, emoji: s.emoji }));
}
