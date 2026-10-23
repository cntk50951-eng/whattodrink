import { describe, expect, it } from "vitest";

import {
  accuseShipo,
  advanceShipo,
  canSendTextShipo,
  createShipoState,
  endTalkShipo,
  leaveShipo,
  nextShipo,
  parseShipoRules,
  pickShipo,
  shipoRoundsFor,
  viewShipoFor,
  SHIPO_SECONDS,
  type ShipoState,
} from "./shipo";
import { shipoCardByCode } from "./shipoCards";
import { parseActionBody, parseCreateBody } from "./rooms";

const seq = (...v: number[]) => {
  let i = 0;
  return () => v[i++ % v.length];
};
const members = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `u${i + 1}`, seat: i + 1 }));
const rules = parseShipoRules({});
const T0 = 1_000_000;

function start(n = 4, rng = seq(0, 0, 0)): ShipoState {
  const s = createShipoState(members(n), "u1", rules, T0, rng);
  if ("error" in s) throw new Error(s.error);
  return s;
}
/** 推到 talk（honest 取決於 rng） */
function toTalk(s: ShipoState): ShipoState {
  return advanceShipo(s, s.deadline_ms! + 1).state;
}
const idOf = (s: ShipoState, role: string) => Object.keys(s.roles).find((id) => s.roles[id] === role)!;
const bluffers = (s: ShipoState) => Object.keys(s.roles).filter((id) => s.roles[id] === "bluffer");

describe("開局", () => {
  it("人數 4–6 才行；3 人／7 人拒絕", () => {
    expect("error" in createShipoState(members(3), "u1", rules, T0)).toBe(true);
    expect("error" in createShipoState(members(7), "u1", rules, T0)).toBe(true);
  });
  it("想想＝房主；1 老實人＋其餘瞎掰人；每人 3 分；peek 9 秒", () => {
    const s = start(5);
    expect(s.judge_id).toBe("u1");
    expect(Object.values(s.roles).filter((r) => r === "judge")).toHaveLength(1);
    expect(Object.values(s.roles).filter((r) => r === "honest")).toHaveLength(1);
    expect(Object.values(s.roles).filter((r) => r === "bluffer")).toHaveLength(3);
    expect(Object.values(s.scores).every((v) => v === 3)).toBe(true);
    expect(s.phase).toBe("peek");
    expect(s.deadline_ms).toBe(T0 + SHIPO_SECONDS.peek * 1000);
  });
  it("輪數：3–4 人 3 輪，5–6 人 2 輪", () => {
    expect([3, 4, 5, 6].map(shipoRoundsFor)).toEqual([3, 3, 2, 2]);
  });
  it("房規 talk_seconds 夾在 60–600，非法回默認", () => {
    expect(parseShipoRules({ talk_seconds: 90 }).talk_seconds).toBe(90);
    expect(parseShipoRules({ talk_seconds: 5 }).talk_seconds).toBe(240);
    expect(parseShipoRules({ talk_seconds: "x" }).talk_seconds).toBe(240);
  });
});

describe("視圖按人裁剪", () => {
  it("peek 只有老實人拿到真相，其他人（含想想）沒有", () => {
    const s = start(4);
    const honest = idOf(s, "honest");
    for (const id of s.order) {
      const v = viewShipoFor(s, id, T0, "zh-Hans");
      if (id === honest) expect(v.me.truth?.text).toBe(shipoCardByCode(s.card_code)!.truth["zh-Hans"]);
      else expect(v.me.truth).toBeNull();
      expect(v.result).toBeNull();
    }
    const json = JSON.stringify(viewShipoFor(s, idOf(s, "bluffer"), T0, "en"));
    expect(json).not.toContain(shipoCardByCode(s.card_code)!.truth.en);
  });
  it("talk 之後老實人也不再收到真相；題面不含標題", () => {
    const s = toTalk(start(4));
    expect(viewShipoFor(s, idOf(s, "honest"), T0, "en").me.truth).toBeNull();
    expect(JSON.stringify(viewShipoFor(s, "u2", T0, "en"))).not.toContain(shipoCardByCode(s.card_code)!.title.en);
  });
  it("別人的身份在 result 之前不出現（只回自己的 role）", () => {
    const v = viewShipoFor(start(4), "u2", T0, "en");
    expect(v.me.role).not.toBeNull();
    expect(JSON.stringify(v)).not.toContain("honest_id");
  });
});

