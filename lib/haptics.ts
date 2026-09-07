/**
 * UR2.9 摇一摇触觉：navigator.vibrate 薄封装。
 *
 * - 有 API 才震（Android Chrome 有，iPhone Safari 全系没有 —— 调用方
 *   不必分支，无震时动画照走，iOS 靠 rattle＋声纳补偿）。
 * - 同步返回是否真震了，调用方可用它打点或降级，别无声失败。
 * - SSR 安全：一切 navigator 访问都在函数体内，模块顶层无副作用。
 */

/** 成功：短—停—长，落在结果卡弹出前。 */
export const BUZZ_FOUND: readonly number[] = [60, 80, 140];
/** 失败（无定位／附近无人）：两下轻点 toast 同步。 */
export const BUZZ_MISS: readonly number[] = [25, 60, 25];
/** Prime：物理摇第一晃的确认 tick，越轻越好。 */
export const BUZZ_PRIME: readonly number[] = [20];

/**
 * 震一次。返回 true＝已交 vibrate 调度，false＝无 API／被拒（调用方
 * 不必再判，动画侧照常走）。
 */
export function buzz(pattern: readonly number[]): boolean {
  if (
    typeof navigator === "undefined" ||
    typeof navigator.vibrate !== "function"
  ) {
    return false;
  }
  try {
    return navigator.vibrate([...pattern]);
  } catch {
    return false;
  }
}
