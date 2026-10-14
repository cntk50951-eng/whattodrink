/**
 * 申诉资格：只有「结果对自己不利」的一方可申诉。
 * upheld（成立，扣被投诉人）→ 被投诉人；dismissed（驳回，扣投诉人 2 分）／malicious（恶意，扣投诉人）→ 投诉人。
 */
export function isAdverseParty(status: unknown, isFiler: boolean, isTarget: boolean): boolean {
  if (status === "upheld") return isTarget;
  if (status === "dismissed" || status === "malicious") return isFiler;
  return false;
}

/**
 * 是誰申訴的（庫裡沒存申訴人，從判定與申訴結果推）：
 * 申訴中／維持原判（appeal_status=pending|dismissed）→ 對當前判定不利的一方；
 * 已改判（appeal_status=upheld）→ 申訴方是原判不利方，也就是對「新判」有利的那一方。
 * 無申訴或無判定 → null。
 */
export function appellantRole(decision: unknown, appealStatus: unknown): "filer" | "target" | null {
  if (decision !== "uphold" && decision !== "dismiss" && decision !== "malicious") return null;
  if (appealStatus !== "pending" && appealStatus !== "dismissed" && appealStatus !== "upheld") return null;
  const adverseIsFiler = decision !== "uphold"; // dismiss／malicious 不利投訴人；uphold 不利被投訴人
  const appellantIsFiler = appealStatus === "upheld" ? !adverseIsFiler : adverseIsFiler;
  return appellantIsFiler ? "filer" : "target";
}
