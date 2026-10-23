/**
 * UR H.1 房间 helpers（第二批）。
 * 全表 RLS 零 policy（0042，沿 push_log）→ game_* 读写一律 service client；
 * authed client 只做"我是谁"（getAuthedClient 的 userId），绝不拿它读 game 表
 * （沿 DEF-20261010-001 判例：RLS 静默少行，用成员表推导对方必须走 service）。
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { apiError } from "../api/envelope";
import {
  deriveOnesBroken,
  minAutoBid,
  nextTurn,
  parseRules,
  resolveChallenge,
  rollDice,
  type LiarsRules,
} from "./liars";
import { parseSpyRules, type SpyRules } from "./spy";
import { applySpyLeave } from "./spyStore";
import { parseTrainRules, type TrainRules } from "./train";
import { applyTrainLeave } from "./trainStore";
import { parseShipoRules, SHIPO_MAX_PLAYERS, SHIPO_MIN_PLAYERS, type ShipoRules } from "./shipo";
import { applyShipoLeave } from "./shipoStore";

export const ROOM_TTL_MS = 2 * 3600_000;
export const ROOM_DELETE_AFTER_END_MS = 24 * 3600_000;
export const ROOM_CREATE_HOURLY_LIMIT = 10;

export type GameRoomStatus = "lobby" | "playing" | "ended";

export type RoomRow = {
  id: string;
  code: string;
  game: string;
  host_id: string;
  status: string;
  rules: unknown;
  max_players: number;
  version: number;
  expires_at: string;
  ended_at: string | null;
};

export type RoomJson = {
  id: string;
  code: string;
  game: string;
  host_id: string;
  status: GameRoomStatus;
  /** liars_dice＝LiarsRules；spy＝SpyRules（UR H.3）；last_train＝TrainRules（UR H.4） */
  rules: LiarsRules | SpyRules | TrainRules | ShipoRules;
  max_players: number;
  version: number;
  expires_at: string;
};

/** 行映射（坏行回 null，调用方跳过／500，沿 toFriendListItem 口径）。 */
export function toRoomJson(raw: unknown): RoomJson | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || r.id === "") return null;
  if (typeof r.code !== "string" || r.code === "") return null;
  if (typeof r.host_id !== "string" || r.host_id === "") return null;
  if (r.status !== "lobby" && r.status !== "playing" && r.status !== "ended") return null;
  if (typeof r.max_players !== "number") return null;
  if (typeof r.version !== "number") return null;
  if (typeof r.expires_at !== "string") return null;
  const game = typeof r.game === "string" ? r.game : "liars_dice";
  return {
    id: r.id,
    code: r.code,
    game,
    host_id: r.host_id,
    status: r.status,
    rules: game === "spy" ? parseSpyRules(r.rules) : game === "last_train" ? parseTrainRules(r.rules) : game === "shipo" ? parseShipoRules(r.rules) : parseRules(r.rules),
    max_players: r.max_players,
    version: r.version,
    expires_at: r.expires_at,
  };
}

export function parseRoomId(raw: unknown): { id: string } | { error: string } {
  if (typeof raw !== "string" || raw.trim() === "" || raw.trim().length > 64) {
    return { error: "房间 id 非法" };
  }
  return { id: raw.trim() };
}

export function parseCreateBody(
  raw: unknown,
): { game: string; maxPlayers: number; rules: LiarsRules | SpyRules | TrainRules | ShipoRules } | { error: string } {
  if (typeof raw !== "object" || raw === null) return { error: "body 需为对象" };
  const r = raw as Record<string, unknown>;
  const game = typeof r.game === "string" ? r.game : "liars_dice";
  if (game !== "liars_dice" && game !== "spy" && game !== "last_train" && game !== "shipo") return { error: "game 只要 liars_dice|spy|last_train|shipo" };
  const maxPlayers =
    r.max_players === undefined
      ? 6
      : typeof r.max_players === "number" && Number.isInteger(r.max_players)
        ? r.max_players
        : -1;
  if (game === "spy") {
    // 誰是臥底 4–8 人（默認 6）；人數下限在開局時再驗（大廳可以先 2–3 人等人）
    const spyMax = r.max_players === undefined ? 6 : maxPlayers;
    if (spyMax < 4 || spyMax > 8) return { error: "spy 的 max_players 只要 4-8" };
    return { game, maxPlayers: spyMax, rules: parseSpyRules(r.rules) };
  }
  if (game === "shipo") {
    // 老實人·識破 4–6 人（默認 6）；人數下限在開局時再驗
    const shipoMax = r.max_players === undefined ? SHIPO_MAX_PLAYERS : maxPlayers;
    if (shipoMax < SHIPO_MIN_PLAYERS || shipoMax > SHIPO_MAX_PLAYERS) {
      return { error: `shipo 的 max_players 只要 ${SHIPO_MIN_PLAYERS}-${SHIPO_MAX_PLAYERS}` };
    }
    return { game, maxPlayers: shipoMax, rules: parseShipoRules(r.rules) };
  }
  if (game === "last_train") {
    // 尾班車 3–8 人（默認 6）；人數下限在開局時再驗
    const trainMax = r.max_players === undefined ? 6 : maxPlayers;
    if (trainMax < 3 || trainMax > 8) return { error: "last_train 的 max_players 只要 3-8" };
    return { game, maxPlayers: trainMax, rules: parseTrainRules(r.rules) };
  }
  if (maxPlayers < 2 || maxPlayers > 8) return { error: "max_players 只要 2-8" };
  return { game, maxPlayers, rules: parseRules(r.rules) };
}

/** 房间码归一（去空＋大写；形状错即 error，不进库猜）。 */
export function parseJoinCode(raw: unknown): { code: string } | { error: string } {
  if (typeof raw !== "object" || raw === null) return { error: "body 需为对象" };
  const c = (raw as Record<string, unknown>).code;
  if (typeof c !== "string" || c.trim() === "") return { error: "code 必填" };
  const code = c.trim().toUpperCase();
  if (code.length !== 6) return { error: "code 非法" };
  return { code };
}

