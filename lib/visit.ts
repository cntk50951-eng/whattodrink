/**
 * UR3.5 上次访问（城市状态卡的数据源，mock 本地水位）。
 *
 * - 存 `wtd-last-visit`＝{ at, area? }：mount 读出上次，读完即用 now 重写。
 * - area 是区级地名（Nominatim，失败即无——无则上次地点行整行隐藏，
 *   不硬凑）。比较只看 area 字符串相等，城市级恒为香港。
 * - EPIC 3.0：`users.last_seen_at`＋登录历史表，本地键整块删。
 */

export type LastVisit = {
  /** 上次打开时刻（epoch ms），首访即无。 */
  at: number;
  /** 上次所在区（可缺）。 */
  area?: string;
};

const VISIT_KEY = "wtd-last-visit";

function parseVisit(raw: unknown): LastVisit | null {
  if (typeof raw !== "object" || raw === null) return null;
  const v = raw as Record<string, unknown>;
  if (typeof v.at !== "number" || !Number.isFinite(v.at) || v.at <= 0) {
    return null;
  }
  if (v.area !== undefined && typeof v.area !== "string") return null;
  return v.area === undefined ? { at: v.at } : { at: v.at, area: v.area };
}

/**
 * 读出上次并记下这次（调用一次完成一轮）。SSR／隐私模式回 null（首访态）。
 * @param now 当前时刻（调用方 Date.now()，effect／事件上下文）。
 */
export function touchVisit(now: number): LastVisit | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(VISIT_KEY);
    const prev =
      raw === null ? null : parseVisit(JSON.parse(raw) as unknown);
    window.localStorage.setItem(VISIT_KEY, JSON.stringify({ at: now }));
    return prev;
  } catch {
    return null;
  }
}

/** 补上这次的区（地名异步回来后调；失败不写，保持无区隐藏）。 */
export function patchVisitArea(area: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(VISIT_KEY);
    const cur =
      raw === null ? null : parseVisit(JSON.parse(raw) as unknown);
    if (cur === null) return;
    window.localStorage.setItem(
      VISIT_KEY,
      JSON.stringify({ ...cur, area }),
    );
  } catch {
    // 写不进即无区，隐藏行，无害。
  }
}

/**
 * 是否显示上次地点行：两边区名都有且不一样才显示（任一缺席即隐藏，
 * 用户原话“否则不需要显示”）。
 */
export function shouldShowLastPlace(
  prev: LastVisit | null,
  currentArea: string | null,
): boolean {
  return (
    prev?.area !== undefined &&
    prev.area.length > 0 &&
    currentArea !== null &&
    currentArea.length > 0 &&
    prev.area !== currentArea
  );
}
