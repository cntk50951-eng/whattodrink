/**
 * UR A.3 Supabase env 解析（純函數，可單測）。
 *
 * 新舊兩套 key 制並存（Supabase 2025 起新 project 預設 publishable／secret，
 * 舊 project 是 anon／service_role）：public key 取 PUBLISHABLE 優先、
 * ANON 兜底；secret 取 SECRET 優先、SERVICE_ROLE 兜底。兩套混填也 work，
 * 但同一組內新舊混用（如 publishable＋service_role）不建議——能跑，但亂。
 */
export type SupabaseEnv = {
  url: string;
  publicKey: string;
  secretKey: string;
};

/** 測試傳小對象、正式傳 process.env——兩邊都是 string 字典。 */
export type EnvSource = Record<string, string | undefined>;

const nonEmpty = (v: string | undefined): string | null =>
  v !== undefined && v.length > 0 ? v : null;

export function resolveSupabaseEnv(
  from: EnvSource = process.env,
): { env: SupabaseEnv | null; missing: string[] } {
  const url = nonEmpty(from.NEXT_PUBLIC_SUPABASE_URL);
  const publicKey =
    nonEmpty(from.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ??
    nonEmpty(from.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const secretKey =
    nonEmpty(from.SUPABASE_SECRET_KEY) ??
    nonEmpty(from.SUPABASE_SERVICE_ROLE_KEY);
  if (url === null || publicKey === null || secretKey === null) {
    const missing: string[] = [];
    if (url === null) missing.push("NEXT_PUBLIC_SUPABASE_URL");
    if (publicKey === null)
      missing.push(
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (或舊制 NEXT_PUBLIC_SUPABASE_ANON_KEY)",
      );
    if (secretKey === null)
      missing.push("SUPABASE_SECRET_KEY (或舊制 SUPABASE_SERVICE_ROLE_KEY)");
    return { env: null, missing };
  }
  return { env: { url, publicKey, secretKey }, missing: [] };
}

/**
 * 缺 key 即紅字炸——呼叫方（server／browser client 建立處）直接讓它拋，
 * dev 首個請求就看得到，不靜默跑。AC：不靜默。
 */
export function requireSupabaseEnv(
  from: EnvSource = process.env,
): SupabaseEnv {
  const { env, missing } = resolveSupabaseEnv(from);
  if (env === null) {
    throw new Error(
      `Supabase 未配置：缺少 ${missing.join("、")}（照 .env.example 填進 .env.local，不提交）`,
    );
  }
  return env;
}
