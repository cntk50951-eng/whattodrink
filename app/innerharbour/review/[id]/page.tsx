import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { DECIDE_ERR_TEXT, evidenceStoragePath, reviewEventKindLabel } from "@/lib/complaints";
import { decideComplaint, isPublicReasonKey, PUBLIC_REASONS, publicReasonText, type Decision, type PublicReasonKey } from "@/lib/complaintDecision";
import { adminGate, adminRateLimited, auditOrThrow, auditViewOnce, checkSameOrigin, logAdmin } from "@/lib/ops";
import { requireAdminPage } from "@/lib/opsPage";
import { allowSelfCaseEnabled, isSelfCase, loadDecisionRecord, loadReviewContext, selfCaseBlock } from "@/lib/reviewContext";

import { buildCaseTimeline, fmtHK, nextAction } from "@/lib/reviewTimeline";
import { parseStoredChatEvidence } from "@/lib/complaintChat";
import { ROUTE_REASON_TEXT } from "@/lib/complaintAi";
import { TRUST_KIND_TEXT } from "@/lib/trust/config";
import { auditActionLabel } from "@/lib/reviewContext";

import CaseContext, { PeopleCards } from "./CaseContext";
import DecideForm from "./DecideForm";
import DecisionRecordView from "./DecisionRecordView";
import OpenDecideButton from "./OpenDecideButton";
import ReviewStyles from "./ReviewStyles";
import Timeline from "./Timeline";

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
  searchParams: Promise<{ err?: string; ok?: string; order?: string; resume?: string }>;
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
    const jar = await cookies();
    if (!gate.ok) {
      if (gate.reason === "need_mfa" || gate.reason === "need_stepup") {
        // 先把已填內容存進短時 httpOnly cookie，驗證碼通過後回來自動帶回並提交（不用重填）
        const draft = {
          id,
          decision: String(formData.get("decision") ?? ""),
          severity: String(formData.get("severity") ?? ""),
          reason: String(formData.get("reason") ?? ""),
          note: String(formData.get("note") ?? "").slice(0, 500),
        };
        jar.set("rv_draft", JSON.stringify(draft), {
          httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/innerharbour/review", maxAge: 600,
        });
        redirect(`/innerharbour/mfa?next=${encodeURIComponent(`${self}?resume=1`)}`);
      }
      back(gate.reason === "forbidden_role" ? "forbidden" : "session_expired");
      throw new Error("unreachable"); // 收窄用：back 永不返回，此行只為 TS 收窄 gate
    }
    jar.delete({ name: "rv_draft", path: "/innerharbour/review" });
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
    // 放寬：測試模式（ADMIN_ALLOW_SELF_CASE=true）或只有一位審核員時，無「第二人」可找，允許原判人覆核（審計標 self_review）。
    let sameAdminAppeal = false;
    if (f.appeal_status === "pending" && prevBy !== null && prevBy === adminId) {
      const { count: modCount } = await gsvc.from("admins").select("user_id", { count: "exact", head: true }).eq("role", "moderator");
      if (!allowSelfCaseEnabled() && (modCount ?? 0) > 1) back("second_review");
      sameAdminAppeal = true;
    }
    // 先寫審計（意圖）；失敗即中止，不執行判定。
    await auditOrThrow(gsvc, {
      admin_id: adminId,
      action: "decide_attempt",
      target: id,
      detail: { decision, severity, reason: reasonKey, note: note.slice(0, 200), self_review: selfReview || sameAdminAppeal },
    }).catch(() => back("audit_failed"));
    const r = await decideComplaint(gsvc, id, decision, {
      severity, internalNote: note, publicReason: reasonKey, by: `human:${adminId}`,
    }).catch(() => back("failed"));
    // 補記审计：判定已生效，補記失敗不推翻結果。
    await logAdmin(gsvc, {
      admin_id: adminId,
      action: r.ok ? `decide_${r.outcome}` : "decide_rejected",
      target: id,
      detail: r.ok ? { decision, self_review: selfReview || sameAdminAppeal } : { error: r.error },
    }).catch(() => undefined);
    if (!r.ok) {
      back(r.error === "busy" ? "busy" : r.error === "not_found" || r.error === "invalid_state" ? "state_changed" : "failed");
    }
    // 回到本案詳情（顯示「已處理」橫幅＋判定記錄），而不是把剛處理的案件從隊列裡悄悄消失
    redirect(`${self}?ok=1#rec`);
  }

  const ctx = await loadReviewContext(svc, c);
  // 已判定（或有判定痕跡）的案件：顯示判定記錄＋實際積分變化＋處理軌跡
  const wasDecided = typeof c.decided_at === "string" || ["upheld", "dismissed", "malicious"].includes(String(c.status));
  const rec = wasDecided ? await loadDecisionRecord(svc, c, publicReasonText) : null;
  const selfCaseMode = allowSelfCaseEnabled();
  const { err, ok, order, resume } = await searchParams;
  // 驗證碼通過後帶回的草稿（只認同一案件、一次性；Server Action 開頭會刪掉）
  let draft: { decision: string; severity: string; reason: string; note: string } | null = null;
  if (resume === "1") {
    try {
      const raw = (await cookies()).get("rv_draft")?.value;
      const d = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
      if (d !== null && d.id === id && typeof d.decision === "string" && typeof d.reason === "string" && typeof d.note === "string") {
        draft = { decision: d.decision, severity: String(d.severity ?? "1"), reason: d.reason, note: d.note };
      }
    } catch {
      draft = null;
    }
  }
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
  // 聊天記錄快照（投訴人挑選）；圖片消息現簽 5 分鐘讀取鏈接
  const chatEv = parseStoredChatEvidence(c.chat_evidence);
  const chatImageLinks = new Map<string, string | null>();
  for (const m of chatEv) {
    if (m.kind === "image" && m.image_path !== null) {
      const { data: signed } = await svc.storage.from("chat-images").createSignedUrl(m.image_path, 300);
      chatImageLinks.set(m.id, signed?.signedUrl ?? null);
    }
  }
  const aiMeta = (ai as { route?: { action?: unknown; reason?: unknown; text?: unknown }; inputs?: { chat_n?: unknown; images_n?: unknown; incomplete?: unknown } } | null) ?? null;
  const aiExtra = (sug ?? {}) as { p_uphold?: unknown; findings?: unknown; caveats?: unknown; image_notes?: unknown; injection_detected?: unknown };
  const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  const isAppeal = c.status === "escalated" && c.appeal_status === "pending";
  const canDecide = role === "moderator" && c.status === "escalated";
  const timeline = buildCaseTimeline({
    complaint: c,
    filerId: String(c.filer_id ?? ""),
    targetId: String(c.target_id ?? ""),
    party: ctx.party === null ? null : { place: ctx.party.place, startAt: ctx.party.startAt, expiresAt: ctx.party.expiresAt, hostId: ctx.party.hostId },
    partyEvents: eventRows
      .filter((e) => typeof e.user_id === "string" && typeof e.created_at === "string")
      .map((e) => ({
        userId: e.user_id as string,
        name: nameOf(e.user_id),
        kindLabel: reviewEventKindLabel(typeof e.kind === "string" ? e.kind : ""),
        at: e.created_at as string,
      })),
    attendance: attRows
      .filter((a) => typeof a.user_id === "string")
      .map((a) => ({
        userId: a.user_id as string,
        name: nameOf(a.user_id),
        arrivedAt: typeof a.arrived_at === "string" ? a.arrived_at : null,
        hostMarked: typeof a.host_marked === "boolean" ? a.host_marked : null,
      })),
    effects: (rec?.effects ?? []).map((e) => ({
      nickname: e.nickname,
      label: `${e.reversed ? "沖銷：" : ""}${TRUST_KIND_TEXT[e.kind.replace(":reversed", "")] ?? e.kind.replace(":reversed", "")} ${e.delta > 0 ? `+${e.delta}` : e.delta}`,
      at: e.createdAt,
    })),
    audit: (rec?.audit ?? [])
      .filter((a) => a.action !== "view_complaint")
      .map((a) => ({ at: a.at, admin: a.admin, label: auditActionLabel(a.action), summary: a.summary })),
    evidenceCount: evidenceLinks.length,
    chat: chatEv.map((m) => ({ sender: m.sender, text: m.kind === "text" ? m.body : null, at: m.at })),
    ai: sug !== null && typeof sug.recommended === "string"
      ? { recommended: sug.recommended, rationale: typeof sug.rationale === "string" ? sug.rationale : "" }
      : null,
  });
  const next = nextAction(c);
  const oldestFirst = order === "old";
  const shownTimeline = oldestFirst ? timeline : [...timeline].reverse();
  const statusTone = c.status === "upheld" ? "good" : c.status === "dismissed" || c.status === "malicious" ? "bad" : c.status === "escalated" ? "warn" : "";

  return (
    <main className="rv">
      <ReviewStyles />
      <div className="rv-wrap">
        <nav className="rv-nav">
          <Link href="/innerharbour/review">← 待處理隊列</Link>
          <Link href="/innerharbour/review/history">已處理記錄</Link>
        </nav>
        <header className="rv-head">
          <h1>案件審核</h1>
          <span className="rv-chip">{String(c.category)}</span>
          <span className={`rv-chip ${statusTone}`}>{String(c.status)}</span>
          {isAppeal && <span className="rv-chip admin">申訴中</span>}
          <span className="rv-sub">案件 {id.slice(0, 8)} · 提交 {typeof c.created_at === "string" ? fmtHK(c.created_at) : "—"}（香港時間）</span>
        </header>
        {errMsg !== null && <p id="err" role="alert" className="rv-banner err">{errMsg}</p>}
        {ok === "1" && (
          <p role="status" className="rv-banner ok">✅ 判定已執行並記錄。下面是判定記錄與實際積分變化；通知已發給雙方。</p>
        )}
        {selfCaseMode && (
          <p className="rv-banner warn">
            測試模式：已允許審核涉己案件（ADMIN_ALLOW_SELF_CASE=true）。此模式下的判定會在審計裡標記 self_review，正式運營請關閉。
          </p>
        )}
        <div className={`rv-todo ${next.needsAdmin ? (next.urgent ? "urgent act" : "act") : next.kind === "done" ? "done" : ""}`} role="status">
          {next.needsAdmin && <span className="rv-bell" aria-hidden />}
          <div className="rv-todo-body">
            <b>{next.title}</b>
            <p>{next.detail}</p>
          </div>
          {next.needsAdmin && canDecide && <OpenDecideButton label={next.kind === "appeal" ? "開始審核申訴" : "開始審核投訴"} />}
          {next.needsAdmin && !canDecide && <span className="rv-chip">只讀角色，不可判定</span>}
        </div>
        <PeopleCards ctx={ctx} />
        <div className="rv-grid">
          <div>
            <section className="rv-card">
              <h2>投訴陳述 <small>內部頁顯示真實身份；對外理由與備註分開</small></h2>
              <div className="rv-quote filer">
                <span className="rv-sub">投訴人說（{String(c.category)}）</span>
                {String(c.detail ?? "")}
              </div>
              <div className="rv-quote target">
                <span className="rv-sub">被投訴人申辯</span>
                {typeof c.response_text === "string" && c.response_text !== "" ? c.response_text : "（無申辯）"}
              </div>
              {isAppeal && (
                <div className="rv-quote admin">
                  <span className="rv-sub">申訴說明</span>
                  {typeof c.appeal_text === "string" ? c.appeal_text : "（無）"}
                  <span className="rv-sub" style={{ marginTop: 6 }}>
                    原判：{String(c.decision ?? "-")}；原內部備註：{typeof c.internal_note === "string" ? c.internal_note : "（無）"}
                  </span>
                </div>
              )}
              <div className="rv-evid">
                {evidenceLinks.length === 0 ? (
                  <span className="rv-sub">投訴人未上傳截圖</span>
                ) : (
                  evidenceLinks.map((href, k) =>
                    href === null ? (
                      <span key={k} className="rv-chip bad">圖{k + 1}（無法載入）</span>
                    ) : (
                      <a key={k} className="rv-chip filer" href={href} target="_blank" rel="noreferrer noopener" referrerPolicy="no-referrer">
                        查看截圖 {k + 1}
                      </a>
                    ),
                  )
                )}
              </div>
            </section>
            <section className="rv-card">
              <h2>聊天記錄證據 <small>投訴人自己挑選附上（提交時存的快照）；被投訴人看不到這份附件</small></h2>
              {chatEv.length === 0 ? (
                <p className="rv-sub">投訴人沒有附聊天記錄（可能兩人之間沒有私信，或沒有選）。「沒有記錄」本身不能當作對任何一方不利的證據。</p>
              ) : (
                <div className="rv-chat">
                  {chatEv.map((m) => (
                    <div key={m.id} className={`rv-bubble ${m.sender}`}>
                      <span className="rv-sub">{m.sender === "filer" ? "投訴人" : "被投訴人"} · {fmtHK(m.at)}</span>
                      {m.kind === "text" ? (
                        <p>{m.body}</p>
                      ) : chatImageLinks.get(m.id) ? (
                        <a href={chatImageLinks.get(m.id) ?? undefined} target="_blank" rel="noreferrer noopener" referrerPolicy="no-referrer">🖼 查看圖片</a>
                      ) : (
                        <p className="rv-sub">（圖片無法載入）</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section className="rv-card">
              <h2>
                案件時間軸 <small>{oldestFirst ? "最早在上" : "最新在上"} · 香港時間 · 藍＝投訴人／橙＝被投訴人／紫＝審核／灰＝系統</small>
                <Link className="rv-order" href={oldestFirst ? `/innerharbour/review/${id}` : `/innerharbour/review/${id}?order=old`}>
                  {oldestFirst ? "改為最新在上" : "改為最早在上"}
                </Link>
              </h2>
              <Timeline items={shownTimeline} todo={next.needsAdmin ? { title: next.title, detail: next.detail } : null} />
            </section>
            <CaseContext ctx={ctx} />
          </div>
          <aside className="rv-aside">
            {canDecide ? (
              <details id="decide" className="rv-card" open={errMsg !== null || draft !== null}>
                <summary>{isAppeal ? "判定 · 審核申訴" : "判定 · 審核投訴"}</summary>
                <DecideForm
                  action={decide}
                  isAppeal={isAppeal}
                  draft={draft}
                  reasons={MANUAL_REASONS.map((key) => ({ key, label: PUBLIC_REASONS[key] }))}
                />
              </details>
            ) : (
              <section className="rv-card">
                <h2>判定</h2>
                <p className="rv-sub">
                  {role === "viewer"
                    ? "你是只讀角色，不可判定。"
                    : "此案件目前不可判定（只有「待人工」或申訴中的案件可判）。"}
                </p>
              </section>
            )}
            {rec !== null && <DecisionRecordView rec={rec} />}
            <section className="rv-card">
              <h2>AI 分析 <small>{aiMeta?.route?.action === "uphold" || aiMeta?.route?.action === "dismiss" ? "已自動判定" : "僅供參考"}</small></h2>
              {!hasAi ? (
                <p className="rv-sub">（無 AI 分析：還沒跑、沒配置 key，或 AI 失敗）</p>
              ) : (
                <>
                  {typeof aiMeta?.route?.reason === "string" && (
                    <p className={`rv-banner ${aiMeta.route.action === "human" ? "warn" : "ok"}`} style={{ fontSize: 13 }}>
                      {ROUTE_REASON_TEXT[aiMeta.route.reason] ?? aiMeta.route.reason}
                    </p>
                  )}
                  {aiExtra.injection_detected === true && <p className="rv-banner err" style={{ fontSize: 13 }}>⚠ AI 認為材料裡有提示注入，請特別留意</p>}
                  {typeof aiExtra.p_uphold === "number" && (
                    <div style={{ marginBottom: 12 }}>
                      <div className="rv-sub">成立概率 {Math.round(aiExtra.p_uphold * 100)}%（&lt;15% 自動駁回／&gt;85% 自動成立／中間人工）</div>
                      <div className="rv-gauge"><i className="lo" /><i className="hi" /><b style={{ left: `${Math.round(aiExtra.p_uphold * 100)}%` }} /></div>
                    </div>
                  )}
                  <dl className="rv-kv" style={{ gridTemplateColumns: "72px 1fr" }}>
                    {sug !== null && (
                      <>
                        <dt>建議</dt>
                        <dd>{typeof sug.recommended === "string" ? sug.recommended : "—"}</dd>
                        <dt>嚴重度</dt>
                        <dd>{typeof sug.severity === "number" ? sug.severity : "—"}</dd>
                        <dt>信心</dt>
                        <dd>{typeof sug.confidence === "number" ? sug.confidence : "—"}</dd>
                        <dt>證據</dt>
                        <dd>{typeof sug.evidence_strength === "string" ? sug.evidence_strength : "—"}</dd>
                        <dt>總結</dt>
                        <dd>{typeof sug.rationale === "string" ? sug.rationale : "—"}</dd>
                      </>
                    )}
                    {ai?.model !== undefined && (
                      <>
                        <dt>模型</dt>
                        <dd>{String(ai.model)}</dd>
                      </>
                    )}
                    {aiMeta?.inputs !== undefined && (
                      <>
                        <dt>讀了</dt>
                        <dd>聊天 {String(aiMeta.inputs.chat_n ?? 0)} 條、圖片 {String(aiMeta.inputs.images_n ?? 0)} 張{aiMeta.inputs.incomplete === true ? "（有圖沒讀到）" : ""}</dd>
                      </>
                    )}
                  </dl>
                  {strArr(aiExtra.findings).length > 0 && (
                    <>
                      <p className="rv-sub" style={{ margin: "10px 0 2px", fontWeight: 700 }}>依據</p>
                      <ul className="rv-list">{strArr(aiExtra.findings).map((t, k) => <li key={k}>{t}</li>)}</ul>
                    </>
                  )}
                  {strArr(aiExtra.caveats).length > 0 && (
                    <>
                      <p className="rv-sub" style={{ margin: "10px 0 2px", fontWeight: 700 }}>不確定／缺什麼</p>
                      <ul className="rv-list">{strArr(aiExtra.caveats).map((t, k) => <li key={k}>{t}</li>)}</ul>
                    </>
                  )}
                  {strArr(aiExtra.image_notes).length > 0 && (
                    <>
                      <p className="rv-sub" style={{ margin: "10px 0 2px", fontWeight: 700 }}>AI 看圖</p>
                      <ul className="rv-list">{strArr(aiExtra.image_notes).map((t, k) => <li key={k}>圖{k + 1}：{t}</li>)}</ul>
                    </>
                  )}
                </>
              )}
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
