import { describe, expect, it } from "vitest";

import { requireSupabaseEnv, resolveSupabaseEnv } from "./env";

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
