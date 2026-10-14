/**
 * 審核詳情「案件時間軸」：把酒局事件、到場、投訴、申辯、申訴、判定、積分變化、審核操作合併成一條由早到晚的軸。
 * 純函數（無 IO），頁面只負責畫。時間一律顯示香港時間。
 */

export type TimelineTone = "neutral" | "filer" | "target" | "system" | "admin" | "good" | "bad";

export type TimelineItem = {
  /** ISO 時間 */
  at: string;
  tone: TimelineTone;
  /** 小標籤（投訴人／被投訴人／發起人／系統／審核員） */
  tag: string | null;
  title: string;
  body: string | null;
  /** 重要節點（圓點放大） */
  major: boolean;
};

export type TimelineInput = {
  complaint: Record<string, unknown>;
  filerId: string;
  targetId: string;
  party: { place: string; startAt: string | null; expiresAt: string | null; hostId: string | null } | null;
  /** party_events 行（已映射人名） */
  partyEvents: { userId: string; name: string; kindLabel: string; at: string }[];
  attendance: { userId: string; name: string; arrivedAt: string | null; hostMarked: boolean | null }[];
  effects: { nickname: string; label: string; at: string | null }[];
  /** 審核軌跡（不含 view_complaint） */
  audit: { at: string; admin: string; label: string; summary: string }[];
  evidenceCount: number;
  /** 投訴人附的私信快照（文字或圖片） */
  chat?: { sender: "filer" | "target"; text: string | null; at: string }[];
  ai: { recommended: string; rationale: string } | null;
};

