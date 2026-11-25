import { describe, expect, it } from "vitest";

import { parseCompositeCursor } from "./compositeCursor";

const id = "0b8f6f0e-6a4f-4a9e-9d57-1c2b3a4d5e6f";
describe("parseCompositeCursor", () => {
  it("接受 PostgREST 的微秒時間戳＋UUID", () => {
    expect(parseCompositeCursor(`2026-11-24T10:00:00.123456+00:00|${id}`)).toEqual({ createdAt: "2026-11-24T10:00:00.123456+00:00", id });
    expect(parseCompositeCursor(`2026-11-24T10:00:00Z|${id}`)?.id).toBe(id);
  });
  it("純時間戳（舊客戶端）／缺 id／null → null，退回舊游標", () => {
    expect(parseCompositeCursor("2026-11-24T10:00:00.123Z")).toBeNull();
    expect(parseCompositeCursor(`|${id}`)).toBeNull();
    expect(parseCompositeCursor("2026-11-24T10:00:00Z|")).toBeNull();
    expect(parseCompositeCursor(null)).toBeNull();
  });
  it("拒絕能逃出 or() 的內容（逗號、括號、點運算子）", () => {
    expect(parseCompositeCursor(`2026-11-24T10:00:00Z),id.not.is.null,and(x.eq.1|${id}`)).toBeNull();
    expect(parseCompositeCursor(`2026-11-24T10:00:00Z|${id},status.eq.x`)).toBeNull();
    expect(parseCompositeCursor(`2026-11-24T10:00:00Z|not-a-uuid`)).toBeNull();
  });
});
