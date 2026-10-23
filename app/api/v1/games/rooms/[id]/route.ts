import { getAuthedClient, createServiceClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { parseRules } from "@/lib/games/liars";
import {
  getActiveMembers,
  getEventsSince,
  getLatestRound,
  getPlayerRow,
  parseRoomId,
  settleRoom,
  toRoomJson,
  isStealthUser,
} from "@/lib/games/rooms";
import { STEALTH_SELF_BLOCK_MSG } from "@/lib/mode";
import { viewSpyFor } from "@/lib/games/spy";
import { settleSpyRoom } from "@/lib/games/spyRoom";
import { loadSpyState } from "@/lib/games/spyStore";
import { viewTrainFor } from "@/lib/games/train";
import { settleTrainRoom } from "@/lib/games/trainRoom";
import { viewShipoFor } from "@/lib/games/shipo";
import { settleShipoRoom } from "@/lib/games/shipoRoom";
import { loadShipoState } from "@/lib/games/shipoStore";
import { pickShipoLang } from "@/lib/games/shipoCards";
import { loadTrainState } from "@/lib/games/trainStore";

const ONLINE_WINDOW_MS = 15_000;

/**
 * UR H.1 取状态（🔒，核心轮询口）。
 * `GET /api/v1/games/rooms/{id}?since=<version>` —— since 追平回 304（空体）；
 * 否则 200 `{room, players, round?, events}`。
 * - 先懒超时结算（settle），再对账 since（被自动动作推高即 200 不回 304）。
 * - 按人裁剪：`my_dice` 只给自己；`revealed` 只在开盅后（含全场骰）。
 * - ended 房：有行（active／left／kicked）即可看结算；非 ended 只 active 可看。
 * - GET 顺带刷我 `last_seen_at`（online 15s 窗）。
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  const { id } = await params;
  const parsedId = parseRoomId(id);
  if ("error" in parsedId) {
    return apiError("invalid_params", parsedId.error, 400);
  }
  const svc = await createServiceClient();
  if (await isStealthUser(svc, userId)) {
    return apiError("forbidden", STEALTH_SELF_BLOCK_MSG, 403);
  }
  const nowMs = Date.now();
  const { data: roomRaw } = await svc
    .from("game_rooms")
    .select("id,code,game,host_id,status,rules,max_players,version,expires_at,ended_at")
    .eq("id", parsedId.id)
    .maybeSingle();
  let room = toRoomJson(roomRaw);
  if (room === null) {
    return apiError("room_not_found", "房間不存在", 404);
  }
  const mine = await getPlayerRow(svc, room.id, userId);
  if (mine === null) {
    return apiError("room_not_found", "房間不存在", 404);
  }
  if (room.status !== "ended" && mine.status !== "active") {
    return apiError("room_not_found", "房間不存在", 404);
  }
  // 懒超时（只 active 成员触发；旁观 ended 不写）。
  if (room.status === "playing" && mine.status === "active") {
    const settled =
      room.game === "spy"
        ? await settleSpyRoom(svc, room, nowMs)
        : room.game === "last_train"
          ? await settleTrainRoom(svc, room, nowMs)
          : room.game === "shipo"
            ? await settleShipoRoom(svc, room, nowMs)
            : await settleRoom(svc, room, nowMs);
    room = settled.room;
  }
  const q = new URL(req.url).searchParams;
  const sinceRaw = q.get("since");
  const since = sinceRaw !== null && sinceRaw.trim() !== "" ? Number(sinceRaw.trim()) : 0;
  if (Number.isFinite(since) && since === room.version) {
    return new Response(null, { status: 304 });
  }
  if (mine.status === "active") {
    await svc
      .from("game_room_players")
      .update({ last_seen_at: new Date(nowMs).toISOString() })
      .eq("room_id", room.id)
      .eq("user_id", userId);
  }
  const members = await getActiveMembers(svc, room.id);
  const ids = members.map((m) => m.user_id);
  const infoById = new Map<string, { nickname: string; avatar_url: string | null }>();
  if (ids.length > 0) {
    const { data: users } = await svc.from("users").select("id,nickname,avatar_url").in("id", ids);
    for (const u of ((users ?? []) as unknown[]) as Record<string, unknown>[]) {
      if (typeof u.id !== "string") continue;
      infoById.set(u.id, {
        nickname: typeof u.nickname === "string" && u.nickname !== "" ? u.nickname : "酒友",
        avatar_url: typeof u.avatar_url === "string" ? u.avatar_url : null,
      });
    }
  }
  const rules = parseRules(room.rules);
  const round = room.status === "playing" ? await getLatestRound(svc, room.id) : null;
  const players = members.map((m) => {
    const info = infoById.get(m.user_id) ?? { nickname: "酒友", avatar_url: null };
    const seenMs = Date.parse(m.last_seen_at);
    return {
      user_id: m.user_id,
      nickname: info.nickname,
      avatar_url: info.avatar_url,
      seat: m.seat,
      ready: m.ready,
      status: m.status,
      online: Number.isFinite(seenMs) && nowMs - seenMs >= 0 && nowMs - seenMs <= ONLINE_WINDOW_MS,
      dice_count:
        round !== null ? (round.dice[m.user_id]?.length ?? rules.dice_per_player) : undefined,
    };
  });
  const roundJson =
    round === null
      ? undefined
      : {
          no: round.no,
          status: round.status,
          starter_id: round.starter_id,
          current_turn_user: round.current_turn_user,
          turn_deadline: round.turn_deadline,
          last_bid: round.last_bid,
          bids: round.bids,
          my_dice: round.dice[userId] ?? [],
          ...(round.status === "revealed" && round.result !== null
            ? {
                revealed: {
                  dice: round.result.dice,
                  challenger_id: round.result.challenger_id,
                  bidder_id: round.result.bidder_id,
                  counted: round.result.counted,
                  bid_met: round.result.bid_met,
                  loser_id: round.result.loser_id,
                },
              }
            : {}),
        };
  const events = await getEventsSince(svc, room.id, Number.isFinite(since) && since > 0 ? since : 0);
  // UR H.3 誰是臥底：按人裁剪的視圖（只含自己的詞；身份只在出局／結束後公開；server_now 供客戶端校準倒數）
  let spyJson: ReturnType<typeof viewSpyFor> | undefined;
  if (room.game === "spy" && room.status === "playing" && mine.status === "active") {
    const cur = await loadSpyState(svc, room.id);
    if (cur !== null) spyJson = viewSpyFor(cur.state, userId, nowMs);
  }
  // UR H.4 尾班車：公開視圖（熱度 0–4；真實倒數永不下發）
  let trainJson: ReturnType<typeof viewTrainFor> | undefined;
  if (room.game === "last_train" && room.status === "playing" && mine.status === "active") {
    const cur = await loadTrainState(svc, room.id);
    if (cur !== null) trainJson = viewTrainFor(cur.state, nowMs);
  }
  // 老實人·識破：按人裁剪（peek 階段只有老實人拿到真相；他人身份 result 前絕不下發）
  let shipoJson: ReturnType<typeof viewShipoFor> | undefined;
  if (room.game === "shipo" && room.status === "playing" && mine.status === "active") {
    const cur = await loadShipoState(svc, room.id);
    if (cur !== null) shipoJson = viewShipoFor(cur.state, userId, nowMs, pickShipoLang(req.headers.get("accept-language")));
  }
  return apiOk({
    room,
    players,
    ...(roundJson !== undefined ? { round: roundJson } : {}),
    ...(spyJson !== undefined ? { spy: spyJson } : {}),
    ...(trainJson !== undefined ? { train: trainJson } : {}),
    ...(shipoJson !== undefined ? { shipo: shipoJson } : {}),
    events,
  });
}
