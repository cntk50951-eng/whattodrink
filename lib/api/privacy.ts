/**
 * 隐私／隐身矩阵（PRIVACY_MODE_MATRIX，2026-10-11 定案）的纯函数层（可单测）。
 * 路由层负责查库；这里只做「模式→可见性」「查看者→可见行」「陌生人计数」。
 */

import { canViewCheckin } from "./checkins";

export type CheckinVisibility = "public" | "friends" | "private";

/** 矩阵 D：新打卡的可见性由发布时的模式定格（切换模式不追溯旧帖）。 */
export function checkinVisibilityFor(
  mode: string | null | undefined,
  override?: unknown,
): CheckinVisibility {
  // 隐身永远 private（压过用户设置）；其余：用户设了默认可见性就用它，没设跟随模式（0062）。
  if (mode === "stealth") return "private";
  const o = parseVisibility(override);
  if (o !== null) return o;
  if (mode === "friends") return "friends";
  return "public";
}

/** 白名单解析；非法／缺省回 null（调用方决定回退）。 */
export function parseVisibility(v: unknown): CheckinVisibility | null {
  return v === "public" || v === "friends" || v === "private" ? v : null;
}

/** 收藏可见性（0062）：缺省／非法＝friends（与旧行为一致：仅互为好友）。 */
export function parseSavesVisibility(v: unknown): CheckinVisibility {
  return parseVisibility(v) ?? "friends";
}

/**
 * 看别人收藏列表的门（0062）：
 * - allow：本人；public（任何人）；friends（好友）
 * - forbidden：陌生人且对方没设 public（沿旧 403，iOS 对陌生人本来就藏标签）
 * - empty：对方设 private 但查看者是好友——回空列表，不暴露「对方设置了不公开」
 * 返回 allow 后，列表仍只给查看者本来就看得到的帖（canViewCheckin），不因被收藏而暴露。
 */
export function savesAccess(
  setting: CheckinVisibility,
  isOwner: boolean,
  isFriend: boolean,
): "allow" | "forbidden" | "empty" {
  if (isOwner) return "allow";
  if (setting === "public") return "allow";
  if (!isFriend) return "forbidden";
  return setting === "private" ? "empty" : "allow";
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
