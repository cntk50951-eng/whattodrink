import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { TRUST_CONFIG } from "@/lib/trust/config";
import { settleParty } from "@/lib/trust/settle";

/**
 * UR E.31 C1 出席确认读（🔒）。
 * `GET /api/v1/parties/:id/attendance` —— 名单内可见（含 host）；
 * 局结束前 404？不——结束前回 `{pending:true}`（窗口未开）；
 * 窗口 `expires_at ≤ now ≤ expires_at＋24h`，过期 410（结算后仍可看，`settled:true`＋outcome）。
 * host 视图：成员 arrived＋host_marked；成员视图：host arrived＋my_host_attended。
 * touch 即懒结算（到期＋24h 后首次读触发 settle；dry-run 只记 outcome）。
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
  if (typeof id !== "string" || id === "" || id.length > 64) {
    return apiError("invalid_params", "id 非法", 400);
  }
  const svc = await createServiceClient();
  const nowMs = Date.now();
  const { data: party } = await svc
    .from("parties")
    .select("id,host_user_id,status,expires_at,start_at,place")
    .eq("id", id)
    .maybeSingle();
  const p = party as {
    id?: unknown;
    host_user_id?: unknown;
    status?: unknown;
    expires_at?: unknown;
    start_at?: unknown;
  } | null;
  if (p === null || typeof p.id !== "string") return apiError("not_found", "酒局不存在", 404);
  const isHost = p.host_user_id === userId;
  const { data: join } = isHost
    ? { data: null }
    : await svc.from("joins").select("user_id").eq("party_id", id).eq("user_id", userId).maybeSingle();
  if (!isHost && join === null) return apiError("not_in_party", "你不在該酒局名單", 403);
  const expiresMs = typeof p.expires_at === "string" ? Date.parse(p.expires_at) : NaN;
  if (!Number.isFinite(expiresMs)) return apiError("internal", "酒局時間缺失", 500);
  if (nowMs < expiresMs) {
    return apiOk({ pending: true, closes_at: new Date(expiresMs + TRUST_CONFIG.attendance_window_h * 3600_000).toISOString() });
  }
  const closesAt = new Date(expiresMs + TRUST_CONFIG.attendance_window_h * 3600_000).toISOString();
  const windowClosed = nowMs > expiresMs + TRUST_CONFIG.attendance_window_h * 3600_000;
  // 懒结算（到期＋24h 后首次 touch；dry-run 只记 outcome）。
  if (windowClosed) {
    await settleParty(svc, id, nowMs);
  } else {
    await ensureAttendanceConfirm(svc, id, expiresMs);
  }
  const { data: members } = await svc.from("joins").select("user_id").eq("party_id", id).limit(500);
  const memberIds = [
    ...new Set(
      ((members ?? []) as unknown[]).map((m) => (m as { user_id?: unknown }).user_id).filter((v): v is string => typeof v === "string"),
    ),
  ];
  const allIds = [...new Set([typeof p.host_user_id === "string" ? p.host_user_id : "", ...memberIds])].filter((v) => v !== "");
  const [{ data: users }, { data: atts }] = await Promise.all([
    svc.from("users").select("id,nickname,avatar_url").in("id", allIds.length > 0 ? allIds : ["00000000-0000-0000-0000-000000000000"]),
    svc.from("party_attendance").select("user_id,arrived_at,host_marked,self_host_attended,settled_at,outcome").eq("party_id", id).limit(500),
  ]);
  const profileOf = (uid: string): { nickname: string; avatar_url: string | null } => {
    const hit = ((users ?? []) as unknown[]).find((x) => (x as { id?: unknown }).id === uid) as
      | { nickname?: unknown; avatar_url?: unknown }
      | undefined;
    return {
      nickname: typeof hit?.nickname === "string" && hit.nickname !== "" ? hit.nickname : "酒友",
      avatar_url: typeof hit?.avatar_url === "string" ? hit.avatar_url : null,
    };
  };
  const attById = new Map<string, { arrived: boolean; host_marked: boolean | null; self_host_attended: boolean | null; settled: boolean; outcome: string | null }>();
  for (const a of ((atts ?? []) as unknown[]) as Record<string, unknown>[]) {
    if (typeof a.user_id !== "string") continue;
    attById.set(a.user_id, {
      arrived: typeof a.arrived_at === "string",
      host_marked: typeof a.host_marked === "boolean" ? a.host_marked : null,
      self_host_attended: typeof a.self_host_attended === "boolean" ? a.self_host_attended : null,
      settled: a.settled_at !== null && a.settled_at !== undefined,
      outcome: typeof a.outcome === "string" ? a.outcome : null,
    });
  }
  if (isHost) {
    return apiOk({
      role: "host" as const,
      closes_at: closesAt,
      window_closed: windowClosed,
      members: memberIds.map((uid) => {
        const prof = profileOf(uid);
        const a = attById.get(uid);
        return {
          user_id: uid,
          nickname: prof.nickname,
          avatar_url: prof.avatar_url,
          arrived: a?.arrived ?? false,
          host_marked: a?.host_marked ?? null,
          settled: a?.settled ?? false,
          outcome: a?.outcome ?? null,
        };
      }),
    });
  }
  const hostId = typeof p.host_user_id === "string" ? p.host_user_id : "";
  const hostProf = profileOf(hostId);
  const hostAtt = attById.get(hostId);
  const myAtt = attById.get(userId);
  return apiOk({
    role: "member" as const,
    closes_at: closesAt,
    window_closed: windowClosed,
    host: {
      user_id: hostId,
      nickname: hostProf.nickname,
      avatar_url: hostProf.avatar_url,
      arrived: hostAtt?.arrived ?? false,
    },
    my_host_attended: myAtt?.self_host_attended ?? null,
    my_outcome: myAtt?.outcome ?? null,
  });
}

/** 局结束懒通知 attendance_confirm（host＋成员各一条，去重表；失败只记 log）。 */
async function ensureAttendanceConfirm(
  svc: Awaited<ReturnType<typeof createServiceClient>>,
  partyId: string,
  expiresMs: number,
): Promise<void> {
  const closesAt = new Date(expiresMs + TRUST_CONFIG.attendance_window_h * 3600_000).toISOString();
  const { data: party } = await svc.from("parties").select("host_user_id,place,start_at").eq("id", partyId).maybeSingle();
  const prow = party as { host_user_id?: unknown; place?: unknown; start_at?: unknown } | null;
  if (prow === null || typeof prow.host_user_id !== "string") return;
  const { data: joins } = await svc.from("joins").select("user_id").eq("party_id", partyId).limit(500);
  const ids = [
    ...new Set([
      prow.host_user_id,
      ...((joins ?? []) as unknown[]).map((j) => (j as { user_id?: unknown }).user_id).filter((v): v is string => typeof v === "string"),
    ]),
  ];
  for (const uid of ids) {
    const { data: dup } = await svc
      .from("party_reminders")
      .select("party_id")
      .eq("party_id", partyId)
      .eq("user_id", uid)
      .eq("kind", "attendance_confirm")
      .maybeSingle();
    if (dup !== null) continue;
    await svc.from("party_reminders").insert({ party_id: partyId, user_id: uid, kind: "attendance_confirm" });
    await svc.from("notifications").insert({
      user_id: uid,
      kind: "attendance_confirm",
      party_id: partyId,
      actor_id: null,
      payload: {
        party_place: typeof prow.place === "string" ? prow.place : "",
        closes_at: closesAt,
      },
    });
  }
}

