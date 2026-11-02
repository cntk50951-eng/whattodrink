import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";
import { parseHomeUi, parseSiteLive, resolveHomeTarget, resolveSiteGate } from "@/lib/home";
import { routing } from "./i18n/routing";
import { isOpsPath } from "./lib/opsPath";
import { isSharePath } from "./lib/share/partyPage";

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
  // 內部審核後台不在 [locale] 路由樹下：不能走 intl（否則被改寫成 /zh-Hant/innerharbour/* 而 404）。
  // 仍要刷新 Supabase 會話 cookie（後台靠 cookie 會話＋TOTP）。
  if (isOpsPath(request.nextUrl.pathname)) {
    const plain = NextResponse.next();
    try {
      return await updateSession(request, plain);
    } catch (err) {
      console.error(`[supabase] session refresh skipped (ops): ${(err as Error).message}`);
      return plain;
    }
  }
  // UR L.1：全站開關先行（只在 ops 之後）——SITE_LIVE=false 時訪客路由一律 307
  // 到 /coming-soon（locale 前綴保留語言；coming-soon 本體放行方便預覽；
  // /p/* 分享頁是訪客向，一併鎖；缺省 true 零行為變化）。
  // 注意：env 編譯期烘焙——Vercel 改值後需 redeploy 才生效（沿 C.7 口徑）。
  const siteGate = resolveSiteGate(
    request.nextUrl.pathname,
    parseSiteLive(process.env.SITE_LIVE),
    routing.locales,
  );
  if (siteGate !== null) {
    return NextResponse.redirect(new URL(siteGate, request.url));
  }
  // 酒局分享落地頁 /p/<id>（app/p，不在 [locale] 樹下）：開站時跳過 intl 改寫，
  // 匿名可看，不刷會話。關站時上面已攔，不會走到這裡。
  if (isSharePath(request.nextUrl.pathname)) return NextResponse.next();
  // UR C.7：首頁版本開關先行——裸 `/`＋v2 檔明跳 `/v2`；
  // 其餘（含 v1 深鏈）原樣進 intl＋session 鏈，v1 一個字節不動。
  const homeTarget = resolveHomeTarget(
    request.nextUrl.pathname,
    request.nextUrl.search,
    parseHomeUi(process.env.HOME_UI),
    routing.locales,
  );
  if (homeTarget !== null) {
    return NextResponse.redirect(new URL(homeTarget, request.url));
  }
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
  // Match everything except Next internals, static assets, API, and auth callback.
  matcher: ["/((?!api|auth|_next|.*\\..*).*)"],
};