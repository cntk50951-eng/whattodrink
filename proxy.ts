import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

/**
 * Reads the locale from cookie → Accept-Language → defaultLocale (zh-Hant)
 * and persists the resolved locale to the `NEXT_LOCALE` cookie.
 * Combined with `localePrefix: 'never'`, URLs stay clean (/, /bars, /mood).
 *
 * UR A.3：先跑 intl 拿到最終回包，再進 Supabase session 刷新——
 * 刷新後的 cookie（含 options）＋no-store headers 直接寫在同一包上。
 * 後端缺席（缺 key）時記紅字、只跑 intl：地圖 mock UI 照常可逛，
 * `/api/v1/health` 看自檢狀態。
 */
export default async function proxy(request: NextRequest) {
  const response = intlMiddleware(request) ?? NextResponse.next();
  try {
    return await updateSession(request, response);
  } catch (err) {
    console.error(
      `[supabase] session refresh skipped: ${(err as Error).message}`,
    );
    return response;
  }
}

export const config = {
  // Match everything except Next internals, static assets, and the API.
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};