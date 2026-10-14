/**
 * 申诉资格：只有「结果对自己不利」的一方可申诉。
 * upheld（成立，扣被投诉人）→ 被投诉人；dismissed（驳回，扣投诉人 2 分）／malicious（恶意，扣投诉人）→ 投诉人。
 */
export function isAdverseParty(status: unknown, isFiler: boolean, isTarget: boolean): boolean {
  if (status === "upheld") return isTarget;
  if (status === "dismissed" || status === "malicious") return isFiler;
  return false;
}
