import { beforeEach, describe, expect, it, vi } from "vitest";

import { decideComplaint, decisionRef, isPublicReasonKey, publicReasonText, PUBLIC_REASONS } from "./complaintDecision";

// 內存版 Supabase 假對象：只實現 decideComplaint 用到的鏈式查詢。
type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

function matchOr(row: Row, expr: string): boolean {
  return expr.split(",").some((clause) => {
    const [col, op, ...rest] = clause.split(".");
    const val = rest.join(".");
    const cur = row[col];
    if (op === "is" && val === "null") return cur === null || cur === undefined;
    if (op === "neq") return cur !== val;
    if (op === "lt") return typeof cur === "string" && cur < val;
    return false;
  });
}

function makeSvc(tables: Tables, opts: { failTrustInsert?: boolean } = {}) {
  const from = (name: string) => {
    tables[name] ??= [];
    let mode: "select" | "update" | "insert" = "select";
    let patch: Row = {};
    let inserted: Row[] = [];
    const filters: ((r: Row) => boolean)[] = [];
    let wantRows = false;
    const run = (): { data: unknown; error: { code?: string } | null } => {
      if (mode === "insert") {
        if (name === "trust_events") {
          if (opts.failTrustInsert) return { data: null, error: { code: "XX000" } };
          for (const r of inserted) {
            if (tables[name].some((x) => x.ref_id === r.ref_id)) return { data: null, error: { code: "23505" } };
          }
        }
        tables[name].push(...inserted);
        return { data: null, error: null };
      }
      const hit = tables[name].filter((r) => filters.every((f) => f(r)));
      if (mode === "update") {
        for (const r of hit) Object.assign(r, patch);
        return { data: wantRows ? hit.map((r) => ({ id: r.id })) : null, error: null };
      }
      return { data: hit, error: null };
    };
    const b: Record<string, unknown> = {
      select: () => {
        wantRows = true;
        return b;
      },
      update: (p: Row) => {
        mode = "update";
        patch = p;
        return b;
      },
      insert: (r: Row | Row[]) => {
        mode = "insert";
        inserted = Array.isArray(r) ? r : [r];
        return b;
      },
      eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), b),
      in: (c: string, v: unknown[]) => (filters.push((r) => v.includes(r[c])), b),
      is: (c: string, v: unknown) => (filters.push((r) => (v === null ? r[c] == null : r[c] === v)), b),
      gte: () => b,
      lte: () => b,
      lt: () => b,
      limit: () => b,
      order: () => b,
      or: (expr: string) => (filters.push((r) => matchOr(r, expr)), b),
      maybeSingle: async () => {
        const r = run();
        const d = r.data as Row[] | null;
        return { data: Array.isArray(d) ? (d[0] ?? null) : d, error: r.error };
      },
      then: (res: (v: unknown) => unknown) => Promise.resolve(run()).then(res),
    };
    return b;
  };
  return { from } as unknown as import("@supabase/supabase-js").SupabaseClient;
}

// writeTrustEvent 走真實 ledger 會牽出 readTrust／通知等；這裡只關心「寫了幾條、冪等」，所以替換成簡化實現。
vi.mock("./trust/ledger", () => ({
  writeTrustEvent: async (svc: { from: (t: string) => { insert: (r: unknown) => Promise<{ error: { code?: string } | null }> } }, a: Record<string, unknown>) => {
    const { error } = await svc.from("trust_events").insert({
      user_id: a.user_id, kind: a.kind, delta: a.delta, party_id: a.party_id ?? null, ref_id: a.ref_id, expires_at: "2099-01-01T00:00:00Z",
    });
    if (error?.code === "23505") return { written: false, effectiveDelta: 0, reason: "duplicate" };
    if (error) return { written: false, effectiveDelta: 0, reason: "db-error" };
    return { written: true, effectiveDelta: a.delta, reason: "ok" };
  },
}));

const NOW = Date.parse("2026-10-14T12:00:00Z");
const base = (over: Row = {}): Row => ({
  id: "c1", party_id: "p1", filer_id: "filer", target_id: "target", category: "mismatch",
  status: "escalated", appeal_status: null, decision: null, decision_rev: 0, decision_lock_at: null, ...over,
});
const opts = { publicReason: "evidence_confirmed" as const, internalNote: "內部：投訴人與對方有舊怨", by: "human:admin1" };

let t: Tables;
beforeEach(() => {
  t = { complaints: [], trust_events: [], notifications: [], safety_alerts: [], users: [{ id: "filer" }], parties: [{ id: "p1", host_user_id: "h" }] };
});

