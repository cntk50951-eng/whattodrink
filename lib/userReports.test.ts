import { describe, expect, it } from "vitest";

import {
  messageEvidence,
  parseReportBody,
  reportPriority,
  reportRank,
  REPORT_REASON_CODES,
  REPORT_EVIDENCE_MAX,
  REPORT_REASON_MAX,
  REPORT_SNAPSHOT_TEXT_MAX,
  splitLegacyReason,
} from "./userReports";

const ME = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

describe("parseReportBody", () => {
  it("舊客戶端形狀（只有 target_user_id＋reason）照舊可用", () => {
    const r = parseReportBody({ target_user_id: OTHER, reason: "太吵" }, ME);
    expect(r).toEqual({
      ok: true,
      value: { targetType: "user", targetUserId: OTHER, targetRef: null, reasonCode: null, reason: "太吵" },
    });
  });

  it("iOS 現行 `code: 說明` 會拆出 reason_code，reason 只留說明", () => {
    const r = parseReportBody({ target_user_id: OTHER, reason: "harassment: 一直傳訊息" }, ME);
    expect(r.ok && r.value.reasonCode).toBe("harassment");
    expect(r.ok && r.value.reason).toBe("一直傳訊息");
  });

  it("顯式 reason_code 優先，不再拆 reason", () => {
    const r = parseReportBody({ target_user_id: OTHER, reason_code: "spam", reason: "harassment: x" }, ME);
    expect(r.ok && r.value.reasonCode).toBe("spam");
    expect(r.ok && r.value.reason).toBe("harassment: x");
  });

  it("未知 reason_code／target_type 拒絕", () => {
    expect(parseReportBody({ target_user_id: OTHER, reason_code: "nope" }, ME).ok).toBe(false);
    expect(parseReportBody({ target_user_id: OTHER, target_type: "game" }, ME).ok).toBe(false);
  });

  it("舉報自己、缺目標、非物件都拒絕", () => {
    expect(parseReportBody({ target_user_id: ME }, ME).ok).toBe(false);
    expect(parseReportBody({}, ME).ok).toBe(false);
    expect(parseReportBody(null, ME).ok).toBe(false);
    expect(parseReportBody("x", ME).ok).toBe(false);
  });

  it("post／message 需要 target_id，作者由服務端反查（不收客戶端的 target_user_id）", () => {
    const m = parseReportBody({ target_type: "message", target_id: "abc", target_user_id: OTHER }, ME);
    expect(m).toEqual({
      ok: true,
      value: { targetType: "message", targetUserId: null, targetRef: "abc", reasonCode: null, reason: "" },
    });
    expect(parseReportBody({ target_type: "post" }, ME).ok).toBe(false);
  });

  it("reason 超長截到 200", () => {
    const r = parseReportBody({ target_user_id: OTHER, reason: "字".repeat(500) }, ME);
    expect(r.ok && r.value.reason.length).toBe(REPORT_REASON_MAX);
  });
});

describe("splitLegacyReason", () => {
  it("只有碼、碼＋說明、普通文字", () => {
    expect(splitLegacyReason("spam")).toEqual({ code: "spam", detail: "" });
    expect(splitLegacyReason("other: 多謝")).toEqual({ code: "other", detail: "多謝" });
    expect(splitLegacyReason("hello: x")).toEqual({ code: null, detail: "hello: x" });
  });
});

describe("隊列排序", () => {
  it("未成年最優先，待處理永遠排在已處理前", () => {
    expect(reportPriority("underage")).toBeLessThan(reportPriority("harassment"));
    expect(reportPriority("harassment")).toBeLessThan(reportPriority("spam"));
    expect(reportPriority("spam")).toBeLessThan(reportPriority(null));
    expect(reportRank({ status: "pending", reason_code: "other" })).toBeLessThan(
      reportRank({ status: "actioned", reason_code: "underage" }),
    );
  });

  it("原因碼清單與 iOS 端一致（漂移即紅）", () => {
    expect([...REPORT_REASON_CODES]).toEqual(["harassment", "inappropriate", "spam", "underage", "other"]);
  });
});

describe("messageEvidence", () => {
  it("標出誰說的；非文字只記類型不存路徑；文字截斷", () => {
    const base = { created_at: "2026-11-02T00:00:00Z" };
    expect(messageEvidence({ ...base, sender_id: OTHER, kind: "text", body: "hi" }, OTHER, ME).who).toBe("reported");
    expect(messageEvidence({ ...base, sender_id: ME, kind: "text", body: "hi" }, OTHER, ME).who).toBe("reporter");
    expect(messageEvidence({ ...base, sender_id: "x", kind: "image", body: null }, OTHER, ME).text).toBe("[image]");
    const long = messageEvidence({ ...base, sender_id: OTHER, kind: "text", body: "a".repeat(900) }, OTHER, ME);
    expect(long.text.length).toBe(REPORT_SNAPSHOT_TEXT_MAX);
  });
});

describe("舉報附聊天記錄（evidence_message_ids）", () => {
  const CONV = "33333333-3333-3333-3333-333333333333";
  const ids = (n: number) => Array.from({ length: n }, (_, i) => `m${i + 1}`);

  it("沒附證據：解析結果不帶證據欄（舊行為不變）", () => {
    const r = parseReportBody({ target_user_id: OTHER, reason_code: "spam" }, ME);
    expect(r.ok && r.value.evidenceMessageIds).toBeUndefined();
    expect(r.ok && r.value.conversationId).toBeUndefined();
  });

  it("附證據＋會話 id：帶出，去重", () => {
    const r = parseReportBody(
      { target_user_id: OTHER, reason_code: "harassment", evidence_message_ids: ["a", "b", "a"], conversation_id: CONV },
      ME,
    );
    expect(r.ok && r.value.evidenceMessageIds).toEqual(["a", "b"]);
    expect(r.ok && r.value.conversationId).toBe(CONV);
  });

  it("超過上限只留前 10 條", () => {
    const r = parseReportBody({ target_user_id: OTHER, evidence_message_ids: ids(14), conversation_id: CONV }, ME);
    expect(r.ok && r.value.evidenceMessageIds?.length).toBe(REPORT_EVIDENCE_MAX);
    expect(r.ok && r.value.evidenceMessageIds?.[9]).toBe("m10");
  });

  it("附證據卻沒有會話 id → 400（無法校驗歸屬）", () => {
    expect(parseReportBody({ target_user_id: OTHER, evidence_message_ids: ["a"] }, ME).ok).toBe(false);
  });

  it("證據不是字串陣列、含空字串或超長 id → 400", () => {
    expect(parseReportBody({ target_user_id: OTHER, evidence_message_ids: "a", conversation_id: CONV }, ME).ok).toBe(false);
    expect(parseReportBody({ target_user_id: OTHER, evidence_message_ids: [""], conversation_id: CONV }, ME).ok).toBe(false);
    expect(parseReportBody({ target_user_id: OTHER, evidence_message_ids: ["x".repeat(65)], conversation_id: CONV }, ME).ok).toBe(false);
    expect(parseReportBody({ target_user_id: OTHER, evidence_message_ids: [1], conversation_id: CONV }, ME).ok).toBe(false);
  });

  it("空陣列／null 視為沒附，不要求會話 id", () => {
    expect(parseReportBody({ target_user_id: OTHER, evidence_message_ids: [] }, ME).ok).toBe(true);
    expect(parseReportBody({ target_user_id: OTHER, evidence_message_ids: null }, ME).ok).toBe(true);
  });
});
