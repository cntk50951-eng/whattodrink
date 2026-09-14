import { describe, expect, it } from "vitest";

import {
  requireSupabaseEnv,
  requireSupabasePublicEnv,
  resolveSupabaseEnv,
} from "./env";

describe("resolveSupabaseEnv", () => {
  it("三組全缺時逐一點名", () => {
    const { env, missing } = resolveSupabaseEnv({});
    expect(env).toBeNull();
    expect(missing).toHaveLength(3);
    expect(missing[0]).toBe("NEXT_PUBLIC_SUPABASE_URL");
  });

  it("空字符串視同缺失", () => {
    const { env, missing } = resolveSupabaseEnv({
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "a",
      SUPABASE_SERVICE_ROLE_KEY: "s",
    });
    expect(env).toBeNull();
    expect(missing).toContain("NEXT_PUBLIC_SUPABASE_URL");
  });

  it("舊制三件套通過", () => {
    const { env, missing } = resolveSupabaseEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      SUPABASE_SERVICE_ROLE_KEY: "service",
    });
    expect(missing).toEqual([]);
    expect(env).toEqual({
      url: "https://x.supabase.co",
      publicKey: "anon",
      secretKey: "service",
    });
  });

  it("新制優先、舊制兜底", () => {
    const { env } = resolveSupabaseEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "pub",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      SUPABASE_SECRET_KEY: "sec",
      SUPABASE_SERVICE_ROLE_KEY: "service",
    });
    expect(env?.publicKey).toBe("pub");
    expect(env?.secretKey).toBe("sec");
  });

  it("require 缺 key 即拋紅字（含 key 名）", () => {
    expect(() => requireSupabaseEnv({})).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});

/**
 * UR A.7 prod bug fix：瀏覽器 createClient 只用到 url + publicKey，
 * 不該 require secret key。`requireSupabasePublicEnv` 是 client.ts 的依賴。
 */
describe("requireSupabasePublicEnv", () => {
  it("只給 public 兩條（瀏覽器場景）就過", () => {
    const env = requireSupabasePublicEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      // 注意：故意不傳 SUPABASE_SERVICE_ROLE_KEY——
      // 瀏覽器端 NEXT_PUBLIC_ 之外的 env 永遠讀不到
    });
    expect(env).toEqual({
      url: "https://x.supabase.co",
      publicKey: "anon",
    });
  });

  it("新制 publishable 也吃（public 內部只看 NEXT_PUBLIC_）", () => {
    const env = requireSupabasePublicEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "pub",
    });
    expect(env?.publicKey).toBe("pub");
  });

  it("缺 URL 就拋（且只列 URL，不誤導瀏覽器去找 secret）", () => {
    expect(() =>
      requireSupabasePublicEnv({ NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon" }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("缺 public key 就拋", () => {
    expect(() =>
      requireSupabasePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
      }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_(PUBLISHABLE_KEY|ANON_KEY)/);
  });
});
