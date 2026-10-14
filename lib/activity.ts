/**
 * UR G.7 動態通知中心（v2-only；純函數層，可單測）。
 * 口徑對標 iOS `NoticeModels.swift`（place／actor／urgent／complaint／icon／title／detail）；
 * 網路形狀對 `GET /me/notifications`（`{unread, items, nextCursor}`）與
 * `GET /friends/requests`（`{items, pending}`）。
 * 文案走 key＋params，由調用方經 i18n 解析（語言無關，沿 meetUi 口徑）。
 */

export type NoticeActor = { user_id: string | null; nickname: string | null; avatar_url: string | null };

export type NoticePayload = {
  party_place?: string | null;
  start_at?: string | null;
  actor_nickname?: string | null;
  minutes_before_start?: number | null;
  delta?: number | null;
  reason_text?: string | null;
  new_tier?: string | null;
  closes_at?: string | null;
  room_code?: string | null;
  room_id?: string | null;
  nickname?: string | null;
  category?: string | null;
  response_due_at?: string | null;
  decision?: string | null;
  note?: string | null;
};

export type PartyNotice = {
  id: string;
  kind: string;
  party_id: string | null;
  actor: NoticeActor | null;
  payload: NoticePayload;
  created_at: string | null;
  read: boolean;
};

function str(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** 壞行回 null（調用方跳過，不炸整頁；iOS LossyNotice 口徑）。 */
export function parseNotice(raw: unknown): PartyNotice | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || r.id === "" || typeof r.kind !== "string" || r.kind === "") return null;
  const a = r.actor;
  const actor: NoticeActor | null =
    typeof a === "object" && a !== null
      ? {
          user_id: str((a as Record<string, unknown>).user_id),
          nickname: str((a as Record<string, unknown>).nickname),
          avatar_url: str((a as Record<string, unknown>).avatar_url),
        }
      : null;
  const p = (typeof r.payload === "object" && r.payload !== null ? r.payload : {}) as Record<string, unknown>;
  return {
    id: r.id,
    kind: r.kind,
    party_id: str(r.party_id),
    actor,
    payload: {
      party_place: str(p.party_place),
      start_at: str(p.start_at),
      actor_nickname: str(p.actor_nickname),
      minutes_before_start: num(p.minutes_before_start),
      delta: num(p.delta),
      reason_text: str(p.reason_text),
      new_tier: str(p.new_tier),
      closes_at: str(p.closes_at),
      room_code: str(p.room_code),
      room_id: str(p.room_id),
      nickname: str(p.nickname),
      category: str(p.category),
      response_due_at: str(p.response_due_at),
      decision: str(p.decision),
      note: str(p.note),
    },
    created_at: str(r.created_at),
    read: r.read === true,
  };
}

function clean(s: string | null | undefined): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim();
  return t !== "" ? t : null;
}

/** 酒吧名兜底（iOS place 口徑；fallback 由調用方傳，預設傳入即可）。 */
export function noticePlace(n: PartyNotice, fallback: string): string {
  return clean(n.payload.party_place) ?? fallback;
}

/** 動作者名（先 actor，再 payload，再 fallback；iOS actorName 口徑）。 */
export function noticeActorName(n: PartyNotice, fallback: string): string {
  return clean(n.actor?.nickname) ?? clean(n.payload.actor_nickname) ?? fallback;
}

export function noticeIsComplaint(n: PartyNotice): boolean {
  return n.kind.startsWith("complaint_");
}

/** 是否壞消息（紅色調；iOS isUrgent 口徑）。 */
export function noticeUrgent(n: PartyNotice): boolean {
  if (n.kind === "complaint_filed" || n.kind === "complaint_response_needed") return true;
  if (n.kind === "party_cancelled" || n.kind === "member_left_late") return true;
  if (n.kind === "trust_changed") return (n.payload.delta ?? 0) < 0;
  return false;
}

export type NoticeIcon =
  | "cancel"
  | "leaveLate"
  | "leave"
  | "trustUp"
  | "trustDown"
  | "alarm"
  | "game"
  | "complaint"
  | "complaintResult"
  | "check"
  | "bell";

/** 行首圖標（iOS icon 口徑；調用方映到 lucide）。 */
export function noticeIcon(n: PartyNotice): NoticeIcon {
  switch (n.kind) {
    case "party_cancelled":
      return "cancel";
    case "member_left_late":
      return "leaveLate";
    case "member_left":
    case "game_kicked":
      return "leave";
    case "trust_changed":
      return (n.payload.delta ?? 0) >= 0 ? "trustUp" : "trustDown";
    case "reminder_1h":
      return "alarm";
    case "game_join_request":
    case "game_join_result":
      return "game";
    case "complaint_filed":
    case "complaint_response_needed":
      return "complaint";
    case "complaint_result":
    case "complaint_ack":
      return "complaintResult";
    case "attendance_confirm":
      return "check";
    default:
      return "bell";
  }
}

export type TextKey = { key: string; params?: Record<string, string | number> };

/**
 * 標題（iOS noticeTitle 口徑；place／actor 由調用方傳本地化 fallback）。
 * trust 用正負兩 key（免客戶端拼 Unicode 減號）。
 */
