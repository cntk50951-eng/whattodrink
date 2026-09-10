import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { requireSupabaseEnv } from "./env";

/**
 * 服務端 client（Server Component／Route Handler／Server Action，
 * 每次請求新建——官方要求：cookie 是按請求綁定的，跨請求共用會漏 session
 * 給別人）。`setAll` 包 try/catch：Server Component 裡寫不了 header，
 * 寫 cookie 的事交給 proxy 每請求處理（官方配方）。
 */
export async function createClient() {
  const env = requireSupabaseEnv();
  const cookieStore = await cookies();
  return createServerClient(env.url, env.publicKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          /* Server Component 寫 header 會拋，忽略（proxy 會寫）。 */
        }
      },
    },
  });
}

/**
 * 鑒權用 `getClaims()` 不用 `getUser()`（官方指引：前者本地驗 JWT 簽名，
 * 不打 Auth server；後者是新鮮 user 記錄才用）。
 */
export async function getUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims.sub ?? null;
}
