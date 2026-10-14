import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { DECIDE_ERR_TEXT, evidenceStoragePath, reviewEventKindLabel } from "@/lib/complaints";
import { decideComplaint, isPublicReasonKey, PUBLIC_REASONS, type Decision, type PublicReasonKey } from "@/lib/complaintDecision";
import { adminGate, adminRateLimited, auditOrThrow, auditViewOnce, checkSameOrigin, logAdmin } from "@/lib/ops";
import { requireAdminPage } from "@/lib/opsPage";
import { allowSelfCaseEnabled, isSelfCase, loadReviewContext, selfCaseBlock } from "@/lib/reviewContext";

import CaseContext from "./CaseContext";
import DecideForm from "./DecideForm";

export const metadata = { robots: { index: false, follow: false } };

/** 人工可選的對外理由（用戶只會看到這些固定文案；內部備註永不外發）。 */
const MANUAL_REASONS: PublicReasonKey[] = [
  "evidence_confirmed",
  "insufficient_evidence",
  "contradicted_by_records",
  "guideline_violation",
  "not_factual",
];

/**
 * 內部審核詳情＋操作（UR E.31 C2；白名單＋TOTP，非管理員 404）。
 * 操作：成立（選 severity）／駁回／惡意；申訴案維持原判或改判（改判需第二人）。
 * 寫操作：moderator＋新鮮 TOTP＋同源校驗＋限速；先寫審計（失敗即中止）。
 * DEF-20261014-002：動作失敗一律 `?err=` 回頁顯字，不再裸 404（notFound 只留給案件行真不存在）。
 */
