import { describe, expect, it } from "vitest";
import { AI_THRESHOLDS, aiAutoEnabled, chatInWindow, chatTimeWindow, buildTriageContent, maskForAi, parseTriageV2, relMin, routeTriage, triageSystemPrompt, type AiSuggestionV2, type RouteCtx } from "./complaintAi";

const sug = (o: Partial<AiSuggestionV2> = {}): AiSuggestionV2 => ({
  category: "mismatch", severity: 1, p_uphold: 0.9, confidence: 0.9, evidence_strength: "strong", recommended: "uphold",
  findings: [], caveats: [], image_notes: [], injection_detected: false, rationale: "ok", ...o,
});
const ctx = (o: Partial<RouteCtx> = {}): RouteCtx => ({ category: "mismatch", flags: [], leaning: null, inputsIncomplete: false, autoEnabled: true, ...o });

describe("routeTriage", () => {
  it("auto uphold when p high and confident", () => expect(routeTriage(sug(), ctx())).toEqual({ action: "uphold", reason: "p_high" }));
  it("auto dismiss when p low and confident", () => {
    expect(routeTriage(sug({ p_uphold: 0.1, recommended: "dismiss" }), ctx())).toEqual({ action: "dismiss", reason: "p_low" });
  });
  it("gray zone goes human", () => {
    expect(routeTriage(sug({ p_uphold: 0.6, recommended: "uphold" }), ctx())).toMatchObject({ action: "human", reason: "between_thresholds" });
  });
  it("threshold edges are inclusive", () => {
    expect(routeTriage(sug({ p_uphold: AI_THRESHOLDS.uphold_min_p }), ctx()).action).toBe("uphold");
    expect(routeTriage(sug({ p_uphold: AI_THRESHOLDS.dismiss_max_p, recommended: "dismiss" }), ctx()).action).toBe("dismiss");
    expect(routeTriage(sug({ p_uphold: 0.8499 }), ctx()).action).toBe("human");
  });
  it("low confidence / escalate / weak evidence → human", () => {
    expect(routeTriage(sug({ confidence: 0.79 }), ctx())).toMatchObject({ reason: "low_confidence" });
    expect(routeTriage(sug({ recommended: "escalate" }), ctx())).toMatchObject({ reason: "ai_escalate" });
    expect(routeTriage(sug({ evidence_strength: "weak" }), ctx())).toMatchObject({ reason: "weak_evidence" });
  });
  it("never auto for safety, appeal, retaliation, injection, incomplete inputs, AI failure, kill switch", () => {
    expect(routeTriage(sug(), ctx({ category: "safety" })).reason).toBe("safety");
    expect(routeTriage(sug({ category: "safety" }), ctx()).reason).toBe("safety");
    expect(routeTriage(sug(), ctx({ flags: ["appeal"] })).reason).toBe("appeal");
    expect(routeTriage(sug(), ctx({ flags: ["retaliation"] })).reason).toBe("retaliation");
    expect(routeTriage(sug({ injection_detected: true }), ctx()).reason).toBe("injection");
    expect(routeTriage(sug(), ctx({ inputsIncomplete: true })).reason).toBe("inputs_incomplete");
    expect(routeTriage(null, ctx()).reason).toBe("ai_failed");
    expect(routeTriage(sug(), ctx({ autoEnabled: false })).reason).toBe("auto_off");
  });
  it("harassment auto only for severity 1", () => {
    expect(routeTriage(sug({ category: "harassment", severity: 2 }), ctx({ category: "harassment" })).reason).toBe("severity");
    expect(routeTriage(sug({ category: "harassment", severity: 1 }), ctx({ category: "harassment" })).action).toBe("uphold");
  });
  it("no_show needs objective records that agree", () => {
    const s = sug({ category: "no_show" });
    expect(routeTriage(s, ctx({ category: "no_show", leaning: null })).reason).toBe("rule_missing");
    expect(routeTriage(s, ctx({ category: "no_show", leaning: "dismiss" })).reason).toBe("rule_conflict");
    expect(routeTriage(s, ctx({ category: "no_show", leaning: "uphold" })).action).toBe("uphold");
  });
  it("category mismatch / inconsistency → human", () => {
    expect(routeTriage(sug({ category: "harassment" }), ctx()).reason).toBe("category_mismatch");
    expect(routeTriage(sug({ p_uphold: 0.3, recommended: "uphold" }), ctx()).reason).toBe("inconsistent");
  });
});

describe("parseTriageV2", () => {
  const good = JSON.stringify({ category: "other", severity: 1, p_uphold: 0.5, confidence: 0.7, evidence_strength: "medium", recommended: "escalate", findings: ["a"], caveats: [], image_notes: [], injection_detected: false, rationale: "不確定" });
  it("parses valid, tolerant of wrapping text", () => expect(parseTriageV2(`好的\n${good}\n`)).toMatchObject({ p_uphold: 0.5, recommended: "escalate" }));
  it("rejects bad ranges and shapes", () => {
    expect(parseTriageV2(good.replace('"p_uphold":0.5', '"p_uphold":1.5'))).toBeNull();
    expect(parseTriageV2(good.replace('"severity":1', '"severity":5'))).toBeNull();
    expect(parseTriageV2("no json")).toBeNull();
    expect(parseTriageV2(good.replace('"findings":["a"]', '"findings":"x"'))).toBeNull();
  });
});

describe("helpers", () => {
  it("relMin / mask / env switch / content parts", () => {
    expect(relMin("2026-10-14T10:30:00Z", Date.parse("2026-10-14T11:00:00Z"))).toBe(-30);
    expect(relMin("bad", 0)).toBeNull();
    expect(maskForAi("打 98765432 或 a@b.com http://x.y")).toBe("打 [電話] 或 [郵箱] [連結]");
    expect(aiAutoEnabled("off")).toBe(false);
    expect(aiAutoEnabled(undefined)).toBe(true);
    const parts = buildTriageContent({} as never, ["data:image/png;base64,AA"]);
    expect(parts).toHaveLength(2);
    expect(triageSystemPrompt()).toContain("p_uphold");
  });
});

describe("chat time window", () => {
  const p = { createdAt: "2026-10-10T00:00:00Z", startAt: "2026-10-14T12:00:00Z", expiresAt: "2026-10-14T15:00:00Z" };
  it("accepts messages between party creation and end+72h", () => {
    expect(chatInWindow("2026-10-12T09:00:00Z", p)).toBe(true);
    expect(chatInWindow("2026-10-14T12:30:00Z", p)).toBe(true);
    expect(chatInWindow("2026-10-17T15:00:00Z", p)).toBe(true); // 邊界含
  });
  it("rejects stale (before the party existed) and too-late messages", () => {
    expect(chatInWindow("2026-09-27T13:32:00Z", p)).toBe(false);
    expect(chatInWindow("2026-10-17T15:00:01Z", p)).toBe(false);
  });
  it("bad timestamps are invalid; missing created_at falls back to start-7d", () => {
    expect(chatInWindow("garbage", p)).toBe(false);
    const q = { startAt: "2026-10-14T12:00:00Z" };
    expect(chatInWindow("2026-10-06T00:00:00Z", q)).toBe(false);
    expect(chatInWindow("2026-10-08T00:00:00Z", q)).toBe(true);
    expect(chatTimeWindow({})).toBeNull();
  });
});
