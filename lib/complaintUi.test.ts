import { describe, expect, it } from "vitest";

import {
  COMPLAINT_DETAIL_MAX,
  complaintCategoryBlock,
  complaintErrorKey,
  complaintStatusKey,
  complaintTargets,
  complaintTextValid,
  complaintWindow,
  parseComplaintCategory,
  parseTrustLedgerItem,
  parseTrustTier,
  trustTierWarning,
} from "./complaintUi";

describe("complaint window", () => {
  const end = Date.parse("2026-10-20T20:00:00+08:00");
  it("三態", () => {
    expect(complaintWindow(end, end - 1000)).toBe("notEnded");
    expect(complaintWindow(end, end + 1000)).toBe("open");
    expect(complaintWindow(end, end + 73 * 3600_000)).toBe("closed");
    expect(complaintWindow(NaN, end)).toBe("notEnded");
  });
  it("類別預判（safety 永可選）", () => {
    expect(complaintCategoryBlock("safety", "notEnded", false, false)).toBeNull();
    expect(complaintCategoryBlock("no_show", "notEnded", false, false)).toEqual({ key: "cplNotEnded" });
    expect(complaintCategoryBlock("mismatch", "open", false, false)).toEqual({ key: "cplMismatchHostOnly" });
    expect(complaintCategoryBlock("mismatch", "open", true, false)).toBeNull();
    expect(complaintCategoryBlock("no_show", "open", false, true)).toEqual({ key: "cplNoShowCancelled" });
    expect(complaintCategoryBlock("other", "closed", false, false)).toEqual({ key: "cplClosed" });
  });
  it("類別解析＋文字校驗", () => {
    expect(parseComplaintCategory("safety")).toBe("safety");
    expect(parseComplaintCategory("x")).toBeNull();
    expect(complaintTextValid("  hi ", COMPLAINT_DETAIL_MAX)).toBe(true);
    expect(complaintTextValid("   ", COMPLAINT_DETAIL_MAX)).toBe(false);
    expect(complaintTextValid("x".repeat(201), COMPLAINT_DETAIL_MAX)).toBe(false);
  });
  it("目標排除自己", () => {
    const ms = [
      { user_id: "a", nickname: "A", is_host: true },
      { user_id: "", nickname: "?", is_host: false },
      { user_id: "me", nickname: "Me", is_host: false },
    ];
    expect(complaintTargets(ms, "me").map((m) => m.user_id)).toEqual(["a"]);
  });
});

describe("complaint status/error", () => {
  it("雙視角狀態鍵", () => {
    expect(complaintStatusKey("awaiting_response", "against")).toBe("cplStWaitYou");
    expect(complaintStatusKey("awaiting_response", "filed")).toBe("cplStWaitPeer");
    expect(complaintStatusKey("upheld", "against")).toBe("cplStUpheldAgainst");
    expect(complaintStatusKey("bogus", "filed")).toBe("cplStPending");
  });
  it("錯誤鍵", () => {
    expect(complaintErrorKey("duplicate")).toBe("cplErrDuplicate");
    expect(complaintErrorKey("rejected")).toBeNull();
    expect(complaintErrorKey(null)).toBeNull();
  });
});

describe("trust", () => {
  it("等級解析＋警告", () => {
    expect(parseTrustTier("watch")).toBe("watch");
    expect(parseTrustTier("bogus")).toBe("newbie");
    expect(trustTierWarning("restricted")).toBe(true);
    expect(trustTierWarning("trusted")).toBe(false);
  });
  it("賬本行坏行 null", () => {
    expect(parseTrustLedgerItem(null)).toBeNull();
    const it1 = parseTrustLedgerItem({ id: "1", delta: -3, reason_text: "退出", party_place: "Bar", created_at: null });
    expect(it1?.reason).toBe("退出");
  });
});
