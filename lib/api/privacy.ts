/**
 * 隐私／隐身矩阵（PRIVACY_MODE_MATRIX，2026-10-11 定案）的纯函数层（可单测）。
 * 路由层负责查库；这里只做「模式→可见性」「查看者→可见行」「陌生人计数」。
 */

import { canViewCheckin } from "./checkins";

export type CheckinVisibility = "public" | "friends" | "private";

/** 矩阵 D：新打卡的可见性由发布时的模式定格（切换模式不追溯旧帖）。 */
export function checkinVisibilityFor(mode: string | null | undefined): CheckinVisibility {
  if (mode === "stealth") return "private";
  if (mode === "friends") return "friends";
  return "public";
}

/**
 * 矩阵 C：查看者能看到的打卡行。本人全见（含 private，前端加锁）；
 * 其余沿 canViewCheckin（好友＝public＋friends；陌生人＝public；private 永不见）。
 */
export function visibleRowsFor<T extends Record<string, unknown>>(
  viewerId: string,
  ownerId: string,
  rows: readonly T[],
  friendIds: readonly string[],
): T[] {
  if (viewerId === ownerId) return [...rows];
  return rows.filter((r) => canViewCheckin(viewerId, ownerId, r.visibility, friendIds));
}

/**
 * 矩阵 C：陌生人视角「另有 N 条仅好友可见」。只数 visibility=friends；
 * private（隐身期间的私人帖）永不计入，不泄露存在。
 */
export function friendsOnlyCountOf(rows: readonly Record<string, unknown>[]): number {
  return rows.filter((r) => r.visibility === "friends").length;
}
