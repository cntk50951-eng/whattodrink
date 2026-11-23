import { describe, expect, it } from "vitest";
import { computeAnalyticsReport, parseTelemetryBatch, type StoredAnalyticsRow } from "./telemetry";

describe("telemetry 批次校驗與報表聚合", () => {
  it("parseTelemetryBatch 過濾非法事件名並剝除敏感 PII 欄位", () => {
    const id1 = "11111111-1111-4111-8111-111111111111";
    const id2 = "22222222-2222-4222-8222-222222222222";
    const res = parseTelemetryBatch({
      events: [
        {
          event_id: id1,
          event_name: "party_create_open",
          anon_id: "anon-a",
          session_id: "sess-1",
          flow_id: "flow-1",
          platform: "ios",
          app_version: "1.5.0",
          locale: "zh-Hant",
          theme: "dark",
          props: { step: "step1", email: "leak@test.com", token: "secret", duration_ms: 1234 },
        },
        {
          event_id: id2,
          event_name: "evil_unknown_event",
          anon_id: "anon-a",
          session_id: "sess-1",
          platform: "ios",
        },
      ],
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.events).toHaveLength(1);
      expect(res.events[0]?.props).toEqual({ step: "step1", duration_ms: 1234 });
    }
  });

  it("computeAnalyticsReport 正確計算 DAU、發局漏斗流失點與放棄步驟", () => {
    const now = Date.parse("2026-11-22T12:00:00Z");
    const row = (partial: Partial<StoredAnalyticsRow> & { event_name: string }): StoredAnalyticsRow => ({
      event_name: partial.event_name,
      user_id: partial.user_id ?? null,
      anon_id: partial.anon_id ?? "a1",
      session_id: partial.session_id ?? "s1",
      flow_id: partial.flow_id ?? null,
      platform: partial.platform ?? "ios",
      app_version: partial.app_version ?? "1.5.0",
      locale: partial.locale ?? "zh-Hant",
      theme: partial.theme ?? "dark",
      props: partial.props ?? {},
      created_at: partial.created_at ?? "2026-11-22T10:00:00Z",
    });

    const rows: StoredAnalyticsRow[] = [
      // 用戶 1：完成整條發局漏斗
      row({ event_name: "app_open", user_id: "u1", anon_id: "a1", flow_id: null }),
      row({ event_name: "party_create_open", user_id: "u1", flow_id: "f1" }),
      row({ event_name: "party_create_step_view", user_id: "u1", flow_id: "f1", props: { step: "step2" } }),
      row({ event_name: "party_create_submit", user_id: "u1", flow_id: "f1" }),
      row({ event_name: "party_create_success", user_id: "u1", flow_id: "f1", props: { duration_ms: 18000 } }),
      // 用戶 2（Android）：在第 2 步放棄
      row({ event_name: "party_create_open", user_id: "u2", anon_id: "a2", platform: "android", flow_id: "f2" }),
      row({ event_name: "party_create_step_view", user_id: "u2", anon_id: "a2", platform: "android", flow_id: "f2", props: { step: "step2" } }),
      row({ event_name: "party_create_abandon", user_id: "u2", anon_id: "a2", platform: "android", flow_id: "f2", props: { last_step: "step2_place" } }),
      // 用戶 3（昨日）：測試 WAU 與 7 天日活
      row({ event_name: "app_open", user_id: "u3", anon_id: "a3", created_at: "2026-11-21T08:00:00Z" }),
    ];

    const report = computeAnalyticsReport(rows, { days: 7, nowMs: now });
    expect(report.dauToday).toBe(2);
    expect(report.wau7d).toBe(3);
    expect(report.partySuccessCount).toBe(1);
    const steps = report.funnels.partyCreate.steps;
    expect(steps.map((s) => s.count)).toEqual([2, 2, 1, 1]);
    expect(steps[2]?.dropOff).toBe(1);
    expect(report.funnels.partyCreate.avgDurationSec).toBe(18);
    expect(report.funnels.partyCreate.abandonSteps[0]).toEqual({ label: "step2_place", count: 1, pct: 100 });
  });
});
