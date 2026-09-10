import { createBrowserClient } from "@supabase/ssr";

import { requireSupabaseEnv } from "./env";

/**
 * 瀏覽器端 client（Client Component 用）。`createBrowserClient` 內建
 * singleton，多次呼叫同一實例。缺 key 直接拋（fail fast，不靜默）。
 */
export function createClient() {
  const env = requireSupabaseEnv();
  return createBrowserClient(env.url, env.publicKey);
}
