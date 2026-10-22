import { describe, expect, it } from "vitest";

import {
  CLEANUP_COLUMNS,
  GRACE_DAYS,
  RESTORE_TABLES,
  chunk,
  isRestorable,
  parseDeleteBody,
  parseSnapshot,
  planRestore,
  purgeAtFrom,
} from "./accountDeletion";

const UID = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

describe("parseDeleteBody", () => {
  it("需要 confirm:true 与合法 mode", () => {
    expect(parseDeleteBody({ mode: "now", confirm: true })).toEqual({ mode: "now" });
    expect(parseDeleteBody({ mode: "grace", confirm: true })).toEqual({ mode: "grace" });
  });
  it("缺 confirm／mode 非法／非对象 → error", () => {
    expect("error" in parseDeleteBody({ mode: "now" })).toBe(true);
    expect("error" in parseDeleteBody({ mode: "now", confirm: "yes" })).toBe(true);
    expect("error" in parseDeleteBody({ mode: "later", confirm: true })).toBe(true);
    expect("error" in parseDeleteBody(null)).toBe(true);
    expect("error" in parseDeleteBody("x")).toBe(true);
  });
});

describe("purgeAtFrom／isRestorable", () => {
  const now = new Date("2026-10-22T00:00:00.000Z");
  it("到期＝申请时间＋30 天", () => {
    expect(GRACE_DAYS).toBe(30);
    expect(purgeAtFrom(now).toISOString()).toBe("2026-11-21T00:00:00.000Z");
  });
  it("恢复期内可恢复；到期当刻、过期、已清除、无记录都不可", () => {
    const grace = (purge_at: string, status = "grace") => ({ status, purge_at });
    expect(isRestorable(grace("2026-11-21T00:00:00.000Z"), now)).toBe(true);
    expect(isRestorable(grace("2026-10-22T00:00:00.000Z"), now)).toBe(false);
    expect(isRestorable(grace("2026-10-01T00:00:00.000Z"), now)).toBe(false);
    expect(isRestorable(grace("2026-11-21T00:00:00.000Z", "purged"), now)).toBe(false);
    expect(isRestorable(grace("not-a-date"), now)).toBe(false);
    expect(isRestorable(null, now)).toBe(false);
  });
});

describe("chunk", () => {
  it("按大小切块", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
  });
});

describe("parseSnapshot／planRestore", () => {
  const snap = {
    users: [{ id: UID, nickname: "阿明" }],
    tables: {
      checkins: [
        { id: "c1", user_id: UID },
        { id: "c2", user_id: OTHER }, // 被改坏：别人的行不许写进来
      ],
      checkin_comments: [{ id: "m1", user_id: UID, post_id: "c1" }],
      devices: [{ id: "d1", user_id: UID }], // 不在恢复范围：丢弃
      bar_memories: "oops", // 坏形状：忽略
    },
  };

  it("坏形状回 null", () => {
    expect(parseSnapshot(null)).toBeNull();
    expect(parseSnapshot({ users: [], tables: {} })).toBeNull();
    expect(parseSnapshot({ users: [{ id: UID }, { id: UID }], tables: {} })).toBeNull();
    expect(parseSnapshot({ users: ["x"], tables: {} })).toBeNull();
  });

  it("只保留白名单表；users 先于其余，帖子先于评论；过滤掉不属于该用户的行", () => {
    const parsed = parseSnapshot(snap);
    expect(parsed).not.toBeNull();
    const plan = planRestore(parsed!, UID);
    expect(plan.map((p) => p.table)).toEqual(["users", "checkins", "checkin_comments"]);
    expect(plan[1].rows).toEqual([{ id: "c1", user_id: UID }]);
  });

  it("users 行 id 与申请人不符 → 空计划", () => {
    const parsed = parseSnapshot(snap)!;
    expect(planRestore(parsed, OTHER)).toEqual([]);
  });
});

describe("表清单不变量", () => {
  it("恢复范围里的内容表都在删除清单里（否则删不干净或恢复出重复）", () => {
    const cleaned = new Set(CLEANUP_COLUMNS.map((c) => `${c.table}.${c.col}`));
    // SET NULL 的内容表必须在清单；CASCADE 表由删 users 行带走，不在清单也对
    for (const t of ["checkins", "checkin_comments", "post_likes", "mood_logs"]) {
      expect(cleaned.has(`${t}.user_id`)).toBe(true);
    }
  });
  it("恢复顺序：checkins 在评论之前", () => {
    const order = RESTORE_TABLES.map((t) => t.table);
    expect(order.indexOf("checkins")).toBeLessThan(order.indexOf("checkin_comments"));
  });
});
