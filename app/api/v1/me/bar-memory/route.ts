import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { mergeBarMemory, sanitizeBarMemory } from "@/lib/barMemory";

/**
 * 酒保記憶（🔒；只存摘要，不留原始對話）。
 * `GET /api/v1/me/bar-memory` → `{doc, rev}`（沒有記憶 `doc:null, rev:0`）
 * `PUT /api/v1/me/bar-memory {doc, base_rev}` → `{doc, rev, merged}`：base_rev 等於當前 rev 直接覆蓋；
 *   落後（另一設備先寫了）→ 服務端把兩份合併後存，回合併結果（merged:true），客戶端用回包替換本地。
 *   服務端沒有這一列但 base_rev>0（另一台設備已「忘記我」）→ 409 stale_version，不重建。
 * `DELETE /api/v1/me/bar-memory` → `{ok:true}`（「忘記我」）。0085 起保留墓碑行（rev 只增不減＋forgot_rev），
 *   base_rev 落在 (0, forgot_rev] 的 PUT 是忘記之前的寫入，一律 409，不能被「rev 重新從 1 開始」碰巧對上。
 * 表只有服務端讀寫（RLS 無策略），這裡一律按 userId 限域。
 */

type Row = { doc?: unknown; rev?: unknown; deleted_at?: unknown; forgot_rev?: unknown };

type SvcClient = Awaited<ReturnType<typeof createServiceClient>>;
const isMissingColumn = (e: { code?: string } | null): boolean => e !== null && (e.code === "42703" || e.code === "PGRST204");

/** 讀記憶行；0085 沒跑（缺欄位）就退回舊欄位集，行為同改前。 */
async function readRow(svc: SvcClient, userId: string): Promise<{ row: Row | null; error: { code?: string; message?: string } | null }> {
  const full = await svc.from("bar_memories").select("doc,rev,deleted_at,forgot_rev").eq("user_id", userId).maybeSingle();
  if (full.error !== null && isMissingColumn(full.error)) {
    const legacy = await svc.from("bar_memories").select("doc,rev").eq("user_id", userId).maybeSingle();
    return { row: legacy.data as Row | null, error: legacy.error };
  }
  return { row: full.data as Row | null, error: full.error };
}
const isTombstone = (r: Row | null): boolean => r !== null && r.deleted_at !== null && r.deleted_at !== undefined;

export async function GET(req: Request): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) return apiError("unauthorized", "未登录", 401);
  const svc = await createServiceClient();
  const { row: read, error } = await readRow(svc, userId);
  if (error !== null) {
    console.error(`[api/v1/me/bar-memory] get error: code=${error.code} message=${error.message}`);
    return apiError("internal", "讀取失敗", 500);
  }
  // 墓碑行對客戶端等同「沒有記憶」（doc:null, rev:0），與舊的刪列行為一致
  const row = isTombstone(read) ? null : read;
  const doc = row === null ? null : sanitizeBarMemory(row.doc);
  return apiOk({ doc, rev: row !== null && typeof row.rev === "number" ? row.rev : 0 });
}

