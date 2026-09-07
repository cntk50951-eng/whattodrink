/**
 * UR3.2 每日乾杯上限（前端 mock＋未来服务端同口径）。
 *
 * - 上限：DAILY_CHEERS_LIMIT＝15／用户／自然天（HK 时区）。
 * - Mock 持久化：localStorage `wtd-cheers-daily`＝{ day, ids }，
 *   跨天自动归零；内容当不可信输入逐字段校验（UR1.8 教训）。
 * - 服务端（EPIC 3.0，见 future-schema）：`count(cheers where
 *   from_user_id＝我 and created_at >= 当天 00:00 HKT) >= 15` 即拒，
 *   校验口径与这里的 canCheers 一致。
 */

export const DAILY_CHEERS_LIMIT = 15;

const CHEERS_DAY_KEY = "wtd-cheers-daily";

export type DailyCheersStore = {
  day: string;
  ids: string[];
};

/** HK 自然天键（YYYY-MM-DD）。参数化 today 供单测，不读系统时钟。 */
export function hkTodayKey(today: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(today);
  const get = (type: string): string =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** 还能不能再乾（去重后计数）。 */
export function canCheers(sentIds: readonly string[]): boolean {
  return sentIds.length < DAILY_CHEERS_LIMIT;
}

/** 今日剩余额度（ clamp ≥ 0，展示用）。 */
export function cheersRemaining(sentIds: readonly string[]): number {
  return Math.max(0, DAILY_CHEERS_LIMIT - sentIds.length);
}

/**
 * 读当日已送 id（坏 JSON／缺字段／异日一律归零，不炸不脏读）。
 * SSR 下 window 不存在直接回 []（首帧两端一致，mount 后 hydrate）。
 */
export function loadSentToday(today: Date): string[] {
  if (typeof window === "undefined") return [];
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(CHEERS_DAY_KEY);
  } catch {
    return [];
  }
  if (raw === null) return [];
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed as DailyCheersStore).day !== hkTodayKey(today) ||
    !Array.isArray((parsed as DailyCheersStore).ids)
  ) {
    return [];
  }
  return (parsed as DailyCheersStore).ids.filter(
    (id): id is string => typeof id === "string",
  );
}

/** 写当日已送 id（隐私模式等抛错即吞掉，下次 hydrate 归零，无害）。 */
export function saveSentToday(ids: readonly string[], today: Date): void {
  if (typeof window === "undefined") return;
  try {
    const store: DailyCheersStore = {
      day: hkTodayKey(today),
      ids: [...ids],
    };
    window.localStorage.setItem(CHEERS_DAY_KEY, JSON.stringify(store));
  } catch {
    // 无害：下次 hydrate 归零，计数从严（宁可少记一次，不多放一次）。
  }
}