export function parseReadyBody(raw: unknown): { ready: boolean } | { error: string } {
  if (typeof raw !== "object" || raw === null) return { error: "body 需为对象" };
  const v = (raw as Record<string, unknown>).ready;
  if (typeof v !== "boolean") return { error: "ready 只要 boolean" };
  return { ready: v };
}

export function parseKickBody(raw: unknown): { userId: string; block: boolean } | { error: string } {
  if (typeof raw !== "object" || raw === null) return { error: "body 需为对象" };
  const v = (raw as Record<string, unknown>).user_id;
  if (typeof v !== "string" || v.trim() === "" || v.trim().length > 64) {
    return { error: "user_id 非法" };
  }
  return { userId: v.trim(), block: (raw as Record<string, unknown>).block === true };
}

export type PlayerRow = {
  room_id: string;
  user_id: string;
  seat: number;
  ready: boolean;
  status: string;
  joined_at: string;
  last_seen_at: string;
};

function asPlayerRows(data: unknown): PlayerRow[] {
  const out: PlayerRow[] = [];
  for (const r of ((data ?? []) as unknown[]) as Record<string, unknown>[]) {
    if (typeof r.room_id !== "string" || typeof r.user_id !== "string") continue;
    out.push({
      room_id: r.room_id,
      user_id: r.user_id,
      seat: typeof r.seat === "number" ? r.seat : 0,
      ready: r.ready === true,
      status: typeof r.status === "string" ? r.status : "active",
      joined_at: typeof r.joined_at === "string" ? r.joined_at : "",
      last_seen_at: typeof r.last_seen_at === "string" ? r.last_seen_at : "",
    });
  }
  return out;
}

/** 我所在的非 ended 房间（同时至多 1 个；取最近）。 */
export async function getActiveRoomId(
  svc: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data } = await svc
    .from("game_room_players")
    .select("room_id,joined_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("joined_at", { ascending: false })
    .limit(5);
  const rows = ((data ?? []) as unknown[]) as { room_id?: unknown }[];
  for (const r of rows) {
    if (typeof r.room_id !== "string") continue;
    const { data: room } = await svc
      .from("game_rooms")
      .select("id")
      .eq("id", r.room_id)
      .neq("status", "ended")
      .maybeSingle();
    if (room !== null) return r.room_id;
  }
  return null;
}

export async function getActiveMembers(
  svc: SupabaseClient,
  roomId: string,
): Promise<PlayerRow[]> {
  const { data } = await svc
    .from("game_room_players")
    .select("room_id,user_id,seat,ready,status,joined_at,last_seen_at")
    .eq("room_id", roomId)
    .eq("status", "active")
    .order("seat", { ascending: true });
  return asPlayerRows(data);
}