describe("流程與計分", () => {
  it("peek→talk→pick→result 由到點推進", () => {
    let s = start(4);
    s = advanceShipo(s, s.deadline_ms! + 1).state;
    expect(s.phase).toBe("talk");
    s = advanceShipo(s, s.deadline_ms! + 1).state;
    expect(s.phase).toBe("pick");
    s = advanceShipo(s, s.deadline_ms! + 1).state;
    expect(s.phase).toBe("result");
    expect(s.result?.picked_id).toBeNull();
  });
  it("指中老實人：想想＋老實人各得題面分", () => {
    const s0 = toTalk(start(4));
    const face = shipoCardByCode(s0.card_code)!.difficulty;
    const honest = idOf(s0, "honest");
    const r = pickShipo(endTalk(s0), "u1", honest, T0);
    if (!r.ok) throw new Error(r.reason);
    expect(r.state.scores.u1).toBe(3 + face);
    expect(r.state.scores[honest]).toBe(3 + face);
    expect(r.state.result?.picked_correct).toBe(true);
  });
  it("指中瞎掰人：該瞎掰人得題面分，想想不得分", () => {
    const s0 = toTalk(start(4));
    const face = shipoCardByCode(s0.card_code)!.difficulty;
    const b = bluffers(s0)[0];
    const r = pickShipo(endTalk(s0), "u1", b, T0);
    if (!r.ok) throw new Error(r.reason);
    expect(r.state.scores[b]).toBe(3 + face);
    expect(r.state.scores.u1).toBe(3);
  });
  it("公三小打中瞎掰人：想想+1、對方-1；打中老實人：想想-3", () => {
    const s0 = toTalk(start(4));
    const b = bluffers(s0)[0];
    const honest = idOf(s0, "honest");
    const a1 = accuseShipo(s0, "u1", b);
    if (!a1.ok) throw new Error(a1.reason);
    const p1 = pickShipo(endTalk(a1.state), "u1", honest, T0);
    if (!p1.ok) throw new Error(p1.reason);
    const face = shipoCardByCode(s0.card_code)!.difficulty;
    expect(p1.state.scores.u1).toBe(3 + face + 1);
    expect(p1.state.scores[b]).toBe(2);
    expect(p1.state.result?.accuse_hit).toBe("bluffer");

    const a2 = accuseShipo(s0, "u1", honest);
    if (!a2.ok) throw new Error(a2.reason);
    const p2 = pickShipo(endTalk(a2.state), "u1", b, T0);
    if (!p2.ok) throw new Error(p2.reason);
    expect(p2.state.scores.u1).toBe(0);
    expect(p2.state.result?.accuse_hit).toBe("honest");
  });
  it("公三小每輪限 1 次；只有想想、只在 talk；不能打自己", () => {
    const s0 = toTalk(start(4));
    const b = bluffers(s0)[0];
    expect(accuseShipo(s0, "u2", b)).toEqual({ ok: false, reason: "not_judge" });
    expect(accuseShipo(s0, "u1", "u1")).toEqual({ ok: false, reason: "invalid_target" });
    const a = accuseShipo(s0, "u1", b);
    if (!a.ok) throw new Error(a.reason);
    expect(accuseShipo(a.state, "u1", bluffers(s0)[1])).toEqual({ ok: false, reason: "already_accused" });
    expect(accuseShipo(start(4), "u1", b)).toEqual({ ok: false, reason: "wrong_phase" });
  });
  it("pick 只有想想、只在 pick 階段、不能指自己", () => {
    const s0 = endTalk(toTalk(start(4)));
    expect(pickShipo(s0, "u2", "u3", T0)).toEqual({ ok: false, reason: "not_judge" });
    expect(pickShipo(s0, "u1", "u1", T0)).toEqual({ ok: false, reason: "invalid_target" });
    expect(pickShipo(toTalk(start(4)), "u1", "u2", T0)).toEqual({ ok: false, reason: "wrong_phase" });
  });
});

