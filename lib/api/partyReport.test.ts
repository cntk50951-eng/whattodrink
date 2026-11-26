import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn(async () => ({ sent: 1 }));
vi.mock("../push/send", () => ({ sendPartyNoticePush: (...a: unknown[]) => push(...(a as [])) }));

import { cancelPartyForViolation, partyStillOpen } from "./partyReport";

type Call = { table: string; op: string; values: unknown };
/** 假 supabase：parties 讀回 row；joins 讀回成員；update 預設搶到一行 */
function fakeSvc(o: { party?: Record<string, unknown> | null; joinsError?: boolean; noClaim?: boolean; nowStatus?: string } = {}) {
  const calls: Call[] = [];
  let reads = 0;
  const svc = {
    from(table: string) {
      let op = "select";
      const result = () => {
        if (table === "parties" && op === "select") {
          reads += 1;
          if (reads > 1) return { data: { status: o.nowStatus ?? "completed" }, error: null };
          return { data: o.party === undefined ? { id: "p1", status: "open", start_at: "2026-11-27T12:00:00Z", expires_at: "2099-01-01T00:00:00Z", place: "中環酒吧" } : o.party, error: null };
        }
        if (table === "joins") return o.joinsError ? { data: null, error: { code: "XX000" } } : { data: [{ user_id: "m1" }, { user_id: "m2" }, { user_id: "m1" }], error: null };
        if (table === "parties" && op === "update") return { data: o.noClaim ? [] : [{ id: "p1" }], error: null };
        return { data: null, error: null };
      };
      const q: unknown = new Proxy({}, {
        get(_t, prop) {
          if (prop === "then") return (res: (v: unknown) => unknown) => res(result());
          if (prop === "insert" || prop === "update") {
            return (v: unknown) => { op = String(prop); calls.push({ table, op, values: v }); return q; };
          }
          return () => q;
        },
      });
      return q;
    },
  };
  return { svc: svc as never, calls };
}

beforeEach(() => push.mockClear());

describe("cancelPartyForViolation（0093）", () => {
  it("未結束的局：取消、通知去重後的成員（cancel_reason=violation、不寫發起人為動作者）、推送用違規文案", async () => {
    const { svc, calls } = fakeSvc();
    const r = await cancelPartyForViolation(svc, { partyId: "p1", reportId: "r1" });
    expect(r).toEqual({ outcome: "cancelled", notified: 2 });
    expect(calls.find((c) => c.table === "parties" && c.op === "update")?.values).toMatchObject({ status: "cancelled" });
    const rows = calls.find((c) => c.table === "notifications")?.values as Array<Record<string, unknown>>;
    expect(rows.map((x) => x.user_id)).toEqual(["m1", "m2"]);
    expect(rows[0]).toMatchObject({ kind: "party_cancelled", actor_id: null, payload: { cancel_reason: "violation", report_id: "r1", party_place: "中環酒吧" } });
    expect(push).toHaveBeenCalledWith(expect.objectContaining({ kind: "party_cancelled", reason: "violation", recipientIds: ["m1", "m2"] }));
  });
  it("已取消：冪等不動；已結束：不改狀態", async () => {
    expect((await cancelPartyForViolation(fakeSvc({ party: { id: "p1", status: "cancelled", expires_at: null, start_at: null, place: null } }).svc, { partyId: "p1", reportId: "r1" })).outcome).toBe("already_cancelled");
    const ended = fakeSvc({ party: { id: "p1", status: "open", expires_at: "2000-01-01T00:00:00Z", start_at: null, place: null } });
    expect((await cancelPartyForViolation(ended.svc, { partyId: "p1", reportId: "r1" })).outcome).toBe("ended");
    expect(ended.calls).toEqual([]);
    expect((await cancelPartyForViolation(fakeSvc({ party: null }).svc, { partyId: "p1", reportId: "r1" })).outcome).toBe("not_found");
  });
  it("讀不到成員名單：回 error，不取消（免得取消了沒人知道）", async () => {
    const { svc, calls } = fakeSvc({ joinsError: true });
    expect((await cancelPartyForViolation(svc, { partyId: "p1", reportId: "r1" })).outcome).toBe("error");
    expect(calls).toEqual([]);
  });
  it("並發：CAS 沒搶到按現況回 already_cancelled／ended，不重複通知", async () => {
    const a = fakeSvc({ noClaim: true, nowStatus: "cancelled" });
    expect((await cancelPartyForViolation(a.svc, { partyId: "p1", reportId: "r1" })).outcome).toBe("already_cancelled");
    expect(a.calls.some((c) => c.table === "notifications")).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });
  it("partyStillOpen：只有 open 且未過期", () => {
    const now = Date.parse("2026-11-26T00:00:00Z");
    expect(partyStillOpen({ status: "open", expires_at: "2026-11-27T00:00:00Z" }, now)).toBe(true);
    expect(partyStillOpen({ status: "open", expires_at: "2026-11-25T00:00:00Z" }, now)).toBe(false);
    expect(partyStillOpen({ status: "completed", expires_at: "2026-11-27T00:00:00Z" }, now)).toBe(false);
  });
});