export async function getPlayerRow(
  svc: SupabaseClient,
  roomId: string,
  userId: string,
): Promise<PlayerRow | null> {
  const { data } = await svc
    .from("game_room_players")
    .select("room_id,user_id,seat,ready,status,joined_at,last_seen_at")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();
  if (data === null || typeof data !== "object") return null;
  const rows = asPlayerRows([data]);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * 过期懒处理（无 cron：每次房间读写前调）。
 * - expires_at 已过且未 ended → ended（局中亦结，事件留痕由调用方补版本事件；此处只翻状态）。
 * - ended 超过 24h → 硬删（结算随房间级联走，不进档案，沿交接 §一-3）。
 */
export async function purgeExpiredRooms(
  svc: SupabaseClient,
  nowMs: number,
): Promise<void> {
  const expiredIso = new Date(nowMs).toISOString();
  await svc
    .from("game_rooms")
    .update({ status: "ended", ended_at: expiredIso })
    .neq("status", "ended")
    .lt("expires_at", expiredIso);
  const deleteBefore = new Date(nowMs - ROOM_DELETE_AFTER_END_MS).toISOString();
  await svc.from("game_rooms").delete().eq("status", "ended").lt("ended_at", deleteBefore);
}

/** 双向 accepted 即好友（沿 areFriends 口径内联，vitest 无 @/ 别名不跨包引）。 */
export async function isFriend(
  svc: SupabaseClient,
  a: string,
  b: string,
): Promise<boolean> {
  if (a === b) return false;
  const { data } = await svc
    .from("friendships")
    .select("user_id,friend_id,status")
    .eq("status", "accepted")
    .or(`and(user_id.eq.${a},friend_id.eq.${b}),and(user_id.eq.${b},friend_id.eq.${a})`)
    .limit(1);
  return Array.isArray(data) && data.length > 0;
}

/**
 * 同酒局口径（问答定案）：存在任一活跃 party（open＋未过期），两人同为
 * host 或 joins 成员。host 本人未必有 joins 行，两边都要算。
 */
export async function sharesActiveParty(
  svc: SupabaseClient,
  a: string,
  b: string,
  nowMs: number,
): Promise<boolean> {
  if (a === b) return false;
  const nowIso = new Date(nowMs).toISOString();
  const partyIdsOf = async (u: string): Promise<Set<string>> => {
    const out = new Set<string>();
    const [{ data: hosted }, { data: joined }] = await Promise.all([
      svc.from("parties").select("id").eq("host_user_id", u).eq("status", "open").gt("expires_at", nowIso).limit(50),
      svc.from("joins").select("party_id").eq("user_id", u).limit(200),
    ]);
    for (const r of ((hosted ?? []) as unknown[]) as { id?: unknown }[]) {
      if (typeof r.id === "string") out.add(r.id);
    }
    const pids = (((joined ?? []) as unknown[]) as { party_id?: unknown }[])
      .map((r) => r.party_id)
      .filter((id): id is string => typeof id === "string");
    if (pids.length > 0) {
      const { data: live } = await svc
        .from("parties")
        .select("id")
        .in("id", pids)
        .eq("status", "open")
        .gt("expires_at", nowIso);
      for (const r of ((live ?? []) as unknown[]) as { id?: unknown }[]) {
        if (typeof r.id === "string") out.add(r.id);
      }
    }
    return out;
  };
  const [mine, theirs] = await Promise.all([partyIdsOf(a), partyIdsOf(b)]);
  for (const id of mine) {
    if (theirs.has(id)) return true;
  }
  return false;
}

/** 拉黑／解友任一方向（cheers_blocks 手动＋chat_mutes 自动，双表沿 B.3）。 */
export async function hasBlockOrMute(
  svc: SupabaseClient,
  a: string,
  b: string,
): Promise<boolean> {
  const or = `and(blocker_id.eq.${a},blocked_id.eq.${b}),and(blocker_id.eq.${b},blocked_id.eq.${a})`;
  const [{ data: blocks }, { data: mutes }] = await Promise.all([
    svc.from("cheers_blocks").select("blocker_id").or(or).limit(1),
    svc.from("chat_mutes").select("blocker_id").or(or).limit(1),
  ]);
  return (Array.isArray(blocks) && blocks.length > 0) || (Array.isArray(mutes) && mutes.length > 0);
}

/**
 * 版本事件（失败只记 log，不拦主流程；version 由调用方定）。
 */
export async function appendEvent(
  svc: SupabaseClient,
  roomId: string,
  version: number,
  type: string,
  actorId: string | null,
  payload: Record<string, unknown>,
  clientActionId?: string,
): Promise<void> {
  const { error } = await svc.from("game_events").insert({
    room_id: roomId,
    version,
    type,
    actor_id: actorId,
    payload,
    client_action_id: clientActionId ?? null,
  });
  if (error !== null) {
    console.error(`[games] event error: code=${error.code} message=${error.message}`);
  }
}

/**
 * 成员门禁一体（各成员端点共用，防六处分叉）。
 * 成功回 `{room, members, me}`；失败回 `{response}`（调用方直接 return）。
 * - 房不在／已结束：ended 按 409 wrong_phase（结算看 batch-3 的 GET，不在本口重开）。
 * - 非 active 成员：404 room_not_found（不泄房间存在性）。
 */
export async function loadRoomAsMember(
  svc: SupabaseClient,
  roomIdRaw: unknown,
  userId: string,
): Promise<
  { room: RoomJson; members: PlayerRow[]; me: PlayerRow } | { response: Response }
> {
  const parsed = parseRoomId(roomIdRaw);
  if ("error" in parsed) {
    return { response: apiError("invalid_params", parsed.error, 400) };
  }
  const { data: roomRaw } = await svc
    .from("game_rooms")
    .select("id,code,game,host_id,status,rules,max_players,version,expires_at,ended_at")
    .eq("id", parsed.id)
    .maybeSingle();
  const room = toRoomJson(roomRaw);
  if (room === null) {
    return { response: apiError("room_not_found", "房間不存在", 404) };
  }
  if (room.status === "ended") {
    return { response: apiError("wrong_phase", "房間已結束", 409) };
  }
  const members = await getActiveMembers(svc, room.id);
  const me = members.find((m) => m.user_id === userId) ?? null;
  if (me === null) {
    return { response: apiError("room_not_found", "房間不存在", 404) };
  }
  return { room, members, me };
}

/** 房主门（loadRoomAsMember 之后，非房主 403 not_host）。 */
export function requireHost<T extends { room: RoomJson }>(
  loaded: T,
  userId: string,
): { response: Response } | null {
  if (loaded.room.host_id !== userId) {
    return { response: apiError("not_host", "只有房主可操作", 403) };
  }
  return null;
}

type Departure = {
  room: RoomJson;
  members: PlayerRow[];
};

/**
 * 离场善后（leave／kick 共用，调用方先改好离场者 status）。
 * - 房主走→座位最小 active 接任（event）；无人→ended。
 * - 局中走：当前轮到他→顺延下一家（deadline 重置一窗）；剩 <2 人→ended。
 * - 大厅走光→ended。回新 version（失败回 response）。
 */
export async function applyDeparture(
  svc: SupabaseClient,
  dep: Departure,
  leaverId: string,
  eventType: "member_left" | "member_kicked",
  actorId: string,
  nowMs: number,
): Promise<{ version: number } | { response: Response }> {
  const remaining = dep.members
    .filter((m) => m.user_id !== leaverId)
    .sort((a, b) => a.seat - b.seat);
  let hostId = dep.room.host_id;
  let hostEvent: Record<string, unknown> | null = null;
  if (leaverId === dep.room.host_id) {
    if (remaining.length === 0) {
      const { error } = await svc
        .from("game_rooms")
        .update({ status: "ended", ended_at: new Date(nowMs).toISOString() })
        .eq("id", dep.room.id);
      if (error !== null) {
        console.error(`[games] end-empty error: code=${error.code} message=${error.message}`);
        return { response: apiError("internal", "離開失敗", 500) };
      }
      const version = await bumpRoom(svc, dep.room.id, dep.room.version, nowMs);
      if (version === null) return { response: apiError("internal", "離開失敗", 500) };
      await appendEvent(svc, dep.room.id, version, "room_ended", actorId, { reason: "empty" });
      return { version };
    }
    hostId = remaining[0].user_id;
    const { error } = await svc.from("game_rooms").update({ host_id: hostId }).eq("id", dep.room.id);
    if (error !== null) {
      console.error(`[games] host-transfer error: code=${error.code} message=${error.message}`);
      return { response: apiError("internal", "離開失敗", 500) };
    }
    hostEvent = { new_host_id: hostId };
  }
  if (dep.room.status === "playing") {
    if (remaining.length < 2) {
      // §十二：deal_only 房剩 <2 人→回 lobby（留守继续邀人重开），standard 房照旧 ended。
      if (parseRules(dep.room.rules).mode === "deal_only") {
        const { error } = await svc
          .from("game_rooms")
          .update({ status: "lobby", ended_at: null })
          .eq("id", dep.room.id);
        if (error !== null) {
          console.error(`[games] back-to-lobby error: code=${error.code} message=${error.message}`);
          return { response: apiError("internal", "離開失敗", 500) };
        }
        // 留守全员未准备（旧局保留但 GET lobby 不下发，重开即新局）。
        const { error: rErr } = await svc
          .from("game_room_players")
          .update({ ready: false })
          .eq("room_id", dep.room.id)
          .eq("status", "active");
        if (rErr !== null) {
          console.error(`[games] unready error: code=${rErr.code} message=${rErr.message}`);
          return { response: apiError("internal", "離開失敗", 500) };
        }
        const version = await bumpRoom(svc, dep.room.id, dep.room.version, nowMs);
        if (version === null) return { response: apiError("internal", "離開失敗", 500) };
        await appendEvent(svc, dep.room.id, version, "back_to_lobby", actorId, {
          reason: "too_few",
          ...(hostEvent !== null ? { host_transferred: hostEvent } : {}),
        });
        return { version };
      }
      const { error } = await svc
        .from("game_rooms")
        .update({ status: "ended", ended_at: new Date(nowMs).toISOString() })
        .eq("id", dep.room.id);
      if (error !== null) {
        console.error(`[games] end-few error: code=${error.code} message=${error.message}`);
        return { response: apiError("internal", "離開失敗", 500) };
      }
      const version = await bumpRoom(svc, dep.room.id, dep.room.version, nowMs);
      if (version === null) return { response: apiError("internal", "離開失敗", 500) };
      await appendEvent(svc, dep.room.id, version, "room_ended", actorId, { reason: "too_few" });
      return { version };
    }
    // UR H.3：誰是臥底房離場＝出局（輪到他發言→換人、投票中清票、之後判勝負）。臥底房沒有 game_rounds，下面的骰局順延自然是空操作。
    if (dep.room.game === "spy") await applySpyLeave(svc, dep.room.id, leaverId, nowMs);
    // UR H.4：尾班車房離場＝從座位序移除（拿著車的人離場→車交給下一位）
    if (dep.room.game === "last_train") await applyTrainLeave(svc, dep.room.id, leaverId);
    // 識破房離場：在場不足 3 人直接結束；老實人／想想離場本輪作廢
    if (dep.room.game === "shipo") await applyShipoLeave(svc, dep.room.id, leaverId, nowMs);
    // 轮到离场者→顺延（座位次序含离场者本人的环，下一家必为他人）。
    const { data: roundRaw } = await svc
      .from("game_rounds")
      .select("id,current_turn_user")
      .eq("room_id", dep.room.id)
      .order("no", { ascending: false })
      .limit(1)
      .maybeSingle();
    const round = roundRaw as { id: string; current_turn_user: string | null } | null;
    let nextTurnId: string | null = null;
    if (round !== null && round.current_turn_user === leaverId) {
      const order = [...dep.members].sort((a, b) => a.seat - b.seat).map((m) => m.user_id);
      const nxt = nextTurn(order, leaverId);
      if (nxt !== null && nxt !== leaverId) {
        nextTurnId = nxt;
        const rules = parseRules(dep.room.rules);
        const { error } = await svc
          .from("game_rounds")
          .update({
            current_turn_user: nxt,
            turn_deadline:
              rules.turn_seconds > 0
                ? new Date(nowMs + rules.turn_seconds * 1000).toISOString()
                : null,
          })
          .eq("id", round.id);
        if (error !== null) {
          console.error(`[games] turn-advance error: code=${error.code} message=${error.message}`);
          return { response: apiError("internal", "離開失敗", 500) };
        }
      }
    }
    const version = await bumpRoom(svc, dep.room.id, dep.room.version, nowMs);
    if (version === null) return { response: apiError("internal", "離開失敗", 500) };
    await appendEvent(svc, dep.room.id, version, eventType, actorId, {
      user_id: leaverId,
      ...(hostEvent !== null ? { host_transferred: hostEvent } : {}),
      ...(nextTurnId !== null ? { next_turn_user: nextTurnId } : {}),
    });
    return { version };
  }
  const version = await bumpRoom(svc, dep.room.id, dep.room.version, nowMs);
  if (version === null) return { response: apiError("internal", "離開失敗", 500) };
  await appendEvent(svc, dep.room.id, version, eventType, actorId, {
    user_id: leaverId,
    ...(hostEvent !== null ? { host_transferred: hostEvent } : {}),
  });
  return { version };
}

/**
 * 续期＋版本 +1（返回新 version；行不在即 null）。
 * 无操作 2h 窗：每次成员有效读写都调。
 */
export async function bumpRoom(
  svc: SupabaseClient,
  roomId: string,
  currentVersion: number,
  nowMs: number,
): Promise<number | null> {
  const next = currentVersion + 1;
  const { data, error } = await svc
    .from("game_rooms")
    .update({
      version: next,
      expires_at: new Date(nowMs + ROOM_TTL_MS).toISOString(),
    })
    .eq("id", roomId)
    .select("version")
    .maybeSingle();
  if (error !== null || data === null) {
    if (error !== null) {
      console.error(`[games] bump error: code=${error.code} message=${error.message}`);
    }
    return null;
  }
  return (data as { version: number }).version;
}

/* ---- 第三批：回合状态机（懒超时＋动作执行，路由共用） ---- */

export type RoundBid = {
  user_id: string;
  qty: number;
  face: number;
  zhai: boolean;
  at: string;
};

export type RoundResult = {
  dice: Record<string, number[]>;
  challenger_id: string;
  /** 标准房为叫骰人；deal_only 房 null（不判输赢，§九）。 */
  bidder_id: string | null;
  counted: number | null;
  bid_met: boolean | null;
  loser_id: string | null;
  revealed_at: string;
  confirmations: string[];
};

export type RoundRow = {
  id: string;
  room_id: string;
  no: number;
  starter_id: string;
  status: string;
  dice: Record<string, number[]>;
  current_turn_user: string | null;
  turn_deadline: string | null;
  last_bid: { user_id: string; qty: number; face: number; zhai: boolean } | null;
  bids: RoundBid[];
  loser_id: string | null;
  result: RoundResult | null;
};

function asDice(raw: unknown): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  if (typeof raw !== "object" || raw === null) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(v) && v.every((n): n is number => typeof n === "number")) {
      out[k] = v;
    }
  }
  return out;
}

