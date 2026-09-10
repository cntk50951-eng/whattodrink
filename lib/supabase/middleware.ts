import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

import { requireSupabaseEnv } from "./env";

/**
 * Session 刷新（proxy 每請求調用）。簽名來自裝好的 @supabase/ssr 0.12
 * 型別：`setAll(cookiesToSet, headers)`——cookie 帶完整 options 寫回，
 * cache headers（no-store 系）同步上 response，防 CDN 把帶 session 的
 * 回包緩存給別人。形狀特意收 `response` 參數：proxy 先跑 intl 中間件
 * 拿到最終回包再進來，刷新後的 cookie 直接寫在同一包上，不另起 response。
 *
 * 缺 key 時拋（fail fast）——proxy  catch 後記紅字、只跑 intl，
 * 地圖 mock UI 不會被後端缺席拖死（AC 折衷，見 proxy.ts）。
 */
export async function updateSession(
  request: NextRequest,
  response: NextResponse,
): Promise<NextResponse> {
  const env = requireSupabaseEnv();
  const supabase = createServerClient(env.url, env.publicKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });
  // 觸發刷新（無 session 就是空跑，不拋）。鑒權一律用 getClaims，見 server.ts。
  await supabase.auth.getClaims();
  return response;
}