describe("decideComplaint — 狀態機（H2）", () => {
  it.each(["awaiting_response", "pending", "withdrawn", "upheld", "dismissed", "malicious"])("%s 不可判", async (status) => {
    t.complaints = [base({ status })];
    const r = await decideComplaint(makeSvc(t), "c1", "uphold", opts, NOW);
    expect(r).toEqual({ ok: false, error: "invalid_state" });
    expect(t.trust_events).toHaveLength(0);
    expect(t.notifications).toHaveLength(0);
  });
  it("不存在回 not_found", async () => {
    expect(await decideComplaint(makeSvc(t), "nope", "uphold", opts, NOW)).toEqual({ ok: false, error: "not_found" });
  });
});

describe("decideComplaint — 首次判定", () => {
  it("成立：扣被投訴人一次，終態落庫，只存枚舉理由與內部備註", async () => {
    t.complaints = [base()];
    const r = await decideComplaint(makeSvc(t), "c1", "uphold", opts, NOW);
    expect(r).toEqual({ ok: true, outcome: "decided" });
    expect(t.trust_events).toHaveLength(1);
    expect(t.trust_events[0]).toMatchObject({ user_id: "target", ref_id: "complaint:c1:uphold" });
    expect(t.complaints[0]).toMatchObject({
      status: "upheld", decision: "uphold", decided_by: "human:admin1",
      public_reason: "evidence_confirmed", internal_note: opts.internalNote, decision_lock_at: null, decision_rev: 0,
    });
  });
  it("H3：用戶通知只含枚舉理由，絕不含內部備註", async () => {
    t.complaints = [base()];
    await decideComplaint(makeSvc(t), "c1", "uphold", opts, NOW);
    const text = JSON.stringify(t.notifications);
    expect(t.notifications).toHaveLength(2);
    expect(text).toContain(PUBLIC_REASONS.evidence_confirmed);
    expect(text).not.toContain("舊怨");
  });
  it("駁回扣投訴人；惡意扣投訴人並暫停投訴", async () => {
    t.complaints = [base({ id: "c2" })];
    await decideComplaint(makeSvc(t), "c2", "dismiss", opts, NOW);
    expect(t.trust_events[0]).toMatchObject({ user_id: "filer", ref_id: "complaint:c2:dismiss" });
    t.complaints = [base({ id: "c3" })];
    await decideComplaint(makeSvc(t), "c3", "malicious", opts, NOW);
    expect(t.trust_events[1]).toMatchObject({ user_id: "filer", ref_id: "complaint:c3:malicious" });
    expect(t.users[0]).toHaveProperty("complaint_suspended_until");
  });
  it("重複點擊不重複扣分（第二次狀態已終態）", async () => {
    t.complaints = [base()];
    const svc = makeSvc(t);
    await decideComplaint(svc, "c1", "uphold", opts, NOW);
    const again = await decideComplaint(svc, "c1", "uphold", opts, NOW + 1000);
    expect(again).toEqual({ ok: false, error: "invalid_state" });
    expect(t.trust_events).toHaveLength(1);
    expect(t.notifications).toHaveLength(2);
  });
  it("寫賬失敗 → failed、釋放鎖、狀態不變，可重試", async () => {
    t.complaints = [base()];
    const r = await decideComplaint(makeSvc(t, { failTrustInsert: true }), "c1", "uphold", opts, NOW);
    expect(r).toEqual({ ok: false, error: "failed" });
    expect(t.complaints[0]).toMatchObject({ status: "escalated", decision_lock_at: null });
    const retry = await decideComplaint(makeSvc(t), "c1", "uphold", opts, NOW + 5000);
    expect(retry.ok).toBe(true);
    expect(t.trust_events).toHaveLength(1);
  });
});

describe("decideComplaint — 並發（M1）", () => {
  it("鎖被占用（2 分鐘內）→ busy，且什麼都不寫", async () => {
    t.complaints = [base({ decision_lock_at: new Date(NOW - 30_000).toISOString() })];
    const r = await decideComplaint(makeSvc(t), "c1", "dismiss", opts, NOW);
    expect(r).toEqual({ ok: false, error: "busy" });
    expect(t.trust_events).toHaveLength(0);
  });
  it("鎖已過期（>2 分鐘）可接管", async () => {
    t.complaints = [base({ decision_lock_at: new Date(NOW - 5 * 60_000).toISOString() })];
    expect((await decideComplaint(makeSvc(t), "c1", "dismiss", opts, NOW)).ok).toBe(true);
  });
});