function asBids(raw: unknown): RoundBid[] {
  if (!Array.isArray(raw)) return [];
  const out: RoundBid[] = [];
  for (const b of raw as Record<string, unknown>[]) {
    if (
      typeof b.user_id === "string" &&
      typeof b.qty === "number" &&
      typeof b.face === "number"
    ) {
      out.push({
        user_id: b.user_id,
        qty: b.qty,
        face: b.face,
        zhai: b.zhai === true,
        at: typeof b.at === "string" ? b.at : "",
      });
    }
  }
  return out;
}

/** 最新局（no 倒序首行；无即 null）。 */
export async function getLatestRound(
  svc: SupabaseClient,
  roomId: string,
): Promise<RoundRow | null> {
  const { data } = await svc
    .from("game_rounds")
    .select("id,room_id,no,starter_id,status,dice,current_turn_user,turn_deadline,last_bid,bids,loser_id,result")
    .eq("room_id", roomId)
    .order("no", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (data === null || typeof data !== "object") return null;
  const r = data as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.room_id !== "string") return null;
  const lastBid =
    typeof r.last_bid === "object" && r.last_bid !== null
      ? (r.last_bid as { user_id?: unknown; qty?: unknown; face?: unknown; zhai?: unknown })
      : null;
  return {
    id: r.id,
    room_id: r.room_id,
    no: typeof r.no === "number" ? r.no : 1,
    starter_id: typeof r.starter_id === "string" ? r.starter_id : "",
    status: typeof r.status === "string" ? r.status : "bidding",
    dice: asDice(r.dice),
    current_turn_user: typeof r.current_turn_user === "string" ? r.current_turn_user : null,
    turn_deadline: typeof r.turn_deadline === "string" ? r.turn_deadline : null,
    last_bid:
      lastBid !== null &&
      typeof lastBid.user_id === "string" &&
      typeof lastBid.qty === "number" &&
      typeof lastBid.face === "number"
        ? { user_id: lastBid.user_id, qty: lastBid.qty, face: lastBid.face, zhai: lastBid.zhai === true }
        : null,
    bids: asBids(r.bids),
    loser_id: typeof r.loser_id === "string" ? r.loser_id : null,
    result: typeof r.result === "object" && r.result !== null ? (r.result as RoundResult) : null,
  };
}

