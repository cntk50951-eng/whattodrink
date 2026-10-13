import { notFound, redirect } from "next/navigation";

import { createServiceClient } from "@/lib/supabase/server";
import { cookieSessionUserId, logAdmin, requireAdmin } from "@/lib/ops";

/* eslint-disable react-hooks/purity -- Server Component 门禁＋详情读库＋Server Action 写库；整页无客户端渲染，无其他写法。 */

/**
 * 內部審核詳情＋操作（UR E.31 C2；白名單，非管理員 404）。
 * 展示：雙方陳述（匿名甲／乙）／申辯／證據／時間線／到場出席／90 天誠信摘要／AI 建議；
 * 操作：成立（選 severity）／駁回／惡意（備註必填）／申诉改判先沖銷。
 */
export default async function ReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // 清單 A3：只認 cookie 會話。
  const userId = await cookieSessionUserId();
  if (userId === null) notFound();
  const svc = await createServiceClient();
  if (!(await requireAdmin(svc, userId))) notFound();
  const { data: cRaw } = await svc.from("complaints").select("*").eq("id", id).maybeSingle();
  const c = cRaw as Record<string, unknown> | null;
  if (c === null) notFound();
  // 清單 D21：查看敏感详情落子。
  await logAdmin(svc, { admin_id: userId, action: "view_complaint", target: id });

  async function decide(formData: FormData): Promise<never> {
    "use server";
    const { cookieSessionUserId: cookieId, checkSameOrigin: sameOrigin, logAdmin: audit } = await import("@/lib/ops");
    const adminId = await cookieId();
    if (adminId === null) notFound();
    // 清單 B10：写操作验同源（CSRF）。
    if (!(await sameOrigin())) {
      throw new Error("跨站請求被拒");
    }
    const { createServiceClient: createSvc } = await import("@/lib/supabase/server");
    const { requireAdmin: needAdmin, reverseTrustEvent: reverse } = await import("@/lib/ops");
    const { applyDecision: apply } = await import("@/lib/complaints");
    const s = await createSvc();
    if (!(await needAdmin(s, adminId))) notFound();
    const decision = String(formData.get("decision") ?? "");
    const note = String(formData.get("note") ?? "").trim().slice(0, 500);
    if (note === "") throw new Error("備註必填");
    if (decision !== "uphold" && decision !== "dismiss" && decision !== "malicious") {
      throw new Error("decision 非法");
    }
    const sevRaw = Number(formData.get("severity") ?? 1);
    const severity = sevRaw === 3 ? 3 : sevRaw === 2 ? 2 : 1;
    const { data: full } = await s.from("complaints").select("status,decision,filer_id,target_id,party_id,decided_by,appeal_status").eq("id", id).maybeSingle();
    const f = full as {
      status?: unknown;
      filer_id?: unknown;
      target_id?: unknown;
      party_id?: unknown;
      decided_by?: unknown;
      appeal_status?: unknown;
    } | null;
    if (f === null) notFound();
    // 清單 A9 上半：审核员不能审涉己案件（投訴人／被投訴人／同局成员）。
    const involved = new Set<string>();
    if (typeof f.filer_id === "string") involved.add(f.filer_id);
    if (typeof f.target_id === "string") involved.add(f.target_id);
    if (involved.has(adminId)) {
      throw new Error("涉己案件不可審理");
    }
    if (typeof f.party_id === "string") {
      const { data: myJoin } = await s.from("joins").select("user_id").eq("party_id", f.party_id).eq("user_id", adminId).maybeSingle();
      const { data: myParty } = await s.from("parties").select("host_user_id").eq("id", f.party_id).maybeSingle();
      if (myJoin !== null || (myParty as { host_user_id?: unknown } | null)?.host_user_id === adminId) {
        throw new Error("同局案件不可審理");
      }
    }
    // 清單 A9 下半：申诉改判需第二人（原 decided_by 非本人）。
    const prevBy = typeof f.decided_by === "string" && f.decided_by.startsWith("human:") ? f.decided_by.slice(6) : null;
    const isAppealReview = f.appeal_status === "pending";
    if (isAppealReview && prevBy !== null && prevBy === adminId) {
      throw new Error("申诉改判需第二人覆核");
    }
    // 申诉改判：原扣分先沖銷（同 ref 审计保留两行）。
    const curStatus = f.status;
    if (curStatus === "upheld" || curStatus === "dismissed" || curStatus === "malicious") {
      const kinds = ["uphold", "dismiss", "malicious"];
      for (const k of kinds) {
        await reverse(s, `complaint:${id}:${k}`, Date.now());
      }
    }
    const r = await apply(s, id, decision, { severity, note, by: `human:${adminId}` });
    if (!r.ok) throw new Error("判定執行失敗");
    await audit(s, { admin_id: adminId, action: `decide_${decision}`, target: id, detail: { severity, note: note.slice(0, 200) } });
    redirect("./");
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

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 860 }}>
      <p>
        <a href="../review">← 隊列</a>
      </p>
      <h1>
        {String(c.category)} · {String(c.status)}
      </h1>
      <section>
        <h2>雙方陳述（已匿名）</h2>
        <p>甲（投訴人）：{String(c.detail ?? "")}</p>
        <p>乙申辯：{typeof c.response_text === "string" && c.response_text !== "" ? c.response_text : "（無）"}</p>
        <p>
          證據：
          {Array.isArray(c.evidence) && (c.evidence as unknown[]).length > 0
            ? (c.evidence as unknown[]).map((e, i) => (
                <span key={i}>
                  <a href={String(e)} target="_blank" rel="noreferrer" referrerPolicy="no-referrer">
                    圖{i + 1}
                  </a>{" "}
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
        <form action={decide}>
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
          </label>
          <p>
            <label>
              備註（必填）：
              <br />
              <textarea name="note" rows={3} cols={60} required maxLength={500} />
            </label>
          </p>
          <button type="submit">執行（冪等，可重複點）</button>
        </form>
      </section>
    </main>
  );
}
