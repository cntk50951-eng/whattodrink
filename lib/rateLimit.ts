/**
 * UR F.11 按 IP 滑动限频（内存进程级；防刷 MiniMax 额度，非精确全局配额）。
 * Serverless 多实例各算各的——挡单机刷量够用，真全局限频另上 infra。
 * nowMs 可注入，单测锁窗口语义。
 */

const hits = new Map<string, number[]>();

/** 窗内未满即记一次回 ok；满了回拒（不记）。 */
export function ipRateLimit(
  key: string,
  nowMs: number,
  windowMs = 60_000,
  max = 30,
): { ok: boolean } {
  const arr = (hits.get(key) ?? []).filter((t) => t > nowMs - windowMs);
  if (arr.length >= max) {
    hits.set(key, arr);
    return { ok: false };
  }
  arr.push(nowMs);
  hits.set(key, arr);
  return { ok: true };
}

/** 测试清表（生产不用）。 */
export function clearIpRateLimit(): void {
  hits.clear();
}
