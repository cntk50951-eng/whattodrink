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
 * 另兼容 `Authorization: Bearer <jwt>`（iOS/AOS/curl 測試雙通道，見 api-architecture §4）。
 */
export async function getUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims.sub) return data.claims.sub;
  // Fallback: Bearer 雙通道（mobile/curl），cookie 為空時嘗試 Authorization 頭
  try {
    const { headers } = await import("next/headers");
    const headerList = await headers();
    const auth = headerList.get("authorization");
    if (auth?.startsWith("Bearer ")) {
      const token = auth.slice(7).trim();
      if (token.length > 0) {
        const { createClient: createSupabaseJs } = await import("@supabase/supabase-js");
        const env = requireSupabaseEnv();
        const supa = createSupabaseJs(env.url, env.publicKey, {
          auth: { persistSession: false },
        });
        const { data: userData } = await supa.auth.getUser(token);
        return userData.user?.id ?? null;
      }
    }
  } catch {
    // headers() 在某些 edge 還境不可用，忽略降級為 null
  }
  return null;
}

/**
 * 帶鑒權的 Supabase client（與 getUserId 同雙通道）。
 * Route Handler 內寫庫前用此 client，RLS 才能以 `auth.uid()` 生效；
 * 僅 cookie 的 `createClient()` 在 Bearer 場景會因無 session 而 42501。
 */
export async function getAuthedClient(req?: Request): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string | null;
}> {
  // 先試 cookie
  const cookieClient = await createClient();
  const { data } = await cookieClient.auth.getClaims();
  if (data?.claims.sub) {
    return { supabase: cookieClient, userId: data.claims.sub };
  }
  // 再試 Bearer（優先從 req 讀，否則從 next/headers 讀）
  let token: string | null = null;
  if (req !== undefined) {
    const h = req.headers.get("authorization");
    if (h?.startsWith("Bearer ")) token = h.slice(7).trim();
  }
  if (token === null) {
    try {
      const { headers } = await import("next/headers");
      const headerList = await headers();
      const h = headerList.get("authorization");
      if (h?.startsWith("Bearer ")) token = h.slice(7).trim();
    } catch {}
  }
  if (token !== null && token.length > 0) {
    const { createClient: createSupabaseJs } = await import("@supabase/supabase-js");
    const env = requireSupabaseEnv();
    const supa = createSupabaseJs(env.url, env.publicKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData } = await supa.auth.getUser(token);
    const uid = userData.user?.id ?? null;
    if (uid !== null) {
      // 用帶 Authorization 頭的 client 作 DB，RLS 才能過
      return { supabase: supa as unknown as Awaited<ReturnType<typeof createClient>>, userId: uid };
    }
  }
  return { supabase: cookieClient, userId: null };
}