export function noticeTitle(n: PartyNotice, place: string, actor: string): TextKey {
  switch (n.kind) {
    case "party_cancelled":
      return { key: "noticeTitleCancelled", params: { place } };
    case "member_left":
      return { key: "noticeTitleLeft", params: { actor, place } };
    case "member_left_late": {
      const m = n.payload.minutes_before_start;
      if (m !== null && m !== undefined && m >= 0) {
        return { key: "noticeTitleLeftLate", params: { actor, minutes: Math.floor(m), place } };
      }
      return { key: "noticeTitleLeftLateSoon", params: { actor, place } };
    }
    case "reminder_1h":
      return { key: "noticeTitleReminder", params: { place } };
    case "game_join_request":
      return { key: "noticeTitleGameRequest", params: { name: clean(n.payload.nickname) ?? actor } };
    case "game_join_result":
      return n.payload.decision === "approved" || n.payload.decision === "approve"
        ? { key: "noticeTitleGameOk" }
        : { key: "noticeTitleGameNo" };
    case "game_kicked":
      return { key: "noticeTitleKicked" };
    case "complaint_filed":
      return { key: "noticeTitleComplaintFiled", params: { place } };
    case "complaint_response_needed":
      return { key: "noticeTitleComplaintNeeded" };
    case "complaint_ack":
      return { key: "noticeTitleComplaintAck" };
    case "complaint_result":
      if (n.payload.decision === "upheld") return { key: "noticeTitleComplaintUpheld" };
      if (n.payload.decision === "dismissed") return { key: "noticeTitleComplaintDismissed" };
      if (n.payload.decision === "malicious") return { key: "noticeTitleComplaintMalicious" };
      return { key: "noticeTitleComplaintDone" };
    case "attendance_confirm":
      return { key: "noticeTitleAttendance", params: { place } };
    case "trust_changed": {
      const d = n.payload.delta ?? 0;
      const v = Math.abs(d);
      const shown = Number.isInteger(v) ? Math.trunc(v) : Math.round(v * 10) / 10;
      return d >= 0 ? { key: "noticeTitleTrustUp", params: { num: shown } } : { key: "noticeTitleTrustDown", params: { num: shown } };
    }
    default:
      return { key: "noticeTitleDefault" };
  }
}

export type NoticeDetail =
  | { kind: "none" }
  | { kind: "startsAt"; startAt: string }
  | { kind: "dueAt"; dueAt: string }
  | { kind: "confirmBy"; closesAt: string }
  | { kind: "trust"; reason: string | null; tier: string | null }
  | { kind: "note"; note: string }
  | { kind: "gameRequest" };

/** 副行（iOS noticeDetail 口徑；時間格式化調用方做）。 */
export function noticeDetail(n: PartyNotice): NoticeDetail {
  if (n.kind === "trust_changed") {
    return { kind: "trust", reason: clean(n.payload.reason_text), tier: clean(n.payload.new_tier) };
  }
  if (n.kind === "game_join_request") return { kind: "gameRequest" };
  if ((n.kind === "complaint_filed" || n.kind === "complaint_response_needed") && clean(n.payload.response_due_at) !== null) {
    return { kind: "dueAt", dueAt: (n.payload.response_due_at as string).trim() };
  }
  if (n.kind === "complaint_result") {
    const note = clean(n.payload.note);
    return note !== null ? { kind: "note", note } : { kind: "none" };
  }
  if (n.kind === "attendance_confirm" && clean(n.payload.closes_at) !== null) {
    return { kind: "confirmBy", closesAt: (n.payload.closes_at as string).trim() };
  }
  const start = clean(n.payload.start_at);
  if (
    start !== null &&
    (n.kind === "reminder_1h" || n.kind === "party_cancelled" || n.kind === "member_left" || n.kind === "member_left_late")
  ) {
    return { kind: "startsAt", startAt: start };
  }
  return { kind: "none" };
}

// MARK: - 好友請求

export type FriendRequestPeer = { user_id: string; nickname: string; avatar_url: string | null; gender: string | null };

export type FriendRequest = {
  id: string;
  peer: FriendRequestPeer;
  origin: string | null;
  message: string | null;
  created_at: string | null;
};

export function parseFriendRequest(raw: unknown): FriendRequest | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || r.id === "") return null;
  const u = r.user;
  const peer: FriendRequestPeer =
    typeof u === "object" && u !== null
      ? {
          user_id: typeof (u as Record<string, unknown>).user_id === "string" ? ((u as Record<string, unknown>).user_id as string) : "",
          nickname: clean(str((u as Record<string, unknown>).nickname)) ?? "酒友",
          avatar_url: str((u as Record<string, unknown>).avatar_url),
          gender: str((u as Record<string, unknown>).gender),
        }
      : { user_id: "", nickname: "酒友", avatar_url: null, gender: null };
  if (peer.user_id === "") return null;
  return {
    id: r.id,
    peer,
    origin: str(r.origin),
    message: clean(str(r.message)),
    created_at: str(r.created_at),
  };
}

// MARK: - 統一紅點（iOS bell 口徑：碰杯＋邀約＋好友請求＋酒局通知；不含聊天，聊天掛好友 pill）

export function activityBell(cheers: number, invites: number, requests: number, notices: number): number {
  const c = (v: number): number => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
  return c(cheers) + c(invites) + c(requests) + c(notices);
}
