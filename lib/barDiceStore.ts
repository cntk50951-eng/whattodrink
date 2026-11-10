/**
 * Bar 大話骰的存取與結算（IO 層）：bar_dice_matches 是服務端權威（RLS 無 policy，只經 service_role）。
 * 狀態機在 lib/barDice.ts；積分入帳／扣次是 lib/barCredits.ts 背後的 SQL 函數（冪等：同一局只會結算一次）。
 */
import type { createServiceClient } from "@/lib/supabase/server";

import {
  applyBid,
  ivyOptions,
  ivyTurnContext,
  type BotMove,
  applyChallenge,
  BAR_DICE,
  clampDice,
  cryptoRng,
  newMatch,
  type Seat,
  toView,
  type Bid,
  type DiceReveal,
  type DiceState,
  type DiceView,
} from "./barDice";
import { BAR_CREDIT, ensureStarterCredit, parseBarCredits, type BarCredits } from "./barCredits";
import { ivyAiPick, parseLang, sanitizeSaid } from "./barDiceAi";
import { BAR_GAMES, countGamesToday, gamesCapMessage } from "./barGames";

type Svc = Awaited<ReturnType<typeof createServiceClient>>;
type MatchStatus = "active" | "won" | "lost" | "abandoned";

type MatchRow = {
  id: string;
  user_id: string;
  status: MatchStatus;
  state: DiceState;
  credits: unknown;
  created_at: string;
  updated_at: string;
  settled_at: string | null;
};

export type Settlement = {
  result: "won" | "lost" | "abandoned";
  /** 這局造成的次數變化（贏為正＝實際入帳；輸／放棄為負＝實際扣掉） */
  delta: number;
  /** 贏局沒入帳的原因：daily_cap（今日已賺滿）／balance_cap（餘額已滿）／duplicate */
  reason: string | null;
  credits: BarCredits | null;
};

export type DiceOutcome =
  | { ok: true; view: DiceView; reveals: DiceReveal[]; settlement: Settlement | null; /** Ivy 這一手的話（AI 叫骰時才有；沒有就由客戶端用預寫台詞） */ ivySay?: string }
  | { ok: false; code: "not_found" | "stale_version" | "not_your_turn" | "wrong_phase" | "invalid_bid" | "rate_limited" | "internal"; message: string };

const COLS = "id,user_id,status,state,credits,created_at,updated_at,settled_at";

async function settle(svc: Svc, row: MatchRow): Promise<Settlement | null> {
  if (row.status === "active") return null;
  await ensureStarterCredit(svc, row.user_id);
  const won = row.status === "won";
  let settlement: Settlement;
  if (won) {
    const { data, error } = await svc.rpc("bar_credit_grant", {
      p_user: row.user_id,
      p_n: BAR_CREDIT.winGrant,
      p_match: row.id,
      p_lot_days: BAR_CREDIT.lotDays,
      p_wins_cap: BAR_CREDIT.winsCapPerDay,
      p_balance_cap: BAR_CREDIT.balanceCap,
      p_daily_limit: BAR_CREDIT.dailyLimit,
    });
    if (error !== null) {
      console.error(`[bar-dice] grant failed: ${error.message}`);
      return null;
    }
    const d = data as { granted?: number; reason?: string; credits?: unknown };
    settlement = {
      result: "won",
      delta: typeof d.granted === "number" ? d.granted : 0,
      reason: d.reason === "ok" || d.reason === undefined ? null : d.reason,
      credits: parseBarCredits(d.credits),
    };
  } else {
    const { data, error } = await svc.rpc("bar_credit_game_loss", {
      p_user: row.user_id,
      p_kind: "dice_loss",
      p_ref: row.id,
      p_wins_cap: BAR_CREDIT.winsCapPerDay,
      p_daily_limit: BAR_CREDIT.dailyLimit,
    });
    if (error !== null) {
      console.error(`[bar-dice] loss spend failed: ${error.message}`);
      return null;
    }
    const d = data as { spent?: number; reason?: string; credits?: unknown };
    settlement = {
      result: row.status === "abandoned" ? "abandoned" : "lost",
      delta: -(typeof d.spent === "number" ? d.spent : 0),
      reason: d.reason === "win_cap" ? "win_cap" : null,
      credits: parseBarCredits(d.credits),
    };
  }
  await svc.from("bar_dice_matches").update({ credits: settlement, settled_at: new Date().toISOString() }).eq("id", row.id);
  return settlement;
}