/** 开新局（starter 指定；骰只发给当前 active；调用方随后 bump＋事件）。 */
export async function startNextRound(
  svc: SupabaseClient,
  roomId: string,
  no: number,
  starterId: string,
  activeIds: string[],
  rules: LiarsRules,
  nowMs: number,
): Promise<{ ok: true } | { response: Response }> {
  const dice: Record<string, number[]> = {};
  for (const uid of activeIds) {
    dice[uid] = rollDice(rules.dice_per_player);
  }
  // §九：deal_only 房无轮次无倒计时（次局同）。
  const dealOnly = rules.mode === "deal_only";
  const { error } = await svc.from("game_rounds").insert({
    room_id: roomId,
    no,
    starter_id: starterId,
    status: "bidding",
    dice,
    current_turn_user: dealOnly ? null : starterId,
    turn_deadline:
      !dealOnly && rules.turn_seconds > 0
        ? new Date(nowMs + rules.turn_seconds * 1000).toISOString()
        : null,
    last_bid: null,
    bids: [],
  });
  if (error !== null) {
    console.error(`[games] next-round error: code=${error.code} message=${error.message}`);
    return { response: apiError("internal", "開局失敗", 500) };
  }
  return { ok: true };
}

export const NEXT_ROUND_AUTO_MS = 8000;

/**
 * 懒超时结算（每次 GET／POST 先调；无 cron）。
 * - bidding＋deadline 过：有 last_bid→自动 challenge，无→当前者最小叫骰（auto 标记）。
 * - revealed＋（全员确认或 8s）：输家先开新局（auto；§十三：deal_only 房不开，停住等房主）。
 * 回 `{room, fired}`（room 为重载后；fired 即 version 变了，调用方重读 version）。
 */
export async function settleRoom(
  svc: SupabaseClient,
  room: RoomJson,
  nowMs: number,
): Promise<{ room: RoomJson; fired: boolean }> {
  if (room.status !== "playing") return { room, fired: false };
  const round = await getLatestRound(svc, room.id);
  if (round === null) return { room, fired: false };
  const members = await getActiveMembers(svc, room.id);
  const activeIds = members.map((m) => m.user_id);
  if (activeIds.length === 0) return { room, fired: false };
  const rules = parseRules(room.rules);
  if (round.status === "bidding" && round.turn_deadline !== null) {
    if (Date.parse(round.turn_deadline) > nowMs) return { room, fired: false };
    const turn = round.current_turn_user;
    if (turn === null || !activeIds.includes(turn)) return { room, fired: false };
    if (round.last_bid !== null) {
      const done = await applyChallenge(svc, room, round, turn, true, nowMs);
      if (!("version" in done)) return { room, fired: false };
      return { room: { ...room, version: done.version }, fired: true };
    }
    const auto = minAutoBid(rules);
    const done = await applyBid(
      svc, room, round, activeIds, turn,
      { qty: auto.qty, face: auto.face, zhai: false }, true, nowMs,
    );
    if (!("version" in done)) return { room, fired: false };
    return { room: { ...room, version: done.version }, fired: true };
  }
  if (round.status === "revealed" && round.result !== null) {
    // §十三（§十一落地）：deal_only 房开盅后停住，等房主手动 next_round，不自动开。
    if (rules.mode === "deal_only") return { room, fired: false };
    const confirmed = new Set(round.result.confirmations);
    const allIn = activeIds.every((id) => confirmed.has(id));
    const aged = nowMs - Date.parse(round.result.revealed_at) >= NEXT_ROUND_AUTO_MS;
    if (!allIn && !aged) return { room, fired: false };
    const starter =
      typeof round.result.loser_id === "string" &&
      round.result.loser_id !== "" &&
      activeIds.includes(round.result.loser_id)
        ? round.result.loser_id
        : [...members].sort((a, b) => a.seat - b.seat)[0].user_id;
    const created = await startNextRound(svc, room.id, round.no + 1, starter, activeIds, rules, nowMs);
    if ("response" in created) return { room, fired: false };
    const version = await bumpRoom(svc, room.id, room.version, nowMs);
    if (version === null) return { room, fired: false };
    await appendEvent(svc, room.id, version, "round_started", null, {
      no: round.no + 1,
      starter_id: starter,
      auto: true,
    });
    return { room: { ...room, version }, fired: true };
  }
  return { room, fired: false };
}

