import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";
import { isAdverseParty } from "@/lib/complaintAppeal";
import { publicReasonText } from "@/lib/complaintDecision";
import { apiError, apiOk } from "@/lib/api/envelope";
import { TRUST_CONFIG } from "@/lib/trust/config";

/**
 * UR E.31 C2 我的投诉（🔒）。
 * `GET /api/v1/me/complaints?role=filed|against&limit=&cursor=` —— 行含对方昵称
 * （safety 外被投訴視角对方 null）、`can_respond`／`can_appeal`（iOS 据此置灰）。
 * 不含 ai_json／flags／decided_by（内部审计只给 admin）。
 */
export async function GET(req: Request): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  const q = new URL(req.url).searchParams;
  const role = q.get("role") === "against" ? "against" : "filed";
  const limitRaw = Number(q.get("limit"));
  const limit = Number.isInteger(limitRaw) && limitRaw >= 1 && limitRaw <= 50 ? limitRaw : 20;
  const cursor = q.get("cursor");
  const cursorMs = cursor !== null ? Date.parse(cursor) : NaN;
  const svc = await createServiceClient();
  const nowMs = Date.now();
  let query = svc
    .from("complaints")
    .select("id,party_id,filer_id,target_id,category,detail,response_text,response_due_at,status,decision,public_reason,decided_at,appeal_status,created_at")
    .eq(role === "filed" ? "filer_id" : "target_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);
  if (Number.isFinite(cursorMs)) {
    query = query.lt("created_at", new Date(cursorMs).toISOString());
  }
  const { data: rows, error } = await query;
  if (error !== null) {
    console.error(`[api/v1/me/complaints] list error: code=${error.code} message=${error.message}`);
    return apiError("internal", "投訴讀取失敗", 500);
  }
  const list = ((rows ?? []) as unknown[]).slice(0, limit + 1);
  const page = list.slice(0, limit);
  const peerIds = [
    ...new Set(
      (page as Record<string, unknown>[])
        .map((r) => (role === "filed" ? r.target_id : r.filer_id))
        .filter((id): id is string => typeof id === "string" && id !== ""),
    ),
  ];
  const peerById = new Map<string, { nickname: string; avatar_url: string | null }>();
  if (peerIds.length > 0) {
    const { data: peers } = await svc.from("users").select("id,nickname,avatar_url").in("id", peerIds);
    for (const p of ((peers ?? []) as unknown[]) as Record<string, unknown>[]) {
      if (typeof p.id !== "string") continue;
      peerById.set(p.id, {
        nickname: typeof p.nickname === "string" && p.nickname !== "" ? p.nickname : "酒友",
        avatar_url: typeof p.avatar_url === "string" ? p.avatar_url : null,
      });
    }
  }
  const items = (page as Record<string, unknown>[]).map((r) => {
    const peerId =
      typeof (role === "filed" ? r.target_id : r.filer_id) === "string"
        ? ((role === "filed" ? r.target_id : r.filer_id) as string)
        : null;
    const peer = peerId !== null ? peerById.get(peerId) ?? null : null;
    const hidePeer = role === "against" && r.category !== "safety";
    const due = typeof r.response_due_at === "string" ? Date.parse(r.response_due_at) : NaN;
    const decided = typeof r.decided_at === "string" ? Date.parse(r.decided_at) : NaN;
    return {
      id: r.id,
      party_id: r.party_id,
      party_place: null,
      category: r.category,
      status: r.status,
      my_role: role,
      counterpart: hidePeer || peer === null ? null : { ...peer, user_id: peerId },
      detail: role === "filed" ? r.detail : null,
      response_text: r.response_text ?? null,
      response_due_at: r.response_due_at ?? null,
      decision: r.decision ?? null,
      decision_note: publicReasonText(r.public_reason) || null,
      created_at: r.created_at,
      decided_at: r.decided_at ?? null,
      can_respond:
        role === "against" &&
        r.status === "awaiting_response" &&
        Number.isFinite(due) &&
        nowMs <= (due as number),
      can_appeal:
        isAdverseParty(r.status, role === "filed", role === "against") &&
        r.appeal_status !== "pending" &&
        Number.isFinite(decided) &&
        nowMs <= (decided as number) + TRUST_CONFIG.appeal_window_days * 24 * 3600_000,
    };
  });
  // party_place 批量（卡片展示用）。
  const partyIds = [...new Set(items.map((it) => (it as Record<string, unknown>).party_id).filter((id): id is string => typeof id === "string"))];
  if (partyIds.length > 0) {
    const { data: parties } = await svc.from("parties").select("id,place").in("id", partyIds);
    const placeById = new Map(
      ((parties ?? []) as unknown[]).map((p) => [(p as { id?: unknown }).id, (p as { place?: unknown }).place]),
    );
    for (const it of items) {
      const rec = it as Record<string, unknown>;
      rec.party_place = typeof rec.party_id === "string" ? (placeById.get(rec.party_id) ?? null) : null;
    }
  }
  const nextCursor =
    list.length > limit && page.length > 0
      ? ((page[page.length - 1] as Record<string, unknown>).created_at as string | null) ?? null
      : null;
  return apiOk({ complaints: items, nextCursor });
}
