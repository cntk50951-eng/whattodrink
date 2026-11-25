import { describe, expect, it, vi } from "vitest";

import { retryWrite } from "./retryWrite";

const noSleep = async () => undefined;
describe("retryWrite", () => {
  it("瞬時錯誤重試到成功", async () => {
    const run = vi.fn().mockResolvedValueOnce({ error: { code: "08006" } }).mockResolvedValueOnce({ error: null });
    expect(await retryWrite(run, { sleep: noSleep })).toEqual({ error: null, attempts: 2 });
  });
  it("例外也算失敗並重試", async () => {
    const run = vi.fn().mockRejectedValueOnce(new Error("socket")).mockResolvedValueOnce({ error: null });
    expect((await retryWrite(run, { sleep: noSleep })).error).toBeNull();
  });
  it("永久錯誤（約束／缺表／請求不合法）不重試", async () => {
    for (const code of ["23505", "42P01", "PGRST102"]) {
      const run = vi.fn().mockResolvedValue({ error: { code } });
      const r = await retryWrite(run, { sleep: noSleep });
      expect(run).toHaveBeenCalledTimes(1);
      expect(r.error?.code).toBe(code);
    }
  });
  it("用盡次數回最後一個 error", async () => {
    const run = vi.fn().mockResolvedValue({ error: { code: "XX000", message: "down" } });
    const r = await retryWrite(run, { attempts: 3, sleep: noSleep });
    expect(run).toHaveBeenCalledTimes(3);
    expect(r).toMatchObject({ attempts: 3, error: { code: "XX000" } });
  });
  it("退避遞增", async () => {
    const waits: number[] = [];
    await retryWrite(async () => ({ error: { code: "XX000" } }), { attempts: 3, baseDelayMs: 100, sleep: async (ms) => { waits.push(ms); } });
    expect(waits).toEqual([100, 200]);
  });
});