describe("decideComplaint — 申訴改判（H1）", () => {
  const appealCase = (over: Row = {}) =>
    base({ status: "escalated", appeal_status: "pending", decision: "uphold", decision_rev: 0, decided_by: "human:admin0", ...over });

  it("維持原判：不動積分，不新增事件，申訴標 dismissed", async () => {
    t.complaints = [appealCase()];
    t.trust_events = [{ user_id: "target", kind: "complaint_upheld", delta: -6, ref_id: "complaint:c1:uphold", party_id: "p1", expires_at: "2099-01-01T00:00:00Z" }];
    const r = await decideComplaint(makeSvc(t), "c1", "uphold", opts, NOW);
    expect(r).toEqual({ ok: true, outcome: "maintained" });
    expect(t.trust_events).toHaveLength(1);
    expect(t.complaints[0]).toMatchObject({ status: "upheld", appeal_status: "dismissed", public_reason: "appeal_maintained", decision_rev: 0 });
  });
  it("改判：先沖銷原扣分（只一條沖銷），再按新判執行，版本 +1", async () => {
    t.complaints = [appealCase()];
    t.trust_events = [{ user_id: "target", kind: "complaint_upheld", delta: -6, ref_id: "complaint:c1:uphold", party_id: "p1", expires_at: "2099-01-01T00:00:00Z" }];
    const r = await decideComplaint(makeSvc(t), "c1", "dismiss", opts, NOW);
    expect(r).toEqual({ ok: true, outcome: "decided" });
    const reversed = t.trust_events.filter((e) => String(e.ref_id).endsWith(":reversed"));
    expect(reversed).toHaveLength(1);
    expect(reversed[0]).toMatchObject({ user_id: "target", delta: 6, ref_id: "complaint:c1:uphold:reversed" });
    expect(t.trust_events.find((e) => e.ref_id === "complaint:c1:dismiss:r1")).toMatchObject({ user_id: "filer" });
    // 淨效果：被投訴人 −6+6=0；投訴人只被扣駁回那一次
    const net = (u: string) => t.trust_events.filter((e) => e.user_id === u).reduce((s, e) => s + Number(e.delta), 0);
    expect(net("target")).toBe(0);
    expect(t.complaints[0]).toMatchObject({ status: "dismissed", decision: "dismiss", appeal_status: "upheld", decision_rev: 1 });
  });
  it("改判後即使重放也不再沖銷／扣分（終態＋沖銷唯一鍵雙保險）", async () => {
    t.complaints = [appealCase()];
    t.trust_events = [{ user_id: "target", kind: "complaint_upheld", delta: -6, ref_id: "complaint:c1:uphold", party_id: "p1", expires_at: "2099-01-01T00:00:00Z" }];
    const svc = makeSvc(t);
    await decideComplaint(svc, "c1", "dismiss", opts, NOW);
    const n = t.trust_events.length;
    expect(await decideComplaint(svc, "c1", "dismiss", opts, NOW + 86_400_000)).toEqual({ ok: false, error: "invalid_state" });
    expect(await decideComplaint(svc, "c1", "uphold", opts, NOW + 2 * 86_400_000)).toEqual({ ok: false, error: "invalid_state" });
    expect(t.trust_events).toHaveLength(n);
  });
  it("申訴案缺原判（數據異常）→ invalid_state，不動任何東西", async () => {
    t.complaints = [appealCase({ decision: null })];
    expect(await decideComplaint(makeSvc(t), "c1", "dismiss", opts, NOW)).toEqual({ ok: false, error: "invalid_state" });
    expect(t.trust_events).toHaveLength(0);
  });
});

describe("輔助", () => {
  it("理由枚舉：未知／自由文本回空串", () => {
    expect(isPublicReasonKey("system")).toBe(true);
    expect(isPublicReasonKey("內部備註")).toBe(false);
    expect(publicReasonText("evidence_confirmed")).toBe(PUBLIC_REASONS.evidence_confirmed);
    expect(publicReasonText("隨便一段話")).toBe("");
    expect(publicReasonText(null)).toBe("");
  });
  it("ref：rev 0 保持歷史格式，改判帶 :rN", () => {
    expect(decisionRef("c", "uphold", 0)).toBe("complaint:c:uphold");
    expect(decisionRef("c", "uphold", 2)).toBe("complaint:c:uphold:r2");
  });
});
