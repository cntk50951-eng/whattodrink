import { createBrowserClient } from "@supabase/ssr";

import { requireSupabasePublicEnv } from "./env";

/**
 * 瀏覽器端 client（Client Component 用）。`createBrowserClient` 內建
 * singleton，多次呼叫同一實例。缺 key 直接拋（fail fast，不靜默）。
 *
 * UR A.7 prod bug fix：用 `requireSupabasePublicEnv` 而非 `requireSupabaseEnv`——
 * 瀏覽器端拿不到 server-only 的 `SUPABASE_SERVICE_ROLE_KEY`（Next.js 只 inline
 * `NEXT_PUBLIC_*`），誤用 secret-requiring 版會在 production build 拋錯被
 * LoginPanel try/catch 吞掉、無新請求、無 console 紅字。
 */
export function createClient() {
  const env = requireSupabasePublicEnv();
  return createBrowserClient(env.url, env.publicKey);
}
