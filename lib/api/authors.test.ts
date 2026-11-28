import { describe, expect, it, vi } from "vitest";

import { attachAuthors } from "./authors";

const service = (data: unknown, error: { code: string } | null = null) => {
  const inFilter = vi.fn(async () => ({ data, error }));
  const select = vi.fn(() => ({ in: inFilter }));
  return { client: { from: () => ({ select }) }, select, inFilter };
};

describe("attachAuthors", () => {
  it("按 user_id 補上與內嵌相同的形狀，id 不混進作者欄位", async () => {
    const { client, select, inFilter } = service([{ id: "a", nickname: "A" }]);
    const out = await attachAuthors(client, [{ id: "1", user_id: "a" }, { id: "2", user_id: "gone" }, { id: "3", user_id: null }], "nickname");
    expect(out.rows).toEqual([
      { id: "1", user_id: "a", users: { nickname: "A" } },
      { id: "2", user_id: "gone", users: null },
      { id: "3", user_id: null, users: null },
    ]);
    expect(select).toHaveBeenCalledWith("id,nickname");
    expect(inFilter).toHaveBeenCalledWith("id", ["a", "gone"]);
  });
  it("沒有作者就不查；查詢失敗回錯誤", async () => {
    const none = service([]);
    expect((await attachAuthors(none.client, [], "nickname")).rows).toEqual([]);
    expect(none.select).not.toHaveBeenCalled();
    const failed = service(null, { code: "42501" });
    expect(await attachAuthors(failed.client, [{ user_id: "a" }], "nickname")).toEqual({ rows: null, error: { code: "42501" } });
  });
});