const HK_FMT = new Intl.DateTimeFormat("zh-HK", {
  timeZone: "Asia/Hong_Kong",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** `MM/DD HH:mm`（香港時間）；壞值回「—」。 */
export function fmtHK(iso: string | null | undefined): string {
  if (typeof iso !== "string" || iso === "") return "—";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "—";
  return HK_FMT.format(new Date(ms)).replace(",", "");
}

function str(v: unknown): string | null {
  return typeof v === "string" && v !== "" ? v : null;
}

function roleTag(uid: string, i: Pick<TimelineInput, "filerId" | "targetId" | "party">): { tag: string | null; tone: TimelineTone } {
  if (uid === i.filerId) return { tag: "投訴人", tone: "filer" };
  if (uid === i.targetId) return { tag: "被投訴人", tone: "target" };
  if (i.party?.hostId === uid) return { tag: "發起人", tone: "neutral" };
  return { tag: null, tone: "neutral" };
}

export function buildCaseTimeline(i: TimelineInput): TimelineItem[] {
  const c = i.complaint;
  const out: { item: TimelineItem; order: number }[] = [];
  let seq = 0;
  const push = (item: TimelineItem) => {
    if (!Number.isFinite(Date.parse(item.at))) return;
    out.push({ item, order: seq++ });
  };

  if (i.party !== null) {
    const s = str(i.party.startAt);
    const e = str(i.party.expiresAt);
    if (s !== null) push({ at: s, tone: "system", tag: "酒局", title: `開局 · ${i.party.place}`, body: null, major: true });
    if (e !== null) push({ at: e, tone: "system", tag: "酒局", title: "酒局結束", body: null, major: false });
  }
  for (const ev of i.partyEvents) {
    const r = roleTag(ev.userId, i);
    push({ at: ev.at, tone: r.tone, tag: r.tag, title: `${ev.name} · ${ev.kindLabel}`, body: null, major: false });
  }
  for (const a of i.attendance) {
    const r = roleTag(a.userId, i);
    const mark = a.hostMarked === true ? "；房主標：到了" : a.hostMarked === false ? "；房主標：未到" : "";
    if (a.arrivedAt !== null) {
      push({ at: a.arrivedAt, tone: r.tone, tag: r.tag, title: `${a.name} · 打卡到場`, body: mark === "" ? null : mark.slice(1), major: false });
    }
  }

  const created = str(c.created_at);
  if (created !== null) {
    const bits: string[] = [];
    const detail = str(c.detail);
    if (detail !== null) bits.push(detail);
    if (i.evidenceCount > 0) bits.push(`附 ${i.evidenceCount} 張截圖`);
    push({ at: created, tone: "filer", tag: "投訴人", title: `提出投訴（${String(c.category ?? "")}）`, body: bits.join("\n") || null, major: true });
    if (i.ai !== null) {
      push({ at: created, tone: "system", tag: "AI", title: `AI 建議：${i.ai.recommended}（僅參考）`, body: i.ai.rationale || null, major: false });
    }
  }
  for (const m of i.chat ?? []) {
    const filer = m.sender === "filer";
    push({
      at: m.at,
      tone: filer ? "filer" : "target",
      tag: filer ? "投訴人" : "被投訴人",
      title: m.text === null ? "💬 發了一張圖片（私信）" : `💬 ${m.text.length > 40 ? `${m.text.slice(0, 40)}…` : m.text}`,
      body: m.text !== null && m.text.length > 40 ? m.text : null,
      major: false,
    });
  }
  const responded = str(c.responded_at);
  if (responded !== null) {
    push({ at: responded, tone: "target", tag: "被投訴人", title: "提交申辯", body: str(c.response_text), major: true });
  }
  const appealed = str(c.appealed_at);
  if (appealed !== null) {
    push({ at: appealed, tone: "filer", tag: "申訴方", title: "提出申訴", body: str(c.appeal_text), major: true });
  }
  for (const a of i.audit) {
    push({
      at: a.at,
      tone: "admin",
      tag: "審核員",
      title: `${a.admin} · ${a.label}`,
      body: a.summary === "" ? null : a.summary,
      major: a.label.startsWith("判定") || a.label.startsWith("申訴"),
    });
  }
  // 沒有任何判定審計（舊案／AI 自動）時，用 decided_at 補一個判定節點
  const decidedAt = str(c.decided_at);
  const hasDecideAudit = i.audit.some((a) => a.label.includes("判定") || a.label.includes("維持"));
  if (decidedAt !== null && !hasDecideAudit) {
    push({ at: decidedAt, tone: "admin", tag: "判定", title: `判定：${String(c.decision ?? "—")}`, body: null, major: true });
  }
  for (const e of i.effects) {
    if (e.at === null) continue;
    push({ at: e.at, tone: "system", tag: "誠信", title: `${e.nickname}：${e.label}`, body: null, major: false });
  }

  return out
    .sort((a, b) => Date.parse(a.item.at) - Date.parse(b.item.at) || a.order - b.order)
    .map((x) => x.item);
}

export type NextAction = {
  /** review＝審核投訴；appeal＝審核申訴；wait＝等別人；done＝已結案 */
  kind: "review" | "appeal" | "wait" | "done";
  /** 需要審核員動手（才閃爍＋顯示按鈕） */
  needsAdmin: boolean;
  urgent: boolean;
  title: string;
  detail: string;
};

/** 這案現在輪到誰、下一步是什麼。純函數：頁頂提示條與時間軸置頂待辦共用。 */
export function nextAction(c: Record<string, unknown>, appealWindowDays = 7): NextAction {
  const status = String(c.status ?? "");
  const appealPending = c.appeal_status === "pending";
  if (status === "escalated" && appealPending) {
    return {
      kind: "appeal",
      needsAdmin: true,
      urgent: false,
      title: "待你審核：申訴",
      detail: "申訴方不服原判。請對照原判、申訴說明與證據：與原判相同＝維持（不動積分）；不同＝沖銷原扣分後改判，且必須由第二位審核員（非原判人）處理。",
    };
  }
  if (status === "escalated") {
    const safety = c.category === "safety";
    return {
      kind: "review",
      needsAdmin: true,
      urgent: safety,
      title: safety ? "待你審核：人身安全投訴（優先）" : "待你審核：投訴",
      detail: "請看雙方陳述、證據與時間軸，作出「成立／駁回／惡意」判定並寫內部備註；結果與積分變化會通知雙方。",
    };
  }
  if (status === "awaiting_response") {
    const due = typeof c.response_due_at === "string" ? fmtHK(c.response_due_at) : "—";
    return { kind: "wait", needsAdmin: false, urgent: false, title: "等待被投訴人申辯", detail: `申辯截止 ${due}（香港時間），逾期自動進入分診。` };
  }
  if (status === "pending" || status === "triaged") {
    return { kind: "wait", needsAdmin: false, urgent: false, title: "系統處理中", detail: "AI 分診或規則處理中，完成後會進入待人工審核。" };
  }
  if (status === "upheld" || status === "dismissed" || status === "malicious") {
    const decided = typeof c.decided_at === "string" ? Date.parse(c.decided_at) : NaN;
    const open = Number.isFinite(decided) && Date.now() <= decided + appealWindowDays * 86400_000 && c.appeal_status !== "pending";
    return {
      kind: "done",
      needsAdmin: false,
      urgent: false,
      title: open ? "已判定 · 申訴期內" : "已結案",
      detail: open ? `不利一方可在 ${fmtHK(new Date(decided + appealWindowDays * 86400_000).toISOString())} 前申訴一次；有申訴時案件會回到這裡待你們審核。` : "判定已執行，通知已發給雙方。",
    };
  }
  return { kind: "done", needsAdmin: false, urgent: false, title: "已結案", detail: "" };
}