/**
 * 落叫骰（调用方已验合法性；推进轮次＋重置 deadline）。
 * 回新 version（失败回 response）。
 */
export async function applyBid(
  svc: SupabaseClient,
  room: RoomJson,
  round: RoundRow,
  activeIdsSeatOrder: string[],
  bidderId: string,
  bid: { qty: number; face: number; zhai: boolean },
  auto: boolean,
  nowMs: number,
  clientActionId?: string,
): Promise<{ version: number } | { response: Response }> {
  const nowIso = new Date(nowMs).toISOString();
  const rules = parseRules(room.rules);
  const bids = [...round.bids, { user_id: bidderId, qty: bid.qty, face: bid.face, zhai: bid.zhai, at: nowIso }];
  const next = nextTurn(activeIdsSeatOrder, bidderId) ?? activeIdsSeatOrder[0];
  const { error } = await svc
    .from("game_rounds")
    .update({
      last_bid: { user_id: bidderId, qty: bid.qty, face: bid.face, zhai: bid.zhai },
      bids,
      current_turn_user: next,
      turn_deadline:
        rules.turn_seconds > 0 ? new Date(nowMs + rules.turn_seconds * 1000).toISOString() : null,
    })
    .eq("id", round.id);
  if (error !== null) {
    console.error(`[games] bid error: code=${error.code} message=${error.message}`);
    return { response: apiError("internal", "叫骰失敗", 500) };
  }
  const version = await bumpRoom(svc, room.id, room.version, nowMs);
  if (version === null) return { response: apiError("internal", "叫骰失敗", 500) };
  await appendEvent(svc, room.id, version, "action_bid", auto ? null : bidderId, {
    user_id: bidderId,
    qty: bid.qty,
    face: bid.face,
    zhai: bid.zhai,
    no: round.no,
    ...(auto ? { auto: true } : {}),
  }, clientActionId);
  return { version };
}

/**
 * 落開（即时开盅：统计→定输家→revealed；调用方已验 last_bid 存在）。
 * 回 `{version, revealed}`（revealed 即 RoundResult，给 GET／响应拼）。
 */
export async function applyChallenge(
  svc: SupabaseClient,
  room: RoomJson,
  round: RoundRow,
  challengerId: string,
  auto: boolean,
  nowMs: number,
  clientActionId?: string,
): Promise<{ version: number; revealed: RoundResult } | { response: Response }> {
  const lastBid = round.last_bid;
  if (lastBid === null) {
    return { response: apiError("wrong_phase", "無人叫骰不可開", 409) };
  }
  const rules = parseRules(room.rules);
  const allDice: number[] = [];
  for (const v of Object.values(round.dice)) {
    allDice.push(...v);
  }
  const broken = deriveOnesBroken(round.bids, rules);
  const { counted, bid_met } = resolveChallenge(allDice, lastBid, rules, broken);
  const revealed: RoundResult = {
    dice: round.dice,
    challenger_id: challengerId,
    bidder_id: lastBid.user_id,
    counted,
    bid_met,
    loser_id: bid_met ? challengerId : lastBid.user_id,
    revealed_at: new Date(nowMs).toISOString(),
    confirmations: [],
  };
  const { error } = await svc
    .from("game_rounds")
    .update({ status: "revealed", loser_id: revealed.loser_id, result: revealed })
    .eq("id", round.id);
  if (error !== null) {
    console.error(`[games] challenge error: code=${error.code} message=${error.message}`);
    return { response: apiError("internal", "開盅失敗", 500) };
  }
  const version = await bumpRoom(svc, room.id, room.version, nowMs);
  if (version === null) return { response: apiError("internal", "開盅失敗", 500) };
  await appendEvent(svc, room.id, version, "action_challenge", auto ? null : challengerId, {
    no: round.no,
    challenger_id: challengerId,
    bidder_id: lastBid.user_id,
    counted,
    bid_met,
    loser_id: revealed.loser_id,
    ...(auto ? { auto: true } : {}),
  }, clientActionId);
  return { version, revealed };
}

