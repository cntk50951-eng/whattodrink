/**
 * UR H.1 房间 helpers（第二批）。
 * 全表 RLS 零 policy（0042，沿 push_log）→ game_* 读写一律 service client；
 * authed client 只做"我是谁"（getAuthedClient 的 userId），绝不拿它读 game 表
 * （沿 DEF-20261010-001 判例：RLS 静默少行，用成员表推导对方必须走 service）。
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { apiError } from "../api/envelope";
import { nextTurn, parseRules, type LiarsRules } from "./liars";

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
  rules: LiarsRules;
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
  return {
    id: r.id,
    code: r.code,
    game: typeof r.game === "string" ? r.game : "liars_dice",
    host_id: r.host_id,
    status: r.status,
    rules: parseRules(r.rules),
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
): { game: string; maxPlayers: number; rules: LiarsRules } | { error: string } {
  if (typeof raw !== "object" || raw === null) return { error: "body 需为对象" };
  const r = raw as Record<string, unknown>;
  const game = typeof r.game === "string" ? r.game : "liars_dice";
  if (game !== "liars_dice") return { error: "game 只要 liars_dice（POC）" };
  const maxPlayers =
    r.max_players === undefined
      ? 6
      : typeof r.max_players === "number" && Number.isInteger(r.max_players)
        ? r.max_players
        : -1;
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

export function parseKickBody(raw: unknown): { userId: string } | { error: string } {
  if (typeof raw !== "object" || raw === null) return { error: "body 需为对象" };
  const v = (raw as Record<string, unknown>).user_id;
  if (typeof v !== "string" || v.trim() === "" || v.trim().length > 64) {
    return { error: "user_id 非法" };
  }
  return { userId: v.trim() };
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

/** 版本事件（失败只记 log，不拦主流程；version 由调用方定）。 */
export async function appendEvent(
  svc: SupabaseClient,
  roomId: string,
  version: number,
  type: string,
  actorId: string | null,
  payload: Record<string, unknown>,
): Promise<void> {
  const { error } = await svc.from("game_events").insert({
    room_id: roomId,
    version,
    type,
    actor_id: actorId,
    payload,
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
