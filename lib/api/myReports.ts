/**
 * 「我的舉報」舉報人視角（iOS DEF-20261125-021〜024；純函數可單測）。
 * 只給舉報人看得懂的狀態與結案說明：不回 AI 分數、類別、被舉報人的其他舉報數、審核人身份。
 */

export const MY_REPORTS_LIMIT_DEFAULT = 20;
export const MY_REPORTS_LIMIT_MAX = 50;

/** 0090 起的完整欄位；0090 未遷移時退回 LEGACY */
export const MY_REPORT_COLUMNS =
  "id,target_type,target_ref,target_user_id,reason_code,reason,status,snapshot,created_at,decided_at,decided_by,ai_decision,ai_checked_at,decision_note";
export const MY_REPORT_COLUMNS_LEGACY =
  "id,target_type,target_ref,target_user_id,reason_code,reason,status,snapshot,created_at,decided_at,decided_by";

export type MyReportRow = {
  id: string;
  target_type?: unknown;
  target_ref?: unknown;
  target_user_id?: unknown;
  reason_code?: unknown;
  reason?: unknown;
  status?: unknown;
  snapshot?: unknown;
  created_at?: unknown;
  decided_at?: unknown;
  decided_by?: unknown;
  ai_decision?: unknown;
  ai_checked_at?: unknown;
  decision_note?: unknown;
};

/** 舉報人看到的狀態：處理中／已處理（成立）／未發現違規 */
export type MyReportStatus = "reviewing" | "actioned" | "dismissed";
/** 處理中的細分：剛提交（AI 未跑完）／人工審核中 */
export type MyReportStage = "submitted" | "human_review" | "closed";

const str = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);

export function myReportStatus(status: unknown): MyReportStatus {
  if (status === "actioned") return "actioned";
  if (status === "dismissed") return "dismissed";
  return "reviewing";
}

export function myReportStage(row: Pick<MyReportRow, "status" | "ai_decision">): MyReportStage {
  if (myReportStatus(row.status) !== "reviewing") return "closed";
  // 已被管理員標「reviewed」或 AI 分流到人工 → 人工審核中；其餘＝剛提交、系統初審中
  if (row.status === "reviewed" || row.ai_decision === "human") return "human_review";
  return "submitted";
}

/** 誰結的案：系統（AI 高置信自動）／客服（人工）；未結案 null */
export function myReportDecidedBy(row: Pick<MyReportRow, "status" | "ai_decision" | "decided_by">): "system" | "staff" | null {
  if (myReportStatus(row.status) === "reviewing") return null;
  if (str(row.decided_by) !== null) return "staff";
  if (row.ai_decision === "auto_actioned" || row.ai_decision === "auto_dismissed") return "system";
  return "staff";
}

export type MyReportTarget = { nickname: string | null; avatar_url: string | null; place_name: string | null };

export function toMyReportItem(row: MyReportRow, target: MyReportTarget | undefined): Record<string, unknown> {
  const tt = row.target_type === "post" || row.target_type === "message" ? row.target_type : "user";
  return {
    id: row.id,
    target_type: tt,
    target_ref: str(row.target_ref),
    target_name: target?.nickname ?? null,
    target_avatar_url: target?.avatar_url ?? null,
    place_name: tt === "post" ? (target?.place_name ?? null) : null,
    reason_code: str(row.reason_code),
    reason: str(row.reason),
    status: myReportStatus(row.status),
    stage: myReportStage(row),
    decided_by: myReportDecidedBy(row),
    decision_note: str(row.decision_note),
    created_at: str(row.created_at),
    decided_at: myReportStatus(row.status) === "reviewing" ? null : str(row.decided_at),
  };
}

/** 詳情：多回證據快照（舉報當下的文字；舉報人本來就看得到）與時間線 */
export function toMyReportDetail(row: MyReportRow, target: MyReportTarget | undefined): Record<string, unknown> {
  const base = toMyReportItem(row, target);
  const evidence = Array.isArray(row.snapshot)
    ? (row.snapshot as unknown[])
        .filter((l): l is Record<string, unknown> => typeof l === "object" && l !== null)
        .map((l) => ({
          who: l.who === "reported" || l.who === "reporter" ? l.who : "other",
          kind: typeof l.kind === "string" ? l.kind : "text",
          text: typeof l.text === "string" ? l.text : "",
          at: str(l.at),
        }))
    : [];
  const timeline: Array<{ step: string; at: string | null }> = [{ step: "submitted", at: str(row.created_at) }];
  if (row.ai_decision === "human" || row.status === "reviewed") timeline.push({ step: "human_review", at: str(row.ai_checked_at) });
  if (base.status !== "reviewing") timeline.push({ step: String(base.status), at: base.decided_at as string | null });
  return { ...base, evidence, timeline };
}

export function parseMyReportsLimit(raw: string | null): number {
  const n = raw === null ? NaN : Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return MY_REPORTS_LIMIT_DEFAULT;
  return Math.min(n, MY_REPORTS_LIMIT_MAX);
}

type SvcLike = {
  from: (table: string) => {
    select: (cols: string) => { in: (col: string, vals: string[]) => PromiseLike<{ data: unknown; error: unknown }> };
  };
};

/** 一次查完列表裡的被舉報人暱稱／頭像與帖子地點（查不到就留空，不擋列表） */
export async function loadMyReportTargets(svc: SvcLike, rows: MyReportRow[]): Promise<Map<string, MyReportTarget>> {
  const userIds = [...new Set(rows.map((r) => str(r.target_user_id)).filter((x): x is string => x !== null))];
  const postIds = [...new Set(rows.filter((r) => r.target_type === "post").map((r) => str(r.target_ref)).filter((x): x is string => x !== null))];
  const [users, posts] = await Promise.all([
    userIds.length > 0 ? svc.from("users").select("id,nickname,avatar_url").in("id", userIds) : Promise.resolve({ data: [], error: null }),
    postIds.length > 0 ? svc.from("checkins").select("id,place_name").in("id", postIds) : Promise.resolve({ data: [], error: null }),
  ]);
  const userById = new Map<string, { nickname: string | null; avatar_url: string | null }>();
  for (const u of (Array.isArray(users.data) ? users.data : []) as Array<Record<string, unknown>>) {
    if (typeof u.id === "string") userById.set(u.id, { nickname: str(u.nickname), avatar_url: str(u.avatar_url) });
  }
  const placeById = new Map<string, string | null>();
  for (const p of (Array.isArray(posts.data) ? posts.data : []) as Array<Record<string, unknown>>) {
    if (typeof p.id === "string") placeById.set(p.id, str(p.place_name));
  }
  const out = new Map<string, MyReportTarget>();
  for (const r of rows) {
    const u = userById.get(str(r.target_user_id) ?? "");
    const ref = str(r.target_ref);
    out.set(r.id, {
      nickname: u?.nickname ?? null,
      avatar_url: u?.avatar_url ?? null,
      place_name: r.target_type === "post" && ref !== null ? (placeById.get(ref) ?? null) : null,
    });
  }
  return out;
}
