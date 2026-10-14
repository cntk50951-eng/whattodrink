import { describe, expect, it } from "vitest";

import {
  DECIDE_ERR_TEXT,
  evidenceStoragePath,
  maskSensitive,
  parseComplaintBody,
  parseComplaintText,
  parseTriageReply,
  reviewEventKindLabel,
} from "./complaints";

describe("parseComplaintBody", () => {
  const base = { target_user_id: "u2", category: "mismatch", detail: "與描述不符" };
  it("合法透过；late_* 拒；detail 越界拒", () => {
    expect(parseComplaintBody(base, "x.supabase.co")).toEqual({
      target_user_id: "u2",
      category: "mismatch",
      detail: "與描述不符",
      evidence: [],
    });
    expect(parseComplaintBody({ ...base, category: "late_cancel" }, "x")).toHaveProperty("error");
    expect(parseComplaintBody({ ...base, category: "nope" }, "x")).toHaveProperty("error");
    expect(parseComplaintBody({ ...base, detail: "" }, "x")).toHaveProperty("error");
    expect(parseComplaintBody({ ...base, detail: "x".repeat(201) }, "x")).toHaveProperty("error");
    expect(parseComplaintBody({ ...base, target_user_id: "u1" }, "x")).toEqual(
      expect.objectContaining({ target_user_id: "u1" }),
    );
  });
  it("evidence 只要本站 https（≤3）", () => {
    const ev = ["https://x.supabase.co/storage/v1/object/public/chat-images/u1/a.jpg"];
    expect(parseComplaintBody({ ...base, evidence: ev }, "x.supabase.co")).toEqual(
      expect.objectContaining({ evidence: ev }),
    );
    expect(parseComplaintBody({ ...base, evidence: ["http://evil.test/a.jpg"] }, "x.supabase.co")).toHaveProperty("error");
    expect(parseComplaintBody({ ...base, evidence: ["https://other.test/a.jpg"] }, "x.supabase.co")).toHaveProperty("error");
    expect(parseComplaintBody({ ...base, evidence: ["a", "b", "c", "d"] }, "x.supabase.co")).toHaveProperty("error");
  });
  it("evidence 只能是投訴人自己在 chat-images 的上傳（審核報告 M4）", () => {
    const own = "https://x.supabase.co/storage/v1/object/sign/chat-images/u1/2026-10/a.jpg?token=t";
    expect(parseComplaintBody({ ...base, evidence: [own] }, "x.supabase.co", "u1")).toEqual(
      expect.objectContaining({ evidence: [own] }),
    );
    // 別人的上傳／其他 bucket／頭像／帶賬號密碼的 URL 全拒
    for (const bad of [
      "https://x.supabase.co/storage/v1/object/sign/chat-images/u2/a.jpg",
      "https://x.supabase.co/storage/v1/object/public/avatars/u1/a.jpg",
      "https://x.supabase.co/storage/v1/object/public/chat-voice/u1/a.m4a",
      "https://user:pw@x.supabase.co/storage/v1/object/public/chat-images/u1/a.jpg",
      "https://x.supabase.co/storage/v1/object/public/chat-images/%2e%2e/u2/a.jpg",
      "https://x.supabase.co/storage/v1/object/public/chat-images/u1/..%2fu2/a.jpg",
    ]) {
      expect(parseComplaintBody({ ...base, evidence: [bad] }, "x.supabase.co", "u1")).toHaveProperty("error");
    }
  });
  it("evidenceStoragePath：只從合法證據 URL 取 chat-images 路徑", () => {
    expect(evidenceStoragePath("https://x.supabase.co/storage/v1/object/sign/chat-images/u1/a.jpg?token=t")).toBe("u1/a.jpg");
    expect(evidenceStoragePath("https://x.supabase.co/storage/v1/object/public/chat-images/u1/2026-10/a.jpg")).toBe("u1/2026-10/a.jpg");
    expect(evidenceStoragePath("https://x.supabase.co/storage/v1/object/public/avatars/u1/a.jpg")).toBeNull();
    // URL 解析會先折疊字面 ..；編碼斜線形式解碼後仍含 .. → 一律拒
    expect(evidenceStoragePath("https://x.supabase.co/storage/v1/object/public/chat-images/u1/..%2fu2/a.jpg")).toBeNull();
    expect(evidenceStoragePath("not a url")).toBeNull();
  });
  it("parseComplaintText 上下限", () => {
    expect(parseComplaintText({ text: "  ok " }, "text", 200)).toEqual({ text: "ok" });
    expect(parseComplaintText({ text: "" }, "text", 200)).toHaveProperty("error");
    expect(parseComplaintText({ text: "x".repeat(201) }, "text", 200)).toHaveProperty("error");
  });
});

describe("maskSensitive／parseTriageReply", () => {
  it("手机邮箱链接遮罩", () => {
    expect(maskSensitive("打 6123 4567 啦")).toBe("打 [電話] 啦");
    expect(maskSensitive("a@b.com 好")).toBe("[郵箱] 好");
    expect(maskSensitive("看 https://x.test 好")).toBe("看 [連結] 好");
  });
  it("严格校验（缺欄越界即 null）", () => {
    const good = '{"category":"no_show","severity":2,"evidence_strength":"medium","recommended":"escalate","confidence":0.7,"rationale":"證據不足"}';
    expect(parseTriageReply(good)).toEqual({
      category: "no_show",
      severity: 2,
      evidence_strength: "medium",
      recommended: "escalate",
      confidence: 0.7,
      rationale: "證據不足",
    });
    expect(parseTriageReply('{"category":"no_show"}')).toBeNull();
    expect(parseTriageReply('{"category":"no_show","severity":9,"evidence_strength":"medium","recommended":"escalate","confidence":0.7,"rationale":"x"}')).toBeNull();
    expect(parseTriageReply("唔明")).toBeNull();
  });
});

describe("後台展示（DEF-20261014-001／002）", () => {
  it("reviewEventKindLabel：已知中文＋未知回落原文", () => {
    expect(reviewEventKindLabel("join")).toBe("加入酒局");
    expect(reviewEventKindLabel("leave")).toBe("離開");
    expect(reviewEventKindLabel("leave_late")).toBe("遲到早退");
    expect(reviewEventKindLabel("leave_after_start")).toBe("開局後離開");
    expect(reviewEventKindLabel("cancel_no_joiners")).toBe("取消（無人加入）");
    expect(reviewEventKindLabel("whatever_new")).toBe("whatever_new");
  });
  it("DECIDE_ERR_TEXT：頁面用到的碼全有文案", () => {
    for (const code of [
      "session_expired", "forbidden", "csrf", "invalid_input", "note_required",
      "rate_limited", "self_case", "same_party", "second_review", "audit_failed",
      "state_changed", "busy", "failed",
    ]) {
      expect(typeof DECIDE_ERR_TEXT[code] === "string" && DECIDE_ERR_TEXT[code] !== "").toBe(true);
    }
  });
});
