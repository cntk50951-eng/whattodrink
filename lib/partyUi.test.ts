import { describe, expect, it } from "vitest";

import {
  arriveErrorKey,
  arriveWindowOpen,
  attendanceOutcomeKey,
  cancelBlockText,
  cancelConfirmTitle,
  leaveConfirmMessage,
  parseCancelPolicy,
  parseHostTrust,
  parseLeavePolicy,
} from "./partyUi";

describe("policies", () => {
  it("壞形回 null", () => {
    expect(parseCancelPolicy(null)).toBeNull();
    expect(parseLeavePolicy({})).toBeNull();
    expect(parseHostTrust(null)).toBeNull();
  });
  it("撤銷置灰三因＋not_host 不顯示", () => {
    expect(cancelBlockText("too_close_to_start")).toEqual({ key: "partyCancelClose" });
    expect(cancelBlockText("started")).toEqual({ key: "partyCancelStarted" });
    expect(cancelBlockText("already_cancelled")).toEqual({ key: "partyCancelDone" });
    expect(cancelBlockText("not_host")).toBeNull();
    expect(cancelBlockText(null)).toBeNull();
  });
  it("撤銷確認寫明人數", () => {
    expect(cancelConfirmTitle(3)).toEqual({ key: "partyCancelNotify", params: { n: 3 } });
    expect(cancelConfirmTitle(0).key).toBe("partyCancelNoOne");
  });
  it("退出確認三態", () => {
    expect(leaveConfirmMessage(null)).toEqual({ key: "partyLeaveNormal" });
    expect(leaveConfirmMessage({ can_leave: true, minutes_to_start: 30, late: true })).toEqual({
      key: "partyLeaveLate",
      params: { minutes: 30 },
    });
    expect(leaveConfirmMessage({ can_leave: true, minutes_to_start: -5, late: true }).key).toBe("partyLeaveAfterStart");
  });
  it("host trust 缺席可空", () => {
    expect(parseHostTrust({ tier: "trusted", hosted_count: 5, completion_rate: 0.8, cancel_90d: 0 })).toEqual({
      tier: "trusted",
      hosted_count: 5,
      completion_rate: 0.8,
      cancel_90d: 0,
    });
  });
});

describe("attendance", () => {
  it("打卡窗口前後 30 分鐘", () => {
    const start = Date.parse("2026-10-20T20:00:00+08:00");
    expect(arriveWindowOpen(start, start - 30 * 60_000)).toBe(true);
    expect(arriveWindowOpen(start, start - 31 * 60_000)).toBe(false);
    expect(arriveWindowOpen(start, start + 30 * 60_000)).toBe(true);
    expect(arriveWindowOpen(start, start + 31 * 60_000)).toBe(false);
    expect(arriveWindowOpen(NaN, start)).toBe(false);
  });
  it("結算四態＋未知 null", () => {
    expect(attendanceOutcomeKey("attended")).toBe("partyOutcomeAttended");
    expect(attendanceOutcomeKey("no_show")).toBe("partyOutcomeNoShow");
    expect(attendanceOutcomeKey("left")).toBe("partyOutcomeLeft");
    expect(attendanceOutcomeKey("cancelled")).toBe("partyOutcomeCancelled");
    expect(attendanceOutcomeKey(null)).toBeNull();
    expect(attendanceOutcomeKey("weird")).toBeNull();
  });
  it("打卡失敗鍵", () => {
    expect(arriveErrorKey("arrive_window_closed")).toBe("partyArriveClosed");
    expect(arriveErrorKey("not_in_party")).toBe("partyArriveNotIn");
    expect(arriveErrorKey("too_far")).toBeNull();
    expect(arriveErrorKey(null)).toBeNull();
  });
});
