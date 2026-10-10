import { getAuthedClient, createServiceClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";

/**
 * UR H.1 我的邀请（🔒）。
 * `GET /api/v1/games/invites`
 * —— 200 `{invites:[{room_id, code, host, game, created_at, players_count}]}`。
 * 只给房间仍 lobby 的 pending（过期／开局行顺手置 expired，懒清理）。
 */
export async function GET(req: Request): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  const svc = await createServiceClient();
  const { data: invRows } = await svc
    .from("game_invites")
    .select("room_id,created_at")
    .eq("to_user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(50);
  const rows = ((invRows ?? []) as unknown[]) as { room_id?: unknown; created_at?: unknown }[];
  const roomIds = [...new Set(rows.map((r) => r.room_id).filter((id): id is string => typeof id === "string"))];
  if (roomIds.length === 0) return apiOk({ invites: [] });
  const { data: rooms } = await svc
    .from("game_rooms")
    .select("id,code,game,host_id,status")
    .in("id", roomIds);
  const roomById = new Map<string, { code: string; game: string; host_id: string; status: string }>();
  for (const r of ((rooms ?? []) as unknown[]) as Record<string, unknown>[]) {
    if (typeof r.id !== "string") continue;
    roomById.set(r.id, {
      code: typeof r.code === "string" ? r.code : "",
      game: typeof r.game === "string" ? r.game : "liars_dice",
      host_id: typeof r.host_id === "string" ? r.host_id : "",
      status: typeof r.status === "string" ? r.status : "ended",
    });
  }
  // 非 lobby 即过期（顺手置 expired，下次不再见）。
  const staleIds = roomIds.filter((id) => roomById.get(id)?.status !== "lobby");
  if (staleIds.length > 0) {
    await svc
      .from("game_invites")
      .update({ status: "expired" })
      .eq("to_user_id", userId)
      .eq("status", "pending")
      .in("room_id", staleIds);
  }
  const liveIds = roomIds.filter((id) => roomById.get(id)?.status === "lobby");
  if (liveIds.length === 0) return apiOk({ invites: [] });
  const hostIds = [...new Set(liveIds.map((id) => roomById.get(id)?.host_id ?? "").filter((h) => h !== ""))];
  const [{ data: hosts }, { data: players }] = await Promise.all([
    svc.from("users").select("id,nickname,avatar_url").in("id", hostIds.length > 0 ? hostIds : ["00000000-0000-0000-0000-000000000000"]),
    svc.from("game_room_players").select("room_id").in("room_id", liveIds).eq("status", "active"),
  ]);
  const hostById = new Map<string, { nickname: string; avatar_url: string | null }>();
  for (const h of ((hosts ?? []) as unknown[]) as Record<string, unknown>[]) {
    if (typeof h.id !== "string") continue;
    hostById.set(h.id, {
      nickname: typeof h.nickname === "string" && h.nickname !== "" ? h.nickname : "酒友",
      avatar_url: typeof h.avatar_url === "string" ? h.avatar_url : null,
    });
  }
  const countByRoom = new Map<string, number>();
  for (const p of ((players ?? []) as unknown[]) as { room_id?: unknown }[]) {
    if (typeof p.room_id !== "string") continue;
    countByRoom.set(p.room_id, (countByRoom.get(p.room_id) ?? 0) + 1);
  }
  const createdByRoom = new Map<string, string>();
  for (const r of rows) {
    if (typeof r.room_id === "string" && typeof r.created_at === "string" && !createdByRoom.has(r.room_id)) {
      createdByRoom.set(r.room_id, r.created_at);
    }
  }
  const invites = liveIds.map((id) => {
    const rm = roomById.get(id) as { code: string; game: string; host_id: string; status: string };
    const host = hostById.get(rm.host_id) ?? { nickname: "酒友", avatar_url: null };
    return {
      room_id: id,
      code: rm.code,
      host: { user_id: rm.host_id, nickname: host.nickname, avatar_url: host.avatar_url },
      game: rm.game,
      created_at: createdByRoom.get(id) ?? "",
      players_count: countByRoom.get(id) ?? 0,
    };
  });
  return apiOk({ invites });
}