/**
 * UR E.31 C1 出席确认写（🔒，同文件 POST）。
 * `POST /api/v1/parties/:id/attendance` —— 发起人 `{marks:[{user_id, attended}]}`（限名单成员，
 * 可在窗口内改）；成员 `{host_attended}`。窗口同 GET，过期 410。
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  const { id } = await params;
  if (typeof id !== "string" || id === "" || id.length > 64) {
    return apiError("invalid_params", "id 非法", 400);
  }
  let raw: unknown = null;
  try {
    raw = await req.json();
  } catch {
    return apiError("invalid_params", "body 需为 JSON", 400);
  }
  const svc = await createServiceClient();
  const nowMs = Date.now();
  const { data: party } = await svc
    .from("parties")
    .select("id,host_user_id,status,expires_at")
    .eq("id", id)
    .maybeSingle();
  const p = party as { id?: unknown; host_user_id?: unknown; status?: unknown; expires_at?: unknown } | null;
  if (p === null || typeof p.id !== "string") return apiError("not_found", "酒局不存在", 404);
  const isHost = p.host_user_id === userId;
  const { data: join } = isHost
    ? { data: null }
    : await svc.from("joins").select("user_id").eq("party_id", id).eq("user_id", userId).maybeSingle();
  if (!isHost && join === null) return apiError("not_in_party", "你不在該酒局名單", 403);
  const expiresMs = typeof p.expires_at === "string" ? Date.parse(p.expires_at) : NaN;
  if (!Number.isFinite(expiresMs) || nowMs < expiresMs) {
    return apiError("invalid_params", "局尚未結束", 400);
  }
  if (nowMs > expiresMs + TRUST_CONFIG.attendance_window_h * 3600_000) {
    return apiError("window_closed", "出席確認已截止", 410);
  }
  const body = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  if (isHost) {
    const marks = body.marks;
    if (!Array.isArray(marks) || marks.length === 0 || marks.length > 500) {
      return apiError("invalid_params", "marks 非空数组", 400);
    }
    const { data: members } = await svc.from("joins").select("user_id").eq("party_id", id).limit(500);
    const memberSet = new Set(
      ((members ?? []) as unknown[]).map((m) => (m as { user_id?: unknown }).user_id).filter((v): v is string => typeof v === "string"),
    );
    for (const m of marks as unknown[]) {
      const rec = (typeof m === "object" && m !== null ? m : {}) as Record<string, unknown>;
      if (typeof rec.user_id !== "string" || rec.user_id === "" || typeof rec.attended !== "boolean") {
        return apiError("invalid_params", "marks 行需 user_id＋attended", 400);
      }
      if (!memberSet.has(rec.user_id)) {
        return apiError("invalid_params", "只能標記名單內成員", 400);
      }
    }
    for (const m of marks as unknown[]) {
      const rec = m as Record<string, unknown>;
      const { error } = await svc.from("party_attendance").upsert(
        { party_id: id, user_id: rec.user_id as string, host_marked: rec.attended as boolean },
        { onConflict: "party_id,user_id" },
      );
      if (error !== null) {
        console.error(`[api/v1/parties/attendance] mark error: code=${error.code} message=${error.message}`);
        return apiError("internal", "標記失敗", 500);
      }
    }
    return apiOk({ ok: true });
  }
  if (typeof body.host_attended !== "boolean") {
    return apiError("invalid_params", "host_attended 只要 boolean", 400);
  }
  const { error } = await svc.from("party_attendance").upsert(
    { party_id: id, user_id: userId, self_host_attended: body.host_attended as boolean },
    { onConflict: "party_id,user_id" },
  );
  if (error !== null) {
    console.error(`[api/v1/parties/attendance] self mark error: code=${error.code} message=${error.message}`);
    return apiError("internal", "標記失敗", 500);
  }
  return apiOk({ ok: true });
}