export default async function ReviewDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ err?: string }>;
}) {
  const { id } = await params;
  const { userId, role, svc } = await requireAdminPage({}, `/innerharbour/review/${id}`);
  const { data: cRaw } = await svc.from("complaints").select("*").eq("id", id).maybeSingle();
  const c = cRaw as Record<string, unknown> | null;
  if (c === null) notFound();
  // 查看敏感詳情留痕（寫失敗即中止顯示；同案 60 秒內合併）。
  await auditViewOnce(svc, { admin_id: userId, action: "view_complaint", target: id });

  async function decide(formData: FormData): Promise<never> {
    "use server";
    const self = `/innerharbour/review/${id}`;
    const back = (code: string): never => redirect(`${self}?err=${code}#err`);
    // 直接用 adminGate（只返回不拋）：need_mfa／need_stepup 去 MFA 頁，其餘失敗回頁顯字。
    const gate = await adminGate({ write: true, stepUp: true });
    if (!gate.ok) {
      if (gate.reason === "need_mfa" || gate.reason === "need_stepup") {
        redirect(`/innerharbour/mfa?next=${encodeURIComponent(self)}`);
      }
      back(gate.reason === "forbidden_role" ? "forbidden" : "session_expired");
      throw new Error("unreachable"); // 收窄用：back 永不返回，此行只為 TS 收窄 gate
    }
    const gsvc = gate.svc;
    const adminId = gate.userId;
    if (!(await checkSameOrigin())) back("csrf");
    const decisionRaw = String(formData.get("decision") ?? "");
    if (decisionRaw !== "uphold" && decisionRaw !== "dismiss" && decisionRaw !== "malicious") {
      back("invalid_input");
    }
    // 上已驗證三選一，as 收窄（不用 any）。
    const decision = decisionRaw as Decision;
    const reasonRaw = String(formData.get("reason") ?? "");
    const reasonKey: PublicReasonKey | null =
      isPublicReasonKey(reasonRaw) && (MANUAL_REASONS as readonly string[]).includes(reasonRaw)
        ? reasonRaw
        : null;
    if (reasonKey === null) {
      back("invalid_input");
      throw new Error("unreachable"); // 收窄用：back 永不返回
    }
    const note = String(formData.get("note") ?? "").trim().slice(0, 500);
    if (note === "") back("note_required");
    const sevRaw = Number(formData.get("severity") ?? 1);
    const severity = sevRaw === 3 ? 3 : sevRaw === 2 ? 2 : 1;
    if (await adminRateLimited(gsvc, adminId, ["decide_attempt"], 30, 600_000)) {
      back("rate_limited");
    }
    const { data: full } = await gsvc
      .from("complaints")
      .select("status,filer_id,target_id,party_id,decided_by,appeal_status")
      .eq("id", id)
      .maybeSingle();
    const f = full as {
      status?: unknown; filer_id?: unknown; target_id?: unknown; party_id?: unknown; decided_by?: unknown; appeal_status?: unknown;
    } | null;
    if (f === null) notFound();
    // 涉己回避（投訴人／被投訴人／同局成員／局主）。測試／單管理員階段可用 ADMIN_ALLOW_SELF_CASE=true 顯式放行
    // （默認關；放行時審計會標 self_review:true，頁面頂部也有橫幅）。
    let partyHostId: unknown = null;
    let adminInParty = false;
    if (typeof f.party_id === "string") {
      const [{ data: myJoin }, { data: myParty }] = await Promise.all([
        gsvc.from("joins").select("user_id").eq("party_id", f.party_id).eq("user_id", adminId).maybeSingle(),
        gsvc.from("parties").select("host_user_id").eq("id", f.party_id).maybeSingle(),
      ]);
      adminInParty = myJoin !== null;
      partyHostId = (myParty as { host_user_id?: unknown } | null)?.host_user_id ?? null;
    }
    const conflict = { adminId, filerId: f.filer_id, targetId: f.target_id, partyHostId, adminInParty };
    const blocked = selfCaseBlock({ ...conflict, allowSelf: allowSelfCaseEnabled() });
    if (blocked !== null) back(blocked);
    const selfReview = allowSelfCaseEnabled() && isSelfCase(conflict);
    // 申訴案：第二人覆核（原判不是本人）。
    const prevBy = typeof f.decided_by === "string" && f.decided_by.startsWith("human:") ? f.decided_by.slice(6) : null;
    if (f.appeal_status === "pending" && prevBy !== null && prevBy === adminId) {
      back("second_review");
    }
    // 先寫審計（意圖）；失敗即中止，不執行判定。
    await auditOrThrow(gsvc, {
      admin_id: adminId,
      action: "decide_attempt",
      target: id,
      detail: { decision, severity, reason: reasonKey, note: note.slice(0, 200), self_review: selfReview },
    }).catch(() => back("audit_failed"));
    const r = await decideComplaint(gsvc, id, decision, {
      severity, internalNote: note, publicReason: reasonKey, by: `human:${adminId}`,
    }).catch(() => back("failed"));
    // 補記审计：判定已生效，補記失敗不推翻結果。
    await logAdmin(gsvc, {
      admin_id: adminId,
      action: r.ok ? `decide_${r.outcome}` : "decide_rejected",
      target: id,
      detail: r.ok ? { decision, self_review: selfReview } : { error: r.error },
    }).catch(() => undefined);
    if (!r.ok) {
      back(r.error === "busy" ? "busy" : r.error === "not_found" || r.error === "invalid_state" ? "state_changed" : "failed");
    }
    redirect("/innerharbour/review");
  }

  const ctx = await loadReviewContext(svc, c);
  const selfCaseMode = allowSelfCaseEnabled();
  const { err } = await searchParams;
  const errMsg =
    typeof err === "string" && err !== "" ? (DECIDE_ERR_TEXT[err] ?? "操作失敗，請刷新再試。") : null;

  const { data: events } = await svc
    .from("party_events")
    .select("user_id,kind,created_at")
    .eq("party_id", c.party_id)
    .order("created_at", { ascending: true })
    .limit(200);
  const { data: atts } = await svc
    .from("party_attendance")
    .select("user_id,arrived_at,host_marked")
    .eq("party_id", c.party_id)
    .limit(500);
  const eventRows = (((events ?? []) as unknown[]) as Record<string, unknown>[]);
  const attRows = (((atts ?? []) as unknown[]) as Record<string, unknown>[]);
  // 涉案双方＋出鏡用户昵称（仅内部可见；陈述区仍保持甲乙匿名）。
  const idSet = new Set<string>();
  for (const v of [c.filer_id, c.target_id]) {
    if (typeof v === "string" && v !== "") idSet.add(v);
  }
  for (const row of [...eventRows, ...attRows]) {
    if (typeof row.user_id === "string" && row.user_id !== "") idSet.add(row.user_id);
  }
  const { data: userRows } = idSet.size > 0
    ? await svc.from("users").select("id,nickname").in("id", [...idSet].slice(0, 600))
    : { data: [] as unknown[] };
  const nameById = new Map<string, string>();
  for (const u of ((userRows ?? []) as unknown[]) as Record<string, unknown>[]) {
    if (typeof u.id === "string") {
      nameById.set(u.id, typeof u.nickname === "string" && u.nickname !== "" ? u.nickname : "酒友");
    }
  }
  const nameOf = (uid: unknown): string => {
    if (typeof uid !== "string" || uid === "") return "—";
    return nameById.get(uid) ?? `用戶 ${uid.slice(0, 8)}`;
  };
  const ai = (c.ai_json ?? null) as {
    suggestion?: { recommended?: unknown; severity?: unknown; confidence?: unknown; evidence_strength?: unknown; rationale?: unknown };
    model?: unknown;
  } | null;
  const sug = ai?.suggestion ?? null;
  const hasAi = sug !== null || (ai !== null && ai.model !== undefined);
  // 證據在私有桶：審核時現簽 5 分鐘讀取鏈接（原始 URL 不可直接打開；簽名失敗顯示「無法載入」）。
  const evidenceLinks: (string | null)[] = [];
  for (const e of Array.isArray(c.evidence) ? (c.evidence as unknown[]) : []) {
    const path = typeof e === "string" ? evidenceStoragePath(e) : null;
    if (path === null) {
      evidenceLinks.push(null);
      continue;
    }
    const { data: signed } = await svc.storage.from("chat-images").createSignedUrl(path, 300);
    evidenceLinks.push(signed?.signedUrl ?? null);
  }
  const isAppeal = c.status === "escalated" && c.appeal_status === "pending";
  const canDecide = role === "moderator" && c.status === "escalated";

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 860 }}>
      <p>
        <Link href="/innerharbour/review">← 隊列</Link>
      </p>
      <h1>
        {String(c.category)} · {String(c.status)}
        {isAppeal ? " · 申訴中" : ""}
      </h1>
      {errMsg !== null && (
        <p id="err" role="alert" style={{ border: "2px solid crimson", color: "crimson", padding: 10, fontWeight: 700 }}>
          {errMsg}
        </p>
      )}
      {selfCaseMode && (
        <p style={{ border: "1px solid #b58900", color: "#7a5c00", padding: 8 }}>
          測試模式：已允許審核涉己案件（ADMIN_ALLOW_SELF_CASE=true）。此模式下的判定會在審計裡標記 self_review，
          正式運營請關閉。
        </p>
      )}
      <CaseContext ctx={ctx} />
      <section>
        <h2>雙方陳述（已匿名）</h2>
        <p>甲（投訴人）：{String(c.detail ?? "")}</p>
        <p>乙申辯：{typeof c.response_text === "string" && c.response_text !== "" ? c.response_text : "（無）"}</p>
        {isAppeal && (
          <>
            <p>申訴說明：{typeof c.appeal_text === "string" ? c.appeal_text : "（無）"}</p>
            <p>
              原判：{String(c.decision ?? "-")}（{typeof c.decided_by === "string" ? "他人/系統" : "-"}）；
              原內部備註：{typeof c.internal_note === "string" ? c.internal_note : "（無）"}
            </p>
          </>
        )}
        <p>
          證據截圖：
          {evidenceLinks.length > 0
            ? evidenceLinks.map((href, i) => (
                <span key={i}>
                  {href === null ? (
                    `圖${i + 1}（無法載入）`
                  ) : (
                    <a href={href} target="_blank" rel="noreferrer noopener" referrerPolicy="no-referrer">
                      圖{i + 1}
                    </a>
                  )}{" "}
                </span>
              ))
            : "投訴人未上傳截圖"}
        </p>
      </section>
      <section>
        <h2>時間線／到場</h2>
        <h3>事件</h3>
        {eventRows.length === 0 ? (
          <p>（無事件記錄）</p>
        ) : (
          <ul>
            {eventRows.map((e, i) => (
              <li key={i}>
                {nameOf(e.user_id)} · {reviewEventKindLabel(typeof e.kind === "string" ? e.kind : "")} ·{" "}
                {typeof e.created_at === "string" ? e.created_at : "—"}
              </li>
            ))}
          </ul>
        )}
        <h3>到場</h3>
        {attRows.length === 0 ? (
          <p>（無到場記錄）</p>
        ) : (
          <ul>
            {attRows.map((a, i) => (
              <li key={i}>
                {nameOf(a.user_id)} · 到達 {typeof a.arrived_at === "string" ? a.arrived_at : "—"} ·{" "}
                {a.host_marked === true ? "房主已標到場" : a.host_marked === false ? "房主標未到" : "無房主標記"}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2>AI 建議（僅參考）</h2>
        {!hasAi ? (
          <p>（無 AI 建議）</p>
        ) : (
          <ul>
            {sug !== null && (
              <>
                <li>建議：{typeof sug.recommended === "string" ? sug.recommended : "—"}</li>
                <li>severity：{typeof sug.severity === "number" ? sug.severity : "—"}</li>
                <li>confidence：{typeof sug.confidence === "number" ? sug.confidence : "—"}</li>
                <li>證據強度：{typeof sug.evidence_strength === "string" ? sug.evidence_strength : "—"}</li>
                <li>理由：{typeof sug.rationale === "string" ? sug.rationale : "—"}</li>
              </>
            )}
            {ai?.model !== undefined && <li>模型：{String(ai.model)}</li>}
          </ul>
        )}
      </section>
      <section>
        <h2>判定</h2>
        {!canDecide ? (
          <p>
            {role === "viewer"
              ? "你是只讀角色，不可判定。"
              : "此案件目前不可判定（只有「待人工」或申訴中的案件可判）。"}
          </p>
        ) : (
          <DecideForm
            action={decide}
            isAppeal={isAppeal}
            reasons={MANUAL_REASONS.map((key) => ({ key, label: PUBLIC_REASONS[key] }))}
          />
        )}
      </section>
    </main>
  );
}
