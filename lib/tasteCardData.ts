/**
 * AI 口味卡的 IO 層：組輸入（口味設定／公開＋好友打卡聚合／酒保記憶）→ 調模型 → 清洗 → 落緩存。
 * 純邏輯在 lib/tasteCard.ts。私密打卡永不進輸入（卡片公開）。
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { sanitizeBarMemory } from "./barMemory";
import { aggregateTaste, parsePreferences } from "./api/taste";
import { MinimaxError, minimaxChat } from "./minimax";
import {
  buildTasteCardMessages, parseTasteCardReply, pushRefresh, tasteCardNeedsRefresh, tasteCardReady, tasteInputsHash,
  tasteRefreshesLeft, type TasteCard, type TasteInputs,
} from "./tasteCard";

type Row = Record<string, unknown>;

export async function loadTasteInputs(svc: SupabaseClient, userId: string): Promise<TasteInputs> {
  const [{ data: u }, { data: mem }] = await Promise.all([
    svc.from("users").select("preferences").eq("id", userId).maybeSingle(),
    svc.from("bar_memories").select("doc").eq("user_id", userId).maybeSingle(),
  ]);
  let preferences: TasteInputs["preferences"] = null;
  const rawPrefs = (u as Row | null)?.preferences;
  if (rawPrefs !== null && rawPrefs !== undefined) {
    const p = parsePreferences(rawPrefs);
    if ("body" in p) preferences = p.body;
  }
  // 公開＋好友可見的打卡（私密不進；卡片是公開的）
  const vis = ["public", "friends"];
  const [{ data: mainRows }, { data: archRows }] = await Promise.all([
    svc.from("checkins").select("tags,beer_id").eq("user_id", userId).in("visibility", vis),
    svc.from("checkins_archive").select("tags,beer_id").eq("user_id", userId).in("visibility", vis),
  ]);
  const all = [...((mainRows ?? []) as unknown[]), ...((archRows ?? []) as unknown[])] as Row[];
  const beerIds = [...new Set(all.map((r) => r.beer_id).filter((id): id is string => typeof id === "string" && id !== ""))];
  const catByBeer = new Map<string, string>();
  if (beerIds.length > 0) {
    const { data: beers } = await svc.from("beers").select("id,category").in("id", beerIds);
    for (const b of ((beers ?? []) as unknown[]) as Row[]) {
      if (typeof b.id === "string" && typeof b.category === "string") catByBeer.set(b.id, b.category);
    }
  }
  const { groups, sample_count } = aggregateTaste(
    all.map((r) => ({
      tags: Array.isArray(r.tags) ? (r.tags as unknown[]).filter((x): x is string => typeof x === "string") : [],
      beerCategory: typeof r.beer_id === "string" ? (catByBeer.get(r.beer_id) ?? null) : null,
    })),
  );
  const checkins: TasteInputs["checkins"] = sample_count === 0 ? null : {
    sample_count,
    groups: [...groups]
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 6)
      .map((g) => ({ key: g.key, strength: Math.round(g.strength * 100) / 100, items: [...g.items].sort((a, b) => b.strength - a.strength).slice(0, 4).map((i) => i.key) })),
  };
  const doc = sanitizeBarMemory((mem as Row | null)?.doc);
  const memory: TasteInputs["memory"] = doc === null ? null : {
    likes: doc.taste.likes, dislikes: doc.taste.dislikes, drink_types: doc.taste.drink_types, abv: doc.taste.abv,
    style: { tone: doc.style.tone, formality: doc.style.formality, emoji: doc.style.emoji, length: doc.style.length },
    updated_at: doc.updated_at,
  };
  return { preferences, checkins, memory };
}

export type CardRow = { payload: unknown; inputs_hash: string; computed_at: string; visible: boolean; refreshes: unknown };

export async function loadCardRow(svc: SupabaseClient, userId: string): Promise<CardRow | null> {
  const { data, error } = await svc.from("user_taste_cards").select("payload,inputs_hash,computed_at,visible,refreshes").eq("user_id", userId).maybeSingle();
  if (error !== null) {
    // 表未遷移（0059 沒跑）：當沒有，不炸
    console.warn(`[taste-card] load skipped: ${error.code} ${error.message}`);
    return null;
  }
  return data as CardRow | null;
}

export type GenerateOutcome =
  | { status: "ok"; card: TasteCard }
  | { status: "unchanged"; card: TasteCard | null }
  | { status: "not_ready" }
  | { status: "rate_limited" }
  | { status: "failed" };

/**
 * 生成（或沿用）口味卡。force＝用戶手動重新生成（限額 3 次／24h，且輸入沒變也算一次）；
 * 非 force＝自動：只有「沒卡」或「輸入變了且距上次 ≥24h」才重算。資料不夠回 not_ready（不顯示 AI 卡）。
 */
export async function generateTasteCard(
  svc: SupabaseClient,
  userId: string,
  apiKey: string,
  nowMs: number,
  force: boolean,
): Promise<GenerateOutcome> {
  const inputs = await loadTasteInputs(svc, userId);
  if (!tasteCardReady(inputs)) return { status: "not_ready" };
  const hash = tasteInputsHash(inputs);
  const row = await loadCardRow(svc, userId);
  const cachedCard = row !== null && typeof row.payload === "object" ? (row.payload as TasteCard) : null;
  if (!force) {
    if (!tasteCardNeedsRefresh(row === null ? null : { inputs_hash: row.inputs_hash, computed_at: row.computed_at }, hash, nowMs)) {
      return { status: "unchanged", card: cachedCard };
    }
  } else if (row !== null && tasteRefreshesLeft(row.refreshes, nowMs) < 1) {
    return { status: "rate_limited" };
  }
  const disliked = inputs.preferences?.dislikes ?? [];
  let card: TasteCard | null = null;
  for (let attempt = 0; attempt < 2 && card === null; attempt += 1) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 30_000);
      try {
        const reply = await minimaxChat(buildTasteCardMessages(inputs), {
          apiKey, maxTokens: 1500, temperature: 0.7,
          fetchFn: (url, init) => fetch(url, { ...init, signal: ctrl.signal }),
        });
        card = parseTasteCardReply(reply, disliked, new Date(nowMs).toISOString());
      } finally {
        clearTimeout(timer);
      }
    } catch (e) {
      console.error(`[taste-card] model failed: ${e instanceof MinimaxError ? e.status : e instanceof Error ? e.message : "unknown"}`);
    }
  }
  if (card === null) return { status: "failed" };
  const { error } = await svc.from("user_taste_cards").upsert(
    {
      user_id: userId,
      payload: card,
      inputs_hash: hash,
      computed_at: new Date(nowMs).toISOString(),
      visible: row?.visible ?? true,
      refreshes: force ? pushRefresh(row?.refreshes, nowMs) : (row?.refreshes ?? []),
    },
    { onConflict: "user_id" },
  );
  if (error !== null) {
    console.error(`[taste-card] save failed: ${error.code} ${error.message}`);
    return { status: "failed" };
  }
  return { status: "ok", card };
}
