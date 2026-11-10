/**
 * Bar 21點的存取與結算（IO 層）：bar_blackjack_matches 是服務端權威（RLS 無 policy，只經 service_role）。
 * 狀態機在 lib/barBlackjack.ts；積分入帳／扣次是 SQL 函數（冪等：同一局只會結算一次）。
 *
 * Ivy 的回合採「逐步」：我停牌後 phase=ivy，客戶端每步發一次 `ivy_step`，每次只調一次 AI（一個決定＋一句話），
 * 請求短、「Ivy 諗緊…」動畫對得上真實延遲。斷線規則：Ivy 回合卡住超過 ivyStallSeconds，sweep 用兜底演算法替她打完，
 * 並按**真實結果**結算（不算放棄）；我的回合超過 staleMinutes 沒動作才算放棄（輸）。
 */
import type { createServiceClient } from "@/lib/supabase/server";

import {
  applyIvy,
  applyPlayer,
  autoFinishIvy,
  BAR_BJ,
  chooseByProbability,
  cryptoRng,
  ivyCandidates,
  newRound,
  standSpeed,
  statusFor,
  toView,
  type BjState,
  type BjView,
  type IvyMoveKind,
} from "./barBlackjack";
import { ivyBjAiPick } from "./barBlackjackAi";
import { BAR_CREDIT, ensureStarterCredit, getBarCredits, parseBarCredits, type BarCredits } from "./barCredits";
import { parseLang, sanitizeSaid } from "./barDiceAi";
import { BAR_GAMES, countGamesToday, gamesCapMessage } from "./barGames";

type Svc = Awaited<ReturnType<typeof createServiceClient>>;
type MatchStatus = "active" | "won" | "lost" | "push" | "abandoned";

type MatchRow = {
  id: string;
  user_id: string;
  status: MatchStatus;
  state: BjState;
  credits: unknown;
  created_at: string;
  updated_at: string;
  settled_at: string | null;
};

export type BjSettlement = {
  result: "won" | "lost" | "push" | "abandoned";
  /** 這局造成的次數變化（贏為正＝實際入帳；輸／放棄為負＝實際扣掉；和、或今日贏局已滿的輸局為 0） */
  delta: number;
  /** 沒入帳／沒扣的原因：daily_cap／balance_cap／win_cap（今日贏局已滿，輸了不扣）／duplicate */
  reason: string | null;
  credits: BarCredits | null;
};

export type BjOutcome =
  | { ok: true; view: BjView; settlement: BjSettlement | null; ivyMove?: IvyMoveKind; ivySay?: string }
  | { ok: false; code: "not_found" | "stale_version" | "wrong_phase" | "invalid_action" | "rate_limited" | "internal"; message: string };

const COLS = "id,user_id,status,state,credits,created_at,updated_at,settled_at";

