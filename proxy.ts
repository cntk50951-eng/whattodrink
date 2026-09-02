import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

/**
 * Reads the locale from cookie → Accept-Language → defaultLocale (zh-Hant)
 * and persists the resolved locale to the `NEXT_LOCALE` cookie.
 * Combined with `localePrefix: 'never'`, URLs stay clean (/, /bars, /mood).
 */
export default createMiddleware(routing);

export const config = {
  // Match everything except Next internals, static assets, and the API.
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};