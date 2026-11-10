/**
 * Bar 遊戲共用的每日上限：大話骰＋21點「合計」每日最多開 25 局（用戶 2026-11-09 定）。
 * 每開一局即計（放棄也算）。Ivy 的 AI 額度另算：大話骰仍是「當日前 20 鋪」（只算大話骰自己的鋪數），21點不設 AI 額度。
 */
import type { createServiceClient } from "@/lib/supabase/server";

type Svc = Awaited<ReturnType<typeof createServiceClient>>;

export const BAR_GAMES = {
  startsPerDay: 25,
} as const;

/** 香港今天 0 點（UTC ISO；每日開局上限的下界） */
export function hkDayStartISO(nowMs: number): string {
  const hk = new Date(nowMs + 8 * 3600_000);
  hk.setUTCHours(0, 0, 0, 0);
  return new Date(hk.getTime() - 8 * 3600_000).toISOString();
}

export type GamesToday = { dice: number; blackjack: number; total: number };

export async function countGamesToday(svc: Svc, userId: string, nowMs: number = Date.now()): Promise<GamesToday> {
  const since = hkDayStartISO(nowMs);
  const one = async (table: "bar_dice_matches" | "bar_blackjack_matches"): Promise<number> => {
    const { count } = await svc.from(table).select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since);
    return count ?? 0;
  };
  const [dice, blackjack] = await Promise.all([one("bar_dice_matches"), one("bar_blackjack_matches")]);
  return { dice, blackjack, total: dice + blackjack };
}

export const gamesCapMessage = (): string => `今日大話骰同 21點加埋已玩滿 ${BAR_GAMES.startsPerDay} 局，聽日再嚟。`;
