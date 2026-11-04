/**
 * Bar 聊天額度（Credits）：每日免費＋大話骰積分。帳本在 Postgres（supabase/migrations/0073_bar_credits.sql），
 * 這裡只放常量與 RPC 包裝；所有數字改這一處即可（SQL 函數不寫死）。設計見 whattodrink_ios/docs/plans/bar-dice-credits-design.md。
 */
import type { createServiceClient } from "@/lib/supabase/server";

export const BAR_CREDIT = {
  /** 每日免費聊天次數（香港 00:00 重置，不累加） */
  dailyLimit: 15,
  /** 贏一局大話骰得到的聊天次數 */
  winGrant: 3,
  /** 積分有效天數（每批從入帳那一刻起算） */
  lotDays: 7,
  /** 每日最多算贏的局數（超過仍可玩，但不再入帳） */
  winsCapPerDay: 5,
  /** 同時持有的積分上限 */
  balanceCap: 45,
} as const;

export type BarCreditLot = { id: string; amount: number; remaining: number; expires_at: string };
export type BarCredits = {
  daily: { limit: number; used: number; remaining: number };
  lots: BarCreditLot[];
  earned_total: number;
  total: number;
  wins_today: number;
  next_reset_at: string;
};

type Svc = Awaited<ReturnType<typeof createServiceClient>>;

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** 驗證 RPC 回包形狀（壞的回 null，呼叫方當服務故障處理，絕不放行免費聊天）。 */
export function parseBarCredits(raw: unknown): BarCredits | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const d = r.daily as Record<string, unknown> | undefined;
  if (d === undefined || !isNum(d.limit) || !isNum(d.used) || !isNum(d.remaining)) return null;
  if (!Array.isArray(r.lots) || !isNum(r.earned_total) || !isNum(r.total) || !isNum(r.wins_today)) return null;
  if (typeof r.next_reset_at !== "string") return null;
  const lots: BarCreditLot[] = [];
  for (const l of r.lots) {
    const x = l as Record<string, unknown>;
    if (typeof x.id !== "string" || !isNum(x.amount) || !isNum(x.remaining) || typeof x.expires_at !== "string") return null;
    lots.push({ id: x.id, amount: x.amount, remaining: x.remaining, expires_at: x.expires_at });
  }
  return {
    daily: { limit: d.limit, used: d.used, remaining: d.remaining },
    lots,
    earned_total: r.earned_total,
    total: r.total,
    wins_today: r.wins_today,
    next_reset_at: r.next_reset_at,
  };
}

export async function getBarCredits(svc: Svc, userId: string): Promise<BarCredits | null> {
  const { data, error } = await svc.rpc("bar_credit_state", { p_user: userId, p_daily_limit: BAR_CREDIT.dailyLimit });
  if (error !== null) {
    console.error(`[bar-credits] state failed: ${error.message}`);
    return null;
  }
  return parseBarCredits(data);
}

export type SpendOutcome =
  | { kind: "ok"; credits: BarCredits; duplicate: boolean }
  | { kind: "exhausted"; credits: BarCredits }
  | { kind: "error" };

/** 聊天扣 1 次（冪等於 ref）。 */
export async function spendChatCredit(svc: Svc, userId: string, ref: string): Promise<SpendOutcome> {
  const { data, error } = await svc.rpc("bar_credit_spend", {
    p_user: userId,
    p_n: 1,
    p_kind: "chat",
    p_ref: ref,
    p_daily_limit: BAR_CREDIT.dailyLimit,
    p_allow_partial: false,
  });
  if (error !== null || typeof data !== "object" || data === null) {
    console.error(`[bar-credits] spend failed: ${error?.message ?? "bad payload"}`);
    return { kind: "error" };
  }
  const r = data as { ok?: unknown; duplicate?: unknown; credits?: unknown };
  const credits = parseBarCredits(r.credits);
  if (credits === null) return { kind: "error" };
  if (r.ok === true) return { kind: "ok", credits, duplicate: r.duplicate === true };
  return { kind: "exhausted", credits };
}

/** Ivy 回覆失敗：把這一次退回（盡力而為；退款失敗只記日誌）。 */
export async function refundChatCredit(svc: Svc, userId: string, ref: string): Promise<BarCredits | null> {
  const { data, error } = await svc.rpc("bar_credit_refund", {
    p_user: userId,
    p_ref: ref,
    p_daily_limit: BAR_CREDIT.dailyLimit,
  });
  if (error !== null) {
    console.error(`[bar-credits] refund failed: ${error.message}`);
    return null;
  }
  return parseBarCredits((data as { credits?: unknown } | null)?.credits);
}

/** 客戶端傳的 request_id 只收安全字元；缺省由服務端生成（那就沒有冪等）。 */
export function normalizeRequestId(raw: unknown): string {
  if (typeof raw === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(raw)) return raw;
  return crypto.randomUUID();
}