export type EventJson = {
  version: number;
  type: string;
  actor_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

function toEventJson(r: Record<string, unknown>): EventJson | null {
  if (typeof r.version !== "number" || typeof r.type !== "string") return null;
  return {
    version: r.version,
    type: r.type,
    actor_id: typeof r.actor_id === "string" ? r.actor_id : null,
    payload:
      typeof r.payload === "object" && r.payload !== null
        ? (r.payload as Record<string, unknown>)
        : {},
    created_at: typeof r.created_at === "string" ? r.created_at : "",
  };
}

/** since 之后事件（version>since 升序，最多 50；断线补事件用）。 */
export async function getEventsSince(
  svc: SupabaseClient,
  roomId: string,
  since: number,
): Promise<EventJson[]> {
  const { data } = await svc
    .from("game_events")
    .select("version,type,actor_id,payload,created_at")
    .eq("room_id", roomId)
    .gt("version", since)
    .order("version", { ascending: true })
    .limit(50);
  const out: EventJson[] = [];
  for (const r of ((data ?? []) as unknown[]) as Record<string, unknown>[]) {
    const e = toEventJson(r);
    if (e !== null) out.push(e);
  }
  return out;
}

export type GameActionType =
  | "bid" | "challenge" | "next_round" | "reveal" | "speak_done" | "vote" | "rematch" | "answer" | "again";

export type ParsedAction =
  | { type: "bid"; bid: { qty: number; face: number; zhai: boolean }; expectedVersion: number; clientActionId: string }
  | { type: "challenge"; expectedVersion: number; clientActionId: string }
  | { type: "reveal"; expectedVersion: number; clientActionId: string }
  | { type: "next_round"; expectedVersion: number; clientActionId: string }
  // UR H.3 誰是臥底
  | { type: "speak_done"; expectedVersion: number; clientActionId: string }
  | { type: "vote"; target: string; expectedVersion: number; clientActionId: string }
  | { type: "rematch"; expectedVersion: number; clientActionId: string }
  // UR H.4 尾班車
  | { type: "answer"; text: string; expectedVersion: number; clientActionId: string }
  | { type: "again"; expectedVersion: number; clientActionId: string }
  // 老實人·識破
  | { type: "shipo_gongsansiao"; target: string; expectedVersion: number; clientActionId: string }
  | { type: "shipo_end_talk"; expectedVersion: number; clientActionId: string }
  | { type: "shipo_pick"; target: string; expectedVersion: number; clientActionId: string }
  | { type: "shipo_next"; expectedVersion: number; clientActionId: string };

/** 动作包解析（形状错 400；语义错各 action 内 409/422）。 */
export function parseActionBody(raw: unknown): ParsedAction | { error: string } {
  if (typeof raw !== "object" || raw === null) return { error: "body 需为对象" };
  const r = raw as Record<string, unknown>;
  const type = r.type;
  if (
    type !== "bid" && type !== "challenge" && type !== "next_round" && type !== "reveal" &&
    type !== "speak_done" && type !== "vote" && type !== "rematch" && type !== "answer" && type !== "again" &&
    type !== "shipo_gongsansiao" && type !== "shipo_end_talk" && type !== "shipo_pick" && type !== "shipo_next"
  ) {
    return { error: "type 只要 bid|challenge|next_round|reveal|speak_done|vote|rematch|answer|again|shipo_gongsansiao|shipo_end_talk|shipo_pick|shipo_next" };
  }
  if (typeof r.expected_version !== "number" || !Number.isInteger(r.expected_version) || r.expected_version < 0) {
    return { error: "expected_version 非法" };
  }
  const cid = r.client_action_id;
  if (typeof cid !== "string" || cid.trim() === "" || cid.trim().length > 64) {
    return { error: "client_action_id 非法" };
  }
  const base = { expectedVersion: r.expected_version, clientActionId: cid.trim() };
  if (type === "answer") {
    const p = (typeof r.payload === "object" && r.payload !== null ? r.payload : {}) as Record<string, unknown>;
    const t = typeof p.text === "string" ? p.text.trim() : "";
    if (t === "" || t.length > 40) return { error: "answer payload 需 text（1–40 字）" };
    return { type, text: t, ...base };
  }
  if (type === "vote" || type === "shipo_gongsansiao" || type === "shipo_pick") {
    const p = (typeof r.payload === "object" && r.payload !== null ? r.payload : {}) as Record<string, unknown>;
    if (typeof p.target !== "string" || p.target.trim() === "" || p.target.length > 64) {
      return { error: `${type} payload 需 target（用戶 id）` };
    }
    return { type, target: p.target.trim(), ...base };
  }
  if (type !== "bid") return { type, ...base };
  const p = (typeof r.payload === "object" && r.payload !== null ? r.payload : {}) as Record<string, unknown>;
  if (typeof p.qty !== "number" || !Number.isInteger(p.qty) || typeof p.face !== "number" || !Number.isInteger(p.face)) {
    return { error: "bid payload 需 qty／face 整数" };
  }
  return { type, bid: { qty: p.qty, face: p.face, zhai: p.zhai === true }, ...base };
}

/** 邀请包解析（1–7 人，去重去空去己；ids 非法即 error）。 */
export function parseInviteBody(
  raw: unknown,
  selfId: string,
): { userIds: string[] } | { error: string } {
  if (typeof raw !== "object" || raw === null) return { error: "body 需为对象" };
  const v = (raw as Record<string, unknown>).user_ids;
  if (!Array.isArray(v) || v.length === 0) return { error: "user_ids 非空数组" };
  const seen = new Set<string>();
  for (const id of v) {
    if (typeof id !== "string" || id.trim() === "" || id.trim().length > 64) {
      return { error: "user_ids 含非法 id" };
    }
    if (id.trim() !== selfId) seen.add(id.trim());
  }
  if (seen.size === 0) return { error: "user_ids 非空数组" };
  if (seen.size > 7) return { error: "一次最多邀请 7 人" };
  return { userIds: [...seen] };
}

/**
 * §九 reveal（deal_only 房專用：任一 active 在 bidding 中亮骰）。
 * 不要求 last_bid／轮次；不判输赢（bidder／counted／bid_met／loser 全 null）。
 * 调用方已验：deal_only 房＋bidding 中（revealed 重调由路由幂等 200）。
 */
export async function applyReveal(
  svc: SupabaseClient,
  room: RoomJson,
  round: RoundRow,
  revealerId: string,
  nowMs: number,
  clientActionId?: string,
): Promise<{ version: number; revealed: RoundResult } | { response: Response }> {
  const revealed: RoundResult = {
    dice: round.dice,
    challenger_id: revealerId,
    bidder_id: null,
    counted: null,
    bid_met: null,
    loser_id: null,
    revealed_at: new Date(nowMs).toISOString(),
    confirmations: [],
  };
  const { error } = await svc
    .from("game_rounds")
    .update({ status: "revealed", loser_id: null, result: revealed })
    .eq("id", round.id);
  if (error !== null) {
    console.error(`[games] reveal error: code=${error.code} message=${error.message}`);
    return { response: apiError("internal", "亮骰失敗", 500) };
  }
  const version = await bumpRoom(svc, room.id, room.version, nowMs);
  if (version === null) return { response: apiError("internal", "亮骰失敗", 500) };
  await appendEvent(svc, room.id, version, "action_reveal", revealerId, {
    no: round.no,
    challenger_id: revealerId,
  }, clientActionId);
  return { version, revealed };
}

/** 隐身者不可进入游戏（PRIVACY_MODE_MATRIX 矩阵 A；留痕类，自己被攔即明說）。 */
export async function isStealthUser(svc: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await svc.from("users").select("mode").eq("id", userId).maybeSingle();
  return (data as { mode?: unknown } | null)?.mode === "stealth";
}

/** 入房申请 5 分钟未处理自动过期（懒过期，touch 时清）。 */
export const JOIN_REQUEST_TTL_MS = 5 * 60_000;
/** 同一用户每小时最多 5 次申请；每房最多 10 条 pending。 */
export const JOIN_REQUEST_HOURLY_LIMIT = 5;
export const JOIN_REQUEST_ROOM_LIMIT = 10;

export type JoinRequestStatus = "pending" | "approved" | "rejected" | "expired" | "cancelled";

/** 房主审批 decision 白名单（approve 入座／reject 拒绝）。 */
export function parseJoinDecision(raw: unknown): { decision: "approve" | "reject" } | { error: string } {
  if (typeof raw !== "object" || raw === null) return { error: "body 需为对象" };
  const d = (raw as Record<string, unknown>).decision;
  if (d !== "approve" && d !== "reject") return { error: "decision 只要 approve|reject" };
  return { decision: d };
}

/** 申请是否已过期（纯函数可测；过期由 touch 时改写 status）。 */
export function isRequestExpired(createdAt: string, nowMs: number): boolean {
  const t = Date.parse(createdAt);
  return Number.isFinite(t) && nowMs - t >= JOIN_REQUEST_TTL_MS;
}

/** 把一房的过期 pending 置 expired（返回置掉的行数；失败记 log 不抛）。 */
export async function expireJoinRequests(
  svc: SupabaseClient,
  roomId: string,
  nowMs: number,
): Promise<number> {
  const cutoff = new Date(nowMs - JOIN_REQUEST_TTL_MS).toISOString();
  const { data, error } = await svc
    .from("game_join_requests")
    .update({ status: "expired" })
    .eq("room_id", roomId)
    .eq("status", "pending")
    .lt("created_at", cutoff)
    .select("id");
  if (error !== null) {
    console.error(`[games/requests] expire error: code=${error.code} message=${error.message}`);
    return 0;
  }
  return ((data ?? []) as unknown[]).length;
}

/** 房内禁言中（多人举报升级；到本房结束；room 删级联带走）。 */
export async function isGameMuted(svc: SupabaseClient, roomId: string, userId: string): Promise<boolean> {
  const { data } = await svc
    .from("game_mutes")
    .select("room_id")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();
  return data !== null;
}

/** 被禁玩（users.game_banned_until 未过期）。 */
export async function isGameBanned(svc: SupabaseClient, userId: string, nowMs: number): Promise<boolean> {
  const { data } = await svc.from("users").select("game_banned_until").eq("id", userId).maybeSingle();
  const until = (data as { game_banned_until?: unknown } | null)?.game_banned_until;
  return typeof until === "string" && Date.parse(until) > nowMs;
}

/** 房内快捷语枚举（~24 条；文案 iOS 本地化，服务端只认 key）。 */
export const GAME_QUICK_KEYS = [
  "ready", "hurry", "again", "drink", "cheers_all", "nice", "oops",
  "good_luck", "well_played", "rematch", "brb", "waiting", "go_go",
  "haha", "wow", "cheer_up", "my_turn", "your_turn", "toast_host",
  "thanks", "sorry", "gj", "lol", "cheers_back",
] as const;
export type GameQuickKey = (typeof GAME_QUICK_KEYS)[number];

/** 房内文字 1–60 字（trim 后计，UTF-16）。 */
export const GAME_MSG_MAX = 60;

/** 发送限频：同人 2 秒 1 条、1 分钟 20 条（进程级，沿 join 码限频口径）。 */
export const GAME_MSG_MIN_MS = 2000;
export const GAME_MSG_MINUTE_LIMIT = 20;

export type GameMessageBody =
  | { kind: "quick"; quick_key: string }
  | { kind: "text"; body: string };

/** 发送包解析（client_msg_id 必填，幂等键）。 */
export function parseGameMessageBody(
  raw: unknown,
): { body: GameMessageBody; clientMsgId: string } | { error: string } {
  if (typeof raw !== "object" || raw === null) return { error: "body 需为对象" };
  const r = raw as Record<string, unknown>;
  const cid = r.client_msg_id;
  if (typeof cid !== "string" || cid.trim() === "" || cid.length > 64) {
    return { error: "client_msg_id 必填（≤64）" };
  }
  if (r.kind === "quick") {
    if (typeof r.quick_key !== "string" || !(GAME_QUICK_KEYS as readonly string[]).includes(r.quick_key)) {
      return { error: "quick_key 非法" };
    }
    return { body: { kind: "quick", quick_key: r.quick_key }, clientMsgId: cid.trim() };
  }
  if (r.kind === "text" || r.kind === undefined) {
    const t = typeof r.body === "string" ? r.body.trim() : "";
    if (t === "" || t.length > GAME_MSG_MAX) {
      return { error: `body 只要 1–${GAME_MSG_MAX} 字` };
    }
    return { body: { kind: "text", body: t }, clientMsgId: cid.trim() };
  }
  return { error: "kind 只要 text|quick" };
}

/**
 * UR H.2 局后加好友校验：24h 内同房且双方都曾 active（game_room_players 有行即可，
 * left/kicked 亦算；防冒认陌生人）。
 */
export async function sharedActiveRoom(
  svc: SupabaseClient,
  a: string,
  b: string,
  sinceIso: string,
): Promise<boolean> {
  const { data: aRows } = await svc
    .from("game_room_players")
    .select("room_id")
    .eq("user_id", a)
    .gte("joined_at", sinceIso)
    .limit(50);
  const aRooms = new Set(
    ((aRows ?? []) as unknown[]).map((r) => (r as { room_id?: unknown }).room_id).filter((v): v is string => typeof v === "string"),
  );
  if (aRooms.size === 0) return false;
  const { data: bRows } = await svc
    .from("game_room_players")
    .select("room_id")
    .eq("user_id", b)
    .in("room_id", [...aRooms])
    .limit(10);
  return Array.isArray(bRows) && bRows.length > 0;
}
