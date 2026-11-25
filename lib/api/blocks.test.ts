import { describe, expect, it } from "vitest";

import { blockedIdsFromRows } from "./blocks";

describe("blockedIdsFromRows", () => {
  it("extracts peer user ids bidirectionally", () => {
    const out = blockedIdsFromRows("u1", [
      { blocker_id: "u1", blocked_id: "u2" },
      { blocker_id: "u3", blocked_id: "u1" },
      { blocker_id: "u4", blocked_id: "u5" },
      { blocker_id: "u1", blocked_id: "" },
    ]);
    expect([...out].sort()).toEqual(["u2", "u3"]);
  });

  it("returns empty set for empty viewerId", () => {
    expect(blockedIdsFromRows("", [{ blocker_id: "u1", blocked_id: "u2" }]).size).toBe(0);
  });
});

import { vi } from "vitest";
import { BlockLookupError, getBlockedUserIds, isPairBlocked, withBlockGuard } from "./blocks";

/** 假 svc：from().select().or().limit() 解析為指定結果（模擬 PostgREST 回 {error} 而非拋例外）。 */
const svcReturning = (result: { data: unknown; error: unknown } | "throw") =>
  ({
    from: () => ({
      select: () => ({
        or: () => ({
          limit: async () => {
            if (result === "throw") throw new Error("network");
            return result;
          },
        }),
      }),
    }),
  }) as never;

describe("封鎖查詢出錯不能當成「沒有封鎖」（第七輪 §3.2 fail-open）", () => {
  it("getBlockedUserIds：{error} → 拋 BlockLookupError，不回空集合", async () => {
    await expect(getBlockedUserIds(svcReturning({ data: null, error: { code: "57014" } }), "u1")).rejects.toBeInstanceOf(BlockLookupError);
  });
  it("getBlockedUserIds：形狀異常／網路例外同樣拋", async () => {
    await expect(getBlockedUserIds(svcReturning({ data: {}, error: null }), "u1")).rejects.toBeInstanceOf(BlockLookupError);
    await expect(getBlockedUserIds(svcReturning("throw"), "u1")).rejects.toBeInstanceOf(BlockLookupError);
  });
  it("isPairBlocked：{error} → 拋，不回 false", async () => {
    await expect(isPairBlocked(svcReturning({ data: null, error: { code: "XX000" } }), "u1", "u2")).rejects.toBeInstanceOf(BlockLookupError);
  });
  it("正常結果不變：有行 → true／空集合；同人或空 id 不查庫", async () => {
    expect(await isPairBlocked(svcReturning({ data: [{ blocker_id: "u1" }], error: null }), "u1", "u2")).toBe(true);
    expect(await isPairBlocked(svcReturning({ data: [], error: null }), "u1", "u2")).toBe(false);
    expect(await isPairBlocked(svcReturning("throw"), "u1", "u1")).toBe(false);
    const ids = await getBlockedUserIds(svcReturning({ data: [{ blocker_id: "u2", blocked_id: "u1" }], error: null }), "u1");
    expect([...ids]).toEqual(["u2"]);
  });
  it("withBlockGuard：BlockLookupError → 503 可重試；其他錯誤原樣拋", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await withBlockGuard(async () => {
      throw new BlockLookupError("pair", "XX000");
    })();
    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("2");
    await expect(withBlockGuard(async () => { throw new Error("other"); })()).rejects.toThrow("other");
    expect((await withBlockGuard(async () => new Response("ok"))()).status).toBe(200);
  });
});
