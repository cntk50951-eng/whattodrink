import { describe, expect, it } from "vitest";
import { clientRequestIdOf, parseClientRequestId } from "./clientRequestId";

describe("clientRequestId（iOS IOS-C04）", () => {
  it("收 UUID 等安全字串，去空白", () => {
    expect(parseClientRequestId("3F2504E0-4F89-11D3-9A0C-0305E82C3301")).toBe("3F2504E0-4F89-11D3-9A0C-0305E82C3301");
    expect(parseClientRequestId("  abc_def-123  ")).toBe("abc_def-123");
  });
  it("缺省、太短、太長、含其他字元 → null（不做冪等）", () => {
    expect(parseClientRequestId(undefined)).toBeNull();
    expect(parseClientRequestId("short")).toBeNull();
    expect(parseClientRequestId("x".repeat(65))).toBeNull();
    expect(parseClientRequestId("abc def 123")).toBeNull();
    expect(parseClientRequestId(12345678)).toBeNull();
  });
  it("從請求體取", () => {
    expect(clientRequestIdOf({ client_request_id: "abcdefgh" })).toBe("abcdefgh");
    expect(clientRequestIdOf(null)).toBeNull();
    expect(clientRequestIdOf("x")).toBeNull();
  });
});
