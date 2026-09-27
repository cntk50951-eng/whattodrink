# 2026-08-24 UR2.4 预览路由 404：next-intl never 前缀下路由必须建在 [locale] 段内

- 现象：新建 `app/preview-beer-icons/page.tsx` 后访问 `/preview-beer-icons` 返回 404（dev server 正常运行）。
- 根因：`proxy.ts`（next-intl middleware，`localePrefix: 'never'`）把所有页面请求内部 rewrite 到 `/[locale]/xxx`；段外的直挂路由永远够不着，再编译也不会生效。
- 修复：路由文件搬到 `app/[locale]/preview-beer-icons/page.tsx`，对外 URL 不变（仍是 `/preview-beer-icons`），tsc 通过。
- 教训：本仓库任何新页面路由（含临时预览页）一律建在 `app/[locale]/` 之下；以后凡加 `app/*.tsx` 直挂路由，先查 `proxy.ts` + `i18n/routing.ts`。