/** 把「已結束但還沒結算」（上次結算中途失敗）和「太久沒動作的進行中局」處理掉。 */
async function sweep(svc: Svc, userId: string): Promise<void> {
  const staleBefore = new Date(Date.now() - BAR_DICE.staleMinutes * 60_000).toISOString();
  await svc
    .from("bar_dice_matches")
    .update({ status: "abandoned", updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("status", "active")
    .lt("updated_at", staleBefore);
  const { data } = await svc.from("bar_dice_matches").select(COLS).eq("user_id", userId).neq("status", "active").is("settled_at", null).limit(5);
  for (const r of (data ?? []) as MatchRow[]) await settle(svc, r);
}

async function activeRow(svc: Svc, userId: string): Promise<MatchRow | null> {
  const { data } = await svc.from("bar_dice_matches").select(COLS).eq("user_id", userId).eq("status", "active").maybeSingle();
  return (data as MatchRow | null) ?? null;
}

/** 下一鋪誰先叫：上一鋪的輸家（用戶贏＝Ivy 輸＝Ivy 先叫；用戶輸或放棄＝用戶先叫；第一鋪用戶先叫）。 */
async function nextOpener(svc: Svc, userId: string): Promise<Seat> {
  const { data } = await svc
    .from("bar_dice_matches")
    .select("status")
    .eq("user_id", userId)
    .in("status", ["won", "lost"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { status?: string } | null)?.status === "won" ? "ivy" : "me";
}

/** 開一鋪（已有進行中的就接回那鋪）。`dice`＝每人骰數（3–6，默認 5）。 */
export async function startMatch(svc: Svc, userId: string, dice?: unknown, zhai?: unknown): Promise<DiceOutcome> {
  await sweep(svc, userId);
  const existing = await activeRow(svc, userId);
  if (existing !== null) return { ok: true, view: toView(existing.id, "active", existing.state), reveals: [], settlement: null };
  // 每日上限：大話骰＋21點合計 BAR_GAMES.startsPerDay；Ivy 的 AI 額度只算大話骰自己的鋪數（不被 21點擠掉）
  const today = await countGamesToday(svc, userId);
  if (today.total >= BAR_GAMES.startsPerDay) return { ok: false, code: "rate_limited", message: gamesCapMessage() };
  const count = today.dice;
  const state = newMatch(clampDice(dice), await nextOpener(svc, userId), cryptoRng, { zhai: zhai === true, ai: count < BAR_DICE.aiPerDay });
  const { data, error } = await svc.from("bar_dice_matches").insert({ user_id: userId, status: "active", state }).select(COLS).single();
  if (error !== null || data === null) {
    // 並發開局撞到「一人一局進行中」的唯一索引：接回已存在的那局
    const again = await activeRow(svc, userId);
    if (again !== null) return { ok: true, view: toView(again.id, "active", again.state), reveals: [], settlement: null };
    console.error(`[bar-dice] insert failed: ${error?.message ?? "no row"}`);
    return { ok: false, code: "internal", message: "開局失敗，請稍後再試。" };
  }
  const row = data as MatchRow;
  return { ok: true, view: toView(row.id, "active", row.state), reveals: [], settlement: null };
}

export async function getActive(svc: Svc, userId: string): Promise<DiceView | null> {
  await sweep(svc, userId);
  const row = await activeRow(svc, userId);
  return row === null ? null : toView(row.id, "active", row.state);
}

export type DiceAction = { type: "bid"; qty: number; face: number; zhai?: boolean; said?: unknown; lang?: unknown } | { type: "challenge" };

export async function act(svc: Svc, userId: string, matchId: string, action: DiceAction): Promise<DiceOutcome> {
  const { data } = await svc.from("bar_dice_matches").select(COLS).eq("id", matchId).eq("user_id", userId).maybeSingle();
  const row = data as MatchRow | null;
  if (row === null) return { ok: false, code: "not_found", message: "找不到這局。" };
  if (row.status !== "active") return { ok: false, code: "wrong_phase", message: "這局已經結束。" };
  const bid: Bid | null = action.type === "bid" ? { qty: action.qty, face: action.face, ...(action.zhai === true ? { zhai: true } : {}) } : null;
  // F5：這鋪開了 AI，就請 AI 在服務端算好的候選裡替 Ivy 選一手＋說一句；失敗／逾時＝退回機率機器人
  let forced: BotMove | null = null;
  let ivySay: string | undefined;
  if (bid !== null && row.state.ai === true) {
    const ctx = ivyTurnContext(row.state, bid);
    const apiKey = process.env.minimaxi_api_key ?? process.env.MINIMAXI_API_KEY ?? "";
    if (ctx !== null && apiKey !== "") {
      const options = ivyOptions(ctx.own, ctx.total, ctx.prev, ctx.rules);
      const said = action.type === "bid" ? sanitizeSaid(action.said) : "";
      const r = await ivyAiPick({ apiKey, lang: parseLang(action.type === "bid" ? action.lang : undefined), own: ctx.own, prev: ctx.prev, options, said });
      const chosen = r === null ? undefined : options[r.pick];
      if (r !== null && chosen !== undefined) {
        forced = chosen.move;
        ivySay = r.say;
      }
    }
  }
  const step = bid !== null ? applyBid(row.state, bid, cryptoRng, forced) : applyChallenge(row.state);
  if (!step.ok) return { ok: false, code: step.code, message: step.message };
  const status: MatchStatus = step.state.winner === null ? "active" : step.state.winner === "me" ? "won" : "lost";
  // 樂觀並發：只有 rev 沒變、仍是 active 才能寫（兩台裝置同時操作，後到的得到 stale_version）
  const { data: updated } = await svc
    .from("bar_dice_matches")
    .update({ state: step.state, status, updated_at: new Date().toISOString() })
    .eq("id", row.id)
    .eq("status", "active")
    .eq("state->>rev", String(row.state.rev))
    .select(COLS);
  const next = ((updated ?? []) as MatchRow[])[0];
  if (next === undefined) return { ok: false, code: "stale_version", message: "畫面已經過期，請重新整理這一局。" };
  const settlement = status === "active" ? null : await settle(svc, next);
  return { ok: true, view: toView(next.id, status, next.state), reveals: step.reveals, settlement, ...(ivySay !== undefined ? { ivySay } : {}) };
}

/** 主動放棄＝認輸（算輸一局）。 */
export async function abandon(svc: Svc, userId: string, matchId: string): Promise<DiceOutcome> {
  const { data: updated } = await svc
    .from("bar_dice_matches")
    .update({ status: "abandoned", updated_at: new Date().toISOString() })
    .eq("id", matchId)
    .eq("user_id", userId)
    .eq("status", "active")
    .select(COLS);
  const row = ((updated ?? []) as MatchRow[])[0];
  if (row === undefined) return { ok: false, code: "not_found", message: "找不到進行中的這一局。" };
  const settlement = await settle(svc, row);
  return { ok: true, view: toView(row.id, "abandoned", row.state), reveals: [], settlement };
}