export async function PUT(req: Request): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) return apiError("unauthorized", "未登录", 401);
  let body: { doc?: unknown; base_rev?: unknown; captured_at?: unknown };
  try {
    body = await req.json();
  } catch {
    return apiError("invalid_params", "body 需为 JSON", 400);
  }
  const incoming = sanitizeBarMemory(body.doc);
  if (incoming === null) return apiError("invalid_params", "doc 非法", 400);
  const baseRev = typeof body.base_rev === "number" && Number.isInteger(body.base_rev) && body.base_rev >= 0 ? body.base_rev : 0;
  const capturedAtMs = typeof body.captured_at === "string" && Number.isFinite(Date.parse(body.captured_at)) ? Date.parse(body.captured_at) : null;
  const svc = await createServiceClient();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { row: cur, error } = await readRow(svc, userId);
    if (error !== null) {
      console.error(`[api/v1/me/bar-memory] put read error: code=${error.code} message=${error.message}`);
      return apiError("internal", "保存失敗", 500);
    }
    const forgotRev = cur !== null && typeof cur.forgot_rev === "number" ? cur.forgot_rev : 0;
    // 忘記之前的寫入（base_rev 落在 (0, forgot_rev]）：即使目前 rev 碰巧等於它，也不能當最新版覆蓋
    if (baseRev > 0 && baseRev <= forgotRev) return apiError("stale_version", "記憶已在另一台設備被清除", 409);
    if (cur !== null && isTombstone(cur)) {
      if (baseRev > 0) return apiError("stale_version", "記憶已在另一台設備被清除", 409);
      // 第十一輪 §3.3：離線首次累積（base_rev=0）若帶 captured_at 且早於或等於墓碑 deleted_at，屬忘記前舊對話，拒絕復活
      const deletedAtMs = typeof cur.deleted_at === "string" && Number.isFinite(Date.parse(cur.deleted_at)) ? Date.parse(cur.deleted_at) : null;
      if (capturedAtMs !== null && deletedAtMs !== null && capturedAtMs <= deletedAtMs) {
        return apiError("stale_version", "記憶已在另一台設備被清除", 409);
      }
      // base_rev=0＝忘記後重新累積：復活墓碑，rev 接著往上走（不回到 1）
      const curRev = typeof cur.rev === "number" ? cur.rev : 0;
      const { data: rev, error: rErr } = await svc
        .from("bar_memories")
        .update({ doc: incoming, rev: curRev + 1, deleted_at: null, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("rev", curRev)
        .select("rev");
      if (rErr !== null) {
        console.error(`[api/v1/me/bar-memory] revive error: code=${rErr.code} message=${rErr.message}`);
        return apiError("internal", "保存失敗", 500);
      }
      if (Array.isArray(rev) && rev.length > 0) return apiOk({ doc: incoming, rev: curRev + 1, merged: false });
      continue; // 並發先改了：重讀
    }
    if (cur === null) {
      // 客戶端帶著 base_rev>0（它同步過一份記憶）而服務端已沒有這一列＝另一台設備「忘記我」了：
      // 這是刪除前的舊寫入，不能當作新建，否則剛忘記的內容會被舊裝置重建（第五輪審核）。
      // base_rev=0 才是真正的首次建立（新用戶、或忘記之後重新累積）。客戶端收到後對賬會跟著清本機。
      if (baseRev > 0) return apiError("stale_version", "記憶已在另一台設備被清除", 409);
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
  // 忘記＝墓碑行（rev 只增不減＋forgot_rev）；0085 沒跑（缺欄位）才退回直接刪列。
  // 第八輪 R8-01：墓碑 update 帶 `.eq("rev", 讀到的 rev)`（compare-and-set）——讀與寫之間若有並發 PUT 先把 rev 推進，
  // 舊寫法會用過期的 rev+1 覆蓋，讓 rev 倒退／重複；現在 CAS 落空就重讀再來（最多 3 次）。
  let legacy = false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { row: cur, error: readErr } = await readRow(svc, userId);
    if (readErr !== null) {
      console.error(`[api/v1/me/bar-memory] delete read error: code=${readErr.code} message=${readErr.message}`);
      return apiError("internal", "刪除失敗", 500);
    }
    if (cur === null || isTombstone(cur)) return apiOk({ ok: true });
    const curRev = typeof cur.rev === "number" ? cur.rev : 0;
    const nowIso = new Date().toISOString();
    const tomb = await svc
      .from("bar_memories")
      .update({ doc: {}, rev: curRev + 1, deleted_at: nowIso, forgot_rev: curRev + 1, updated_at: nowIso })
      .eq("user_id", userId)
      .eq("rev", curRev)
      .select("rev");
    if (tomb.error === null) {
      if (Array.isArray(tomb.data) && tomb.data.length > 0) return apiOk({ ok: true });
      continue; // 被並發寫入搶先改了 rev：重讀
    }
    if (!isMissingColumn(tomb.error)) {
      console.error(`[api/v1/me/bar-memory] forget error: code=${tomb.error.code} message=${tomb.error.message}`);
      return apiError("internal", "刪除失敗", 500);
    }
    legacy = true;
    break; // 缺欄位（0085 沒跑）：退回直接刪列
  }
  if (!legacy) return apiError("duplicate", "同步衝突，請稍後再試", 409);
  const { error } = await svc.from("bar_memories").delete().eq("user_id", userId);
  if (error !== null) {
    console.error(`[api/v1/me/bar-memory] delete error: code=${error.code} message=${error.message}`);
    return apiError("internal", "刪除失敗", 500);
  }
  return apiOk({ ok: true });
}
