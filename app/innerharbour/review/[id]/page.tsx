import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { evidenceStoragePath } from "@/lib/complaints";
import { decideComplaint, isPublicReasonKey, PUBLIC_REASONS, type Decision, type PublicReasonKey } from "@/lib/complaintDecision";
import { adminRateLimited, auditOrThrow, auditViewOnce, checkSameOrigin, logAdmin } from "@/lib/ops";
import { requireAdminPage } from "@/lib/opsPage";

export const metadata = { robots: { index: false, follow: false } };

/** 人工可選的對外理由（用戶只會看到這些固定文案；內部備註永不外發）。 */
const MANUAL_REASONS: PublicReasonKey[] = [
  "evidence_confirmed",
  "insufficient_evidence",
  "contradicted_by_records",
  "guideline_violation",
  "not_factual",
];

const ERROR_TEXT: Record<string, string> = {
  not_found: "案件不存在",
  invalid_state: "此案件目前不可判定（只有「待人工」或申訴中的案件可判）",
  busy: "另一位審核員正在處理，請稍後刷新",
  failed: "判定執行失敗，請稍後重試（未重複扣分）",
};

/**
 * 內部審核詳情＋操作（UR E.31 C2；白名單＋TOTP，非管理員 404）。
 * 操作：成立（選 severity）／駁回／惡意；申訴案維持原判或改判（改判需第二人）。
 * 寫操作：moderator＋新鮮 TOTP＋同源校驗＋限速；先寫審計（失敗即中止）。
 */
export default async function ReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId, role, svc } = await requireAdminPage({}, `/innerharbour/review/${id}`);
  const { data: cRaw } = await svc.from("complaints").select("*").eq("id", id).maybeSingle();
  const c = cRaw as Record<string, unknown> | null;
  if (c === null) notFound();
  // 查看敏感詳情留痕（寫失敗即中止顯示；同案 60 秒內合併）。
  await auditViewOnce(svc, { admin_id: userId, action: "view_complaint", target: id });

  async function decide(formData: FormData): Promise<never> {
    "use server";
    // 寫操作：moderator＋新鮮 TOTP；缺則引導到 MFA 頁（回到本案）。
    const g = await requireAdminPage({ write: true, stepUp: true }, `/innerharbour/review/${id}`);
    if (!(await checkSameOrigin())) throw new Error("跨站請求被拒");
    const decisionRaw = String(formData.get("decision") ?? "");
    if (decisionRaw !== "uphold" && decisionRaw !== "dismiss" && decisionRaw !== "malicious") {
      throw new Error("decision 非法");
    }
    const decision: Decision = decisionRaw;
    const reasonRaw = String(formData.get("reason") ?? "");
    if (!isPublicReasonKey(reasonRaw) || !MANUAL_REASONS.includes(reasonRaw)) throw new Error("對外理由非法");
    const note = String(formData.get("note") ?? "").trim().slice(0, 500);
    if (note === "") throw new Error("內部備註必填");
    const sevRaw = Number(formData.get("severity") ?? 1);
    const severity = sevRaw === 3 ? 3 : sevRaw === 2 ? 2 : 1;
    if (await adminRateLimited(g.svc, g.userId, ["decide_attempt"], 30, 600_000)) {
      throw new Error("操作過於頻繁，請稍後再試");
    }
    const { data: full } = await g.svc
      .from("complaints")
      .select("status,filer_id,target_id,party_id,decided_by,appeal_status")
      .eq("id", id)
      .maybeSingle();
    const f = full as {
      status?: unknown; filer_id?: unknown; target_id?: unknown; party_id?: unknown; decided_by?: unknown; appeal_status?: unknown;
    } | null;
    if (f === null) notFound();
    // 涉己回避（投訴人／被投訴人／同局成員／局主）。
    if (f.filer_id === g.userId || f.target_id === g.userId) throw new Error("涉己案件不可審理");
    if (typeof f.party_id === "string") {
      const [{ data: myJoin }, { data: myParty }] = await Promise.all([
        g.svc.from("joins").select("user_id").eq("party_id", f.party_id).eq("user_id", g.userId).maybeSingle(),
        g.svc.from("parties").select("host_user_id").eq("id", f.party_id).maybeSingle(),
      ]);
      if (myJoin !== null || (myParty as { host_user_id?: unknown } | null)?.host_user_id === g.userId) {
        throw new Error("同局案件不可審理");
      }
    }
    // 申訴案：第二人覆核（原判不是本人）。
    const prevBy = typeof f.decided_by === "string" && f.decided_by.startsWith("human:") ? f.decided_by.slice(6) : null;
    if (f.appeal_status === "pending" && prevBy !== null && prevBy === g.userId) {
      throw new Error("申訴改判需第二人覆核");
    }
    // 先寫審計（意圖）；失敗即中止，不執行判定。
    await auditOrThrow(g.svc, {
      admin_id: g.userId,
      action: "decide_attempt",
      target: id,
      detail: { decision, severity, reason: reasonRaw, note: note.slice(0, 200) },
    });
    const r = await decideComplaint(g.svc, id, decision, {
      severity, internalNote: note, publicReason: reasonRaw, by: `human:${g.userId}`,
    });
    await logAdmin(g.svc, {
      admin_id: g.userId,
      action: r.ok ? `decide_${r.outcome}` : "decide_rejected",
      target: id,
      detail: r.ok ? { decision } : { error: r.error },
    });
    if (!r.ok) throw new Error(ERROR_TEXT[r.error] ?? "判定失敗");
    redirect("/innerharbour/review");
  }

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
  const ai = c.ai_json as {
    suggestion?: { recommended?: unknown; severity?: unknown; confidence?: unknown; evidence_strength?: unknown; rationale?: unknown };
    model?: unknown;
  } | null;
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
          證據：
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
            : "（無）"}
        </p>
      </section>
      <section>
        <h2>時間線／到場</h2>
        <pre style={{ whiteSpace: "pre-wrap" }}>
          {JSON.stringify({ events: events ?? [], attendance: atts ?? [] }, null, 1)}
        </pre>
      </section>
      <section>
        <h2>AI 建議（僅參考）</h2>
        <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(ai ?? { none: true }, null, 1)}</pre>
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
          <form action={decide}>
            {isAppeal && <p>申訴案：與原判相同＝維持原判（不動積分）；不同＝沖銷原扣分後按新判執行，且需第二位審核員。</p>}
            <label>
              決定：
              <select name="decision" defaultValue="uphold">
                <option value="uphold">成立</option>
                <option value="dismiss">駁回</option>
                <option value="malicious">惡意</option>
              </select>
            </label>{" "}
            <label>
              severity（成立·騷擾用）：
              <select name="severity" defaultValue="1">
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
              </select>
            </label>{" "}
            <label>
              對外理由（用戶可見）：
              <select name="reason" defaultValue="evidence_confirmed">
                {MANUAL_REASONS.map((k) => (
                  <option key={k} value={k}>
                    {PUBLIC_REASONS[k]}
                  </option>
                ))}
              </select>
            </label>
            <p>
              <label>
                內部備註（必填，僅後台可見，不會發給任何用戶）：
                <br />
                <textarea name="note" rows={3} cols={60} required maxLength={500} />
              </label>
            </p>
            <button type="submit">執行（需新鮮二次驗證；已判定的案件不可重複執行）</button>
          </form>
        )}
      </section>
    </main>
  );
}
