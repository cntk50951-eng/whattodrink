import { describe, expect, it } from "vitest";
import {
  isClientKeyColumnMissing,
  isClientKeyConflict,
  parseIdempotencyKey,
  stripMissingOptionalColumn,
} from "./checkinIdempotency";

describe("parseIdempotencyKey", () => {
  it("接受 UUID 與一般 key，去前後空白", () => {
    expect(parseIdempotencyKey("3F2504E0-4F89-11D3-9A0C-0305E82C3301")).toBe("3F2504E0-4F89-11D3-9A0C-0305E82C3301");
    expect(parseIdempotencyKey("  abc_DEF-12345678  ")).toBe("abc_DEF-12345678");
  });
  it("缺席／太短／太長／含非法字元一律忽略（回 null，不是錯誤）", () => {
    expect(parseIdempotencyKey(null)).toBeNull();
    expect(parseIdempotencyKey(undefined)).toBeNull();
    expect(parseIdempotencyKey("")).toBeNull();
    expect(parseIdempotencyKey("short")).toBeNull();
    expect(parseIdempotencyKey("a".repeat(65))).toBeNull();
    expect(parseIdempotencyKey("has space in it 123")).toBeNull();
    expect(parseIdempotencyKey("emoji-😀-12345678")).toBeNull();
  });
});

describe("stripMissingOptionalColumn", () => {
  it("只去掉錯誤訊息點名的那一列，與列的先後順序無關", () => {
    const cols: Record<string, unknown> = { hashtags: ["a"], photo_urls: ["x", "y"], client_key: "k" };
    expect(stripMissingOptionalColumn(cols, 'column "client_key" of relation "checkins" does not exist')).toBe("client_key");
    expect(Object.keys(cols)).toEqual(["hashtags", "photo_urls"]);
    expect(stripMissingOptionalColumn(cols, 'column "hashtags" of relation "checkins" does not exist')).toBe("hashtags");
    expect(Object.keys(cols)).toEqual(["photo_urls"]);
  });
  it("訊息沒點名任何可選列（例如 0007 的 kind 缺列）→ null，交給舊回退", () => {
    const cols: Record<string, unknown> = { client_key: "k" };
    expect(stripMissingOptionalColumn(cols, 'column "visibility" of relation "checkins" does not exist')).toBeNull();
    expect(Object.keys(cols)).toEqual(["client_key"]);
    expect(stripMissingOptionalColumn(cols, undefined)).toBeNull();
  });
});

describe("conflict／missing-column 判斷", () => {
  it("只有 client_key 的 23505 才算冪等衝突", () => {
    expect(isClientKeyConflict({ code: "23505", message: 'duplicate key value violates unique constraint "checkins_user_client_key_uniq"' })).toBe(true);
    expect(isClientKeyConflict({ code: "23505", message: "duplicate key ... checkins_pkey" })).toBe(false);
    expect(isClientKeyConflict({ code: "23503", message: "client_key" })).toBe(false);
    expect(isClientKeyConflict(null)).toBe(false);
  });
  it("client_key 列不存在", () => {
    expect(isClientKeyColumnMissing({ code: "42703", message: 'column "client_key" does not exist' })).toBe(true);
    expect(isClientKeyColumnMissing({ code: "42703", message: 'column "photo_urls" does not exist' })).toBe(false);
    expect(isClientKeyColumnMissing(null)).toBe(false);
  });
});