function endTalk(s: ShipoState): ShipoState {
  const r = endTalkShipo(s, "u1", T0);
  if (!r.ok) throw new Error(r.reason);
  return r.state;
}

describe("輪次與結束", () => {
  it("全員按下一輪即開下一輪：想想傳給下一位、換新題、不重複", () => {
    let s = endTalk(toTalk(start(4)));
    const r = pickShipo(s, "u1", "u2", T0);
    if (!r.ok) throw new Error(r.reason);
    s = r.state;
    const firstCard = s.card_code;
    for (const id of ["u1", "u2", "u3"]) {
      const n = nextShipo(s, id, T0);
      if (!n.ok) throw new Error(n.reason);
      s = n.state;
      expect(s.round).toBe(1);
    }
    const last = nextShipo(s, "u4", T0, seq(0, 0, 0));
    if (!last.ok) throw new Error(last.reason);
    expect(last.state.round).toBe(2);
    expect(last.state.judge_id).toBe("u2");
    expect(last.state.phase).toBe("peek");
    expect(last.state.card_code).not.toBe(firstCard);
    expect(last.state.acks).toEqual([]);
  });
  it("末輪後 over，最高分勝（同分並列）", () => {
    let s = start(5, seq(0, 0, 0)); // 2 輪
    for (let i = 0; i < 2; i += 1) {
      // peek→talk→pick→result：每次只越過當前階段的截止
      for (let k = 0; k < 3; k += 1) s = advanceShipo(s, s.deadline_ms! + 1).state;
      expect(s.phase).toBe("result");
      s = advanceShipo(s, s.deadline_ms! + 1, seq(0, 0, 0)).state;
    }
    expect(s.phase).toBe("over");
    expect(s.winners?.length).toBeGreaterThan(0);
    expect(s.deadline_ms).toBeNull();
  });
});

describe("離場與聊天", () => {
  it("瞎掰人離場不影響本輪；老實人離場本輪作廢不計分", () => {
    const s0 = toTalk(start(5));
    const b = bluffers(s0)[0];
    expect(leaveShipo(s0, b, T0).state.phase).toBe("talk");
    const hon = idOf(s0, "honest");
    const v = leaveShipo(s0, hon, T0).state;
    expect(v.phase).toBe("result");
    expect(v.result?.voided).toBe(true);
    expect(Object.values(v.scores).every((x) => x === 3)).toBe(true);
  });
  it("在場不足 3 人直接結束", () => {
    let s = toTalk(start(4));
    s = leaveShipo(s, "u3", T0).state;
    s = leaveShipo(s, "u4", T0).state;
    expect(s.phase).toBe("over");
  });
  it("peek 全員禁言，其餘階段在場者可發", () => {
    const s = start(4);
    expect(canSendTextShipo(s, "u2").ok).toBe(false);
    expect(canSendTextShipo(toTalk(s), "u2").ok).toBe(true);
    expect(canSendTextShipo(toTalk(s), "ghost").ok).toBe(false);
  });
});

describe("房間層解析", () => {
  it("建房 game=shipo：默認 6 人，4–6 才行", () => {
    expect(parseCreateBody({ game: "shipo" })).toEqual({ game: "shipo", maxPlayers: 6, rules: { talk_seconds: 240 } });
    expect("error" in parseCreateBody({ game: "shipo", max_players: 3 })).toBe(true);
    expect("error" in parseCreateBody({ game: "shipo", max_players: 7 })).toBe(true);
  });
  it("動作包：shipo_pick／gongsansiao 要 target；next／end_talk 不要", () => {
    const base = { expected_version: 1, client_action_id: "c1" };
    expect(parseActionBody({ type: "shipo_pick", payload: { target: "u2" }, ...base })).toMatchObject({ type: "shipo_pick", target: "u2" });
    expect("error" in parseActionBody({ type: "shipo_gongsansiao", payload: {}, ...base })).toBe(true);
    expect(parseActionBody({ type: "shipo_next", ...base })).toMatchObject({ type: "shipo_next" });
    expect(parseActionBody({ type: "shipo_end_talk", ...base })).toMatchObject({ type: "shipo_end_talk" });
  });
});
