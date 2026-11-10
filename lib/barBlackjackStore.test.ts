import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyPlayer, fullDeck, newRound, toView, type BjState, type Card, type Rank, type Suit } from "./barBlackjack";
import { abandon, act, getActive, startRound } from "./barBlackjackStore";
import { BAR_GAMES } from "./barGames";

// ───── 記憶體假 Supabase：只實作 store 用到的鏈 ─────
type Row = Record<string, unknown> & { id: string };
type Filter = (r: Row) => boolean;
const CREDITS = { daily: { limit: 0, used: 0, remaining: 0 }, lots: [], earned_total: 0, total: 40, wins_today: 0, next_reset_at: "2026-11-10T00:00:00Z" };

function makeSvc() {
  const tables: Record<string, Row[]> = { bar_blackjack_matches: [], bar_dice_matches: [] };
  const rpcCalls: { name: string; args: Record<string, unknown> }[] = [];
  let seq = 0;
  const get = (r: Row, col: string): unknown => (col === "state->>rev" ? String((r.state as { rev: number }).rev) : r[col]);
  class Q {
    private filters: Filter[] = [];
    private patch: Record<string, unknown> | null = null;
    private ins: Row | null = null;
    private lim = Infinity;
    private head = false;
    constructor(private table: string) {}
    select(_c?: string, opts?: { count?: string; head?: boolean }) { this.head = opts?.head === true; return this; }
    update(p: Record<string, unknown>) { this.patch = p; return this; }
    insert(o: Record<string, unknown>) { this.ins = { id: `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), settled_at: null, credits: null, ...o } as Row; return this; }
    eq(c: string, v: unknown) { this.filters.push((r) => get(r, c) === v); return this; }
    neq(c: string, v: unknown) { this.filters.push((r) => get(r, c) !== v); return this; }
    is(c: string, v: unknown) { this.filters.push((r) => get(r, c) === v); return this; }
    gte(c: string, v: unknown) { this.filters.push((r) => String(get(r, c)) >= String(v)); return this; }
    limit(n: number) { this.lim = n; return this; }
    private run(): Row[] {
      const rows = tables[this.table] as Row[];
      if (this.ins !== null) { if (this.table === "bar_blackjack_matches" && rows.some((r) => r.user_id === this.ins!.user_id && r.status === "active")) return []; rows.push(this.ins); return [this.ins]; }
      const hit = rows.filter((r) => this.filters.every((f) => f(r))).slice(0, this.lim);
      if (this.patch !== null) hit.forEach((r) => Object.assign(r, this.patch));
      return hit;
    }
    maybeSingle() { return Promise.resolve({ data: this.run()[0] ?? null, error: null }); }
    single() { const r = this.run()[0]; return Promise.resolve(r === undefined ? { data: null, error: { message: "no row" } } : { data: r, error: null }); }
    then(res: (v: unknown) => unknown) { const rows = this.run(); return Promise.resolve(this.head ? { count: rows.length, error: null } : { data: rows, error: null }).then(res); }
  }
  const svc = {
    from: (t: string) => new Q(t),
    rpc: (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      if (name === "bar_credit_grant_win") return Promise.resolve({ data: { granted: 3, reason: "ok", credits: CREDITS }, error: null });
      if (name === "bar_credit_game_loss") return Promise.resolve({ data: { ok: true, spent: 1, credits: CREDITS }, error: null });
      if (name === "bar_credit_state") return Promise.resolve({ data: CREDITS, error: null });
      return Promise.resolve({ data: null, error: null });
    },
  };
  return { svc: svc as never, tables, rpcCalls };
}

const c = (r: Rank, s: Suit = "S"): Card => ({ r, s });
const stacked = (top: Card[]): Card[] => [...top, ...fullDeck().filter((x) => !top.some((t) => t.r === x.r && t.s === x.s))];
const U = "u1";
const MATCH = "11111111-1111-4111-8111-111111111111";
function seed(t: ReturnType<typeof makeSvc>, state: BjState, over: Record<string, unknown> = {}) {
  t.tables.bar_blackjack_matches!.push({ id: MATCH, user_id: U, status: "active", state, credits: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), settled_at: null, ...over });
}
const rng = { int: (a: number) => a, float: () => 0 };

describe("21點 store", () => {
  let t: ReturnType<typeof makeSvc>;
  beforeEach(() => { t = makeSvc(); delete process.env.minimaxi_api_key; delete process.env.MINIMAXI_API_KEY; vi.spyOn(console, "error").mockImplementation(() => {}); });

  it("開局：建一局、視圖不含牌堆與暗牌；已有進行中就接回", async () => {
    const r = await startRound(t.svc, U);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(JSON.stringify(r.view)).not.toContain("deck");
    if (r.view.phase === "player") expect(r.view.ivy[1]).toBeNull();
    const again = await startRound(t.svc, U);
    expect(again.ok && again.view.id).toBe(r.view.id);
    expect(t.tables.bar_blackjack_matches!.length).toBe(1);
  });

  it("每日合計 25 局：大話骰＋21點加起來滿了就擋", async () => {
    for (let i = 0; i < 20; i++) t.tables.bar_dice_matches!.push({ id: `d${i}`, user_id: U, created_at: new Date().toISOString() });
    for (let i = 0; i < 5; i++) t.tables.bar_blackjack_matches!.push({ id: `b${i}`, user_id: U, status: "won", state: newRound(rng, 1), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), settled_at: "x" });
    const r = await startRound(t.svc, U);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.code).toBe("rate_limited");
    expect(BAR_GAMES.startsPerDay).toBe(25);
  });

  it("輸：我爆牌 → 結算走 bar_credit_game_loss(blackjack_loss)，Ivy 不補牌", async () => {
    seed(t, newRound(rng, 1000, stacked([c("10"), c("6"), c("6"), c("K"), c("K", "H")])));
    const r = await act(t.svc, U, MATCH, { type: "hit" });
    expect(r.ok && r.view.status).toBe("lost");
    expect(r.ok && r.view.ivy_count).toBe(2);
    const call = t.rpcCalls.find((x) => x.name === "bar_credit_game_loss");
    expect(call?.args).toMatchObject({ p_kind: "blackjack_loss", p_ref: MATCH, p_wins_cap: 5 });
    expect(r.ok && r.settlement?.delta).toBe(-1);
  });

  it("贏：逐步 ivy_step（沒有 AI key → 機率兜底）打完 → bar_credit_grant_win(blackjack_win)", async () => {
    // 我 20（K+Q），Ivy 6＋10＝16；牌堆下一張 K → Ivy 若要牌會爆；若停牌則 16<20 我贏
    seed(t, newRound(rng, 1000, stacked([c("K"), c("6"), c("Q"), c("10"), c("K", "H")])));
    const s1 = await act(t.svc, U, MATCH, { type: "stand" });
    expect(s1.ok && s1.view.phase).toBe("ivy");
    expect(s1.ok && s1.view.ivy[1]).not.toBeNull(); // 暗牌這時才翻開
    let last = s1;
    for (let i = 0; i < 6 && last.ok && last.view.phase === "ivy"; i++) last = await act(t.svc, U, MATCH, { type: "ivy_step" });
    expect(last.ok && last.view.phase).toBe("done");
    expect(last.ok && last.view.status).toBe("won");
    const call = t.rpcCalls.find((x) => x.name === "bar_credit_grant_win");
    expect(call?.args).toMatchObject({ p_kind: "blackjack_win", p_match: MATCH, p_n: 3 });
    expect(last.ok && last.settlement?.delta).toBe(3);
  });

  it("平手不入帳也不扣", async () => {
    seed(t, newRound(rng, 1000, stacked([c("10"), c("10", "H"), c("9"), c("9", "H")])));
    await act(t.svc, U, MATCH, { type: "stand" });
    const r = await act(t.svc, U, MATCH, { type: "ivy_step" }); // Ivy 19 → 停
    expect(r.ok && r.view.status).toBe("push");
    expect(t.rpcCalls.some((x) => x.name === "bar_credit_grant_win" || x.name === "bar_credit_game_loss")).toBe(false);
    expect(r.ok && r.settlement).toMatchObject({ result: "push", delta: 0 });
  });

  it("斷線規則：Ivy 回合卡住 → 由 sweep 兜底打完，按真實結果結算（不是放棄）", async () => {
    const st = applyPlayer(newRound(rng, 1000, stacked([c("K"), c("6"), c("Q"), c("10"), c("2")])), "stand", 2000);
    if (!st.ok) throw new Error("setup");
    seed(t, st.state, { updated_at: new Date(Date.now() - 120_000).toISOString() });
    const v = await getActive(t.svc, U);
    expect(v).toBeNull(); // 這局已被打完
    const row = t.tables.bar_blackjack_matches![0]!;
    expect(["won", "lost", "push"]).toContain(row.status as string);
    expect(row.status).not.toBe("abandoned");
    expect(t.rpcCalls.some((x) => x.name === "bar_credit_grant_win" || x.name === "bar_credit_game_loss" || x.name === "bar_credit_state")).toBe(true);
  });

  it("我的回合超過 30 分鐘沒動作 → 放棄（輸，走 blackjack_loss）", async () => {
    seed(t, newRound(rng, 1000, stacked([c("10"), c("9"), c("8"), c("7"), c("2")])), { updated_at: new Date(Date.now() - 31 * 60_000).toISOString() });
    await getActive(t.svc, U);
    expect(t.tables.bar_blackjack_matches![0]!.status).toBe("abandoned");
    expect(t.rpcCalls.find((x) => x.name === "bar_credit_game_loss")?.args).toMatchObject({ p_kind: "blackjack_loss" });
  });

  it("主動離場算輸；結束後再操作 → wrong_phase；錯的回合 → wrong_phase", async () => {
    seed(t, newRound(rng, 1000, stacked([c("10"), c("9"), c("8"), c("7"), c("2")])));
    const wrong = await act(t.svc, U, MATCH, { type: "ivy_step" });
    expect(!wrong.ok && wrong.code).toBe("wrong_phase");
    const r = await abandon(t.svc, U, MATCH);
    expect(r.ok && r.view.status).toBe("abandoned");
    const after = await act(t.svc, U, MATCH, { type: "hit" });
    expect(!after.ok && after.code).toBe("wrong_phase");
  });

  it("加倍只限頭兩張", async () => {
    seed(t, newRound(rng, 1000, stacked([c("2"), c("9"), c("3"), c("8"), c("2", "H"), c("2", "D")])));
    const h = await act(t.svc, U, MATCH, { type: "hit" });
    expect(h.ok && h.view.me.length).toBe(3);
    const d = await act(t.svc, U, MATCH, { type: "double" });
    expect(!d.ok && d.code).toBe("invalid_action");
  });

  it("toView 在我的回合不洩露暗牌（再次檢查 store 回包）", async () => {
    const s = newRound(rng, 1000, stacked([c("10"), c("3"), c("9"), c("8"), c("2")]));
    seed(t, s);
    const v = await getActive(t.svc, U);
    expect(v?.ivy[1]).toBeNull();
    expect(JSON.stringify(v)).not.toContain('"r":"8"');
    expect(toView("x", "active", s).ivy_total).toBeNull();
  });
});