async function settle(svc: Svc, row: MatchRow): Promise<BjSettlement | null> {
  if (row.status === "active") return null;
  await ensureStarterCredit(svc, row.user_id);
  let settlement: BjSettlement;
  if (row.status === "won") {
    const { data, error } = await svc.rpc("bar_credit_grant_win", {
      p_user: row.user_id,
      p_n: BAR_CREDIT.winGrant,
      p_match: row.id,
      p_kind: "blackjack_win",
      p_lot_days: BAR_CREDIT.lotDays,
      p_wins_cap: BAR_CREDIT.winsCapPerDay,
      p_balance_cap: BAR_CREDIT.balanceCap,
      p_daily_limit: BAR_CREDIT.dailyLimit,
    });
    if (error !== null) {
      console.error(`[bar-blackjack] grant failed: ${error.message}`);
      return null;
    }
    const d = data as { granted?: number; reason?: string; credits?: unknown };
    settlement = {
      result: "won",
      delta: typeof d.granted === "number" ? d.granted : 0,
      reason: d.reason === "ok" || d.reason === undefined ? null : d.reason,
      credits: parseBarCredits(d.credits),
    };
  } else if (row.status === "push") {
    settlement = { result: "push", delta: 0, reason: null, credits: await getBarCredits(svc, row.user_id) };
  } else {
    const { data, error } = await svc.rpc("bar_credit_game_loss", {
      p_user: row.user_id,
      p_kind: "blackjack_loss",
      p_ref: row.id,
      p_wins_cap: BAR_CREDIT.winsCapPerDay,
      p_daily_limit: BAR_CREDIT.dailyLimit,
    });
    if (error !== null) {
      console.error(`[bar-blackjack] loss spend failed: ${error.message}`);
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
  await svc.from("bar_blackjack_matches").update({ credits: settlement, settled_at: new Date().toISOString() }).eq("id", row.id);
  return settlement;
}

/** 寫回新狀態（樂觀並發：rev 沒變、仍是 active 才寫），回新列或 null（＝別處先改了） */
async function save(svc: Svc, row: MatchRow, next: BjState): Promise<MatchRow | null> {
  const status = statusFor(next);
  const { data } = await svc
    .from("bar_blackjack_matches")
    .update({ state: next, status, updated_at: new Date().toISOString() })
    .eq("id", row.id)
    .eq("status", "active")
    .eq("state->>rev", String(row.state.rev))
    .select(COLS);
  return ((data ?? []) as MatchRow[])[0] ?? null;
}

/** 處理掉：已結束但沒結算的、我的回合太久沒動作的（放棄＝輸）、Ivy 回合卡住的（替她打完，按真實結果結算）。 */
async function sweep(svc: Svc, userId: string): Promise<void> {
  const now = Date.now();
  const { data: act } = await svc.from("bar_blackjack_matches").select(COLS).eq("user_id", userId).eq("status", "active").maybeSingle();
  const row = act as MatchRow | null;
  if (row !== null) {
    const idleMs = now - new Date(row.updated_at).getTime();
    if (row.state.phase === "player" && idleMs > BAR_BJ.staleMinutes * 60_000) {
      const { data: upd } = await svc
        .from("bar_blackjack_matches")
        .update({ status: "abandoned", updated_at: new Date().toISOString() })
        .eq("id", row.id)
        .eq("status", "active")
        .select(COLS);
      const a = ((upd ?? []) as MatchRow[])[0];
      if (a !== undefined) await settle(svc, a);
    } else if (row.state.phase === "ivy" && idleMs > BAR_BJ.ivyStallSeconds * 1000) {
      const finished = autoFinishIvy(row.state, cryptoRng);
      const saved = await save(svc, row, finished);
      if (saved !== null) await settle(svc, saved);
    }
  }
  const { data } = await svc.from("bar_blackjack_matches").select(COLS).eq("user_id", userId).neq("status", "active").is("settled_at", null).limit(5);
  for (const r of (data ?? []) as MatchRow[]) await settle(svc, r);
}

async function activeRow(svc: Svc, userId: string): Promise<MatchRow | null> {
  const { data } = await svc.from("bar_blackjack_matches").select(COLS).eq("user_id", userId).eq("status", "active").maybeSingle();
  return (data as MatchRow | null) ?? null;
}

/** 開一鋪（已有進行中的就接回）。大話骰＋21點每日合計最多 BAR_GAMES.startsPerDay 局。 */
export async function startRound(svc: Svc, userId: string): Promise<BjOutcome> {
  await sweep(svc, userId);
  const existing = await activeRow(svc, userId);
  if (existing !== null) return { ok: true, view: toView(existing.id, "active", existing.state), settlement: null };
  const today = await countGamesToday(svc, userId);
  if (today.total >= BAR_GAMES.startsPerDay) return { ok: false, code: "rate_limited", message: gamesCapMessage() };
  const state = newRound(cryptoRng);
  const status = statusFor(state);
  const { data, error } = await svc.from("bar_blackjack_matches").insert({ user_id: userId, status, state }).select(COLS).single();
  if (error !== null || data === null) {
    const again = await activeRow(svc, userId);
    if (again !== null) return { ok: true, view: toView(again.id, "active", again.state), settlement: null };
    console.error(`[bar-blackjack] insert failed: ${error?.message ?? "no row"}`);
    return { ok: false, code: "internal", message: "開局失敗，請稍後再試。" };
  }
  const row = data as MatchRow;
  // 我 Blackjack：開局即結束，馬上結算
  const settlement = status === "active" ? null : await settle(svc, row);
  return { ok: true, view: toView(row.id, status, row.state), settlement };
}

export async function getActive(svc: Svc, userId: string): Promise<BjView | null> {
  await sweep(svc, userId);
  const row = await activeRow(svc, userId);
  return row === null ? null : toView(row.id, "active", row.state);
}

export type BjAction = { type: "hit" | "stand" | "double" } | { type: "ivy_step"; said?: unknown; lang?: unknown };

export async function act(svc: Svc, userId: string, matchId: string, action: BjAction): Promise<BjOutcome> {
  const { data } = await svc.from("bar_blackjack_matches").select(COLS).eq("id", matchId).eq("user_id", userId).maybeSingle();
  const row = data as MatchRow | null;
  if (row === null) return { ok: false, code: "not_found", message: "找不到這局。" };
  if (row.status !== "active") return { ok: false, code: "wrong_phase", message: "這局已經結束。" };

  let nextState: BjState;
  let ivyMove: IvyMoveKind | undefined;
  let ivySay: string | undefined;
  if (action.type === "ivy_step") {
    if (row.state.phase !== "ivy") return { ok: false, code: "wrong_phase", message: "現在不是 Ivy 的回合。" };
    const { candidates, forced } = ivyCandidates(row.state, cryptoRng);
    let move: IvyMoveKind;
    if (forced !== null) {
      move = forced; // 明顯的一步（≤11 必要、≥21 必停）：不問 AI，用預寫台詞
    } else {
      move = chooseByProbability(candidates); // 兜底
      const apiKey = process.env.minimaxi_api_key ?? process.env.MINIMAXI_API_KEY ?? "";
      if (apiKey !== "") {
        const r = await ivyBjAiPick({
          apiKey,
          lang: parseLang(action.lang),
          ivy: row.state.ivy,
          myCount: row.state.me.length,
          speed: standSpeed(row.state),
          candidates,
          said: sanitizeSaid(action.said),
        });
        const chosen = r === null ? undefined : candidates[r.pick];
        if (r !== null && chosen !== undefined) {
          move = chosen.move;
          ivySay = r.say;
        }
      }
    }
    const step = applyIvy(row.state, move);
    if (!step.ok) return { ok: false, code: step.code, message: step.message };
    nextState = step.state;
    ivyMove = move;
  } else {
    const step = applyPlayer(row.state, action.type, Date.now());
    if (!step.ok) return { ok: false, code: step.code, message: step.message };
    nextState = step.state;
  }
  const next = await save(svc, row, nextState);
  if (next === null) return { ok: false, code: "stale_version", message: "畫面已經過期，請重新整理這一局。" };
  const status = statusFor(next.state);
  const settlement = status === "active" ? null : await settle(svc, { ...next, status });
  return { ok: true, view: toView(next.id, status, next.state), settlement, ...(ivyMove !== undefined ? { ivyMove } : {}), ...(ivySay !== undefined ? { ivySay } : {}) };
}

/** 主動離場＝認輸（算輸一局；達到今日贏局上限時不扣）。 */
export async function abandon(svc: Svc, userId: string, matchId: string): Promise<BjOutcome> {
  const { data: updated } = await svc
    .from("bar_blackjack_matches")
    .update({ status: "abandoned", updated_at: new Date().toISOString() })
    .eq("id", matchId)
    .eq("user_id", userId)
    .eq("status", "active")
    .select(COLS);
  const row = ((updated ?? []) as MatchRow[])[0];
  if (row === undefined) return { ok: false, code: "not_found", message: "找不到進行中的這一局。" };
  const settlement = await settle(svc, row);
  return { ok: true, view: toView(row.id, "abandoned", row.state), settlement };
}
