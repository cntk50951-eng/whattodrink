import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { mergeBarMemory, sanitizeBarMemory } from "@/lib/barMemory";

/**
 * 酒保記憶（🔒；只存摘要，不留原始對話）。
 * `GET /api/v1/me/bar-memory` → `{doc, rev}`（沒有記憶 `doc:null, rev:0`）
 * `PUT /api/v1/me/bar-memory {doc, base_rev}` → `{doc, rev, merged}`：base_rev 等於當前 rev 直接覆蓋；
 *   落後（另一設備先寫了）→ 服務端把兩份合併後存，回合併結果（merged:true），客戶端用回包替換本地。
 * `DELETE /api/v1/me/bar-memory` → `{ok:true}`（「忘記我」）。
 * 表只有服務端讀寫（RLS 無策略），這裡一律按 userId 限域。
 */

type Row = { doc?: unknown; rev?: unknown };

export async function GET(req: Request): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) return apiError("unauthorized", "未登录", 401);
  const svc = await createServiceClient();
  const { data, error } = await svc.from("bar_memories").select("doc,rev").eq("user_id", userId).maybeSingle();
  if (error !== null) {
    console.error(`[api/v1/me/bar-memory] get error: code=${error.code} message=${error.message}`);
    return apiError("internal", "讀取失敗", 500);
  }
  const row = data as Row | null;
  const doc = row === null ? null : sanitizeBarMemory(row.doc);
  return apiOk({ doc, rev: row !== null && typeof row.rev === "number" ? row.rev : 0 });
}

export async function PUT(req: Request): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) return apiError("unauthorized", "未登录", 401);
  let body: { doc?: unknown; base_rev?: unknown };
  try {
    body = await req.json();
  } catch {
    return apiError("invalid_params", "body 需为 JSON", 400);
  }
  const incoming = sanitizeBarMemory(body.doc);
  if (incoming === null) return apiError("invalid_params", "doc 非法", 400);
  const baseRev = typeof body.base_rev === "number" && Number.isInteger(body.base_rev) && body.base_rev >= 0 ? body.base_rev : 0;
  const svc = await createServiceClient();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await svc.from("bar_memories").select("doc,rev").eq("user_id", userId).maybeSingle();
    if (error !== null) {
      console.error(`[api/v1/me/bar-memory] put read error: code=${error.code} message=${error.message}`);
      return apiError("internal", "保存失敗", 500);
    }
    const cur = data as Row | null;
    if (cur === null) {
      const { error: iErr } = await svc.from("bar_memories").insert({ user_id: userId, doc: incoming, rev: 1 });
      if (iErr === null) return apiOk({ doc: incoming, rev: 1, merged: false });
      if (iErr.code === "23505") continue; // 並發先插入了：重讀走合併
      console.error(`[api/v1/me/bar-memory] insert error: code=${iErr.code} message=${iErr.message}`);
      return apiError("internal", "保存失敗", 500);
    }
    const curRev = typeof cur.rev === "number" ? cur.rev : 0;
    const curDoc = sanitizeBarMemory(cur.doc);
    const stale = baseRev !== curRev;
    const next = stale && curDoc !== null ? mergeBarMemory(curDoc, incoming) : incoming;
    const { data: upd, error: uErr } = await svc
      .from("bar_memories")
      .update({ doc: next, rev: curRev + 1, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("rev", curRev)
      .select("rev");
    if (uErr !== null) {
      console.error(`[api/v1/me/bar-memory] update error: code=${uErr.code} message=${uErr.message}`);
      return apiError("internal", "保存失敗", 500);
    }
    if (Array.isArray(upd) && upd.length > 0) return apiOk({ doc: next, rev: curRev + 1, merged: stale && curDoc !== null });
    // rev 被別人搶先改了：重讀再來
  }
  return apiError("duplicate", "同步衝突，請稍後再試", 409);
}

export async function DELETE(req: Request): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) return apiError("unauthorized", "未登录", 401);
  const svc = await createServiceClient();
  const { error } = await svc.from("bar_memories").delete().eq("user_id", userId);
  if (error !== null) {
    console.error(`[api/v1/me/bar-memory] delete error: code=${error.code} message=${error.message}`);
    return apiError("internal", "刪除失敗", 500);
  }
  return apiOk({ ok: true });
}
