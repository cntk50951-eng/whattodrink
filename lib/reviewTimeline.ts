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
