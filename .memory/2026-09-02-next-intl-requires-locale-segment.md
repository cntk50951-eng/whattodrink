# 2026-09-02: next-intl + Next.js 16 必須用 `[locale]` segment

## 情境

想用 next-intl 做 i18n，參考文件把所有 routes 放在 `(marketing)` route group 下，加了 `proxy.ts`（Next.js 16 把 middleware 改名了）做 locale routing，cookie-based 切換。

結果首頁 HTTP 404。dev server log 顯示 proxy.ts 跑成功（proxy.ts: 486ms），但 route resolution 找不到 `/`。

## 問題

- 我把 page 放在 `app/(marketing)/page.tsx`（route group，不影響 URL）
- 期望 URL `/` → proxy 內部 rewrite 到 `/zh-Hant`（預設 locale）
- 但 `(marketing)/page.tsx` 註冊到 `/`，**沒有** `/zh-Hant` 這個 route
- proxy rewrite 到不存在的 path → 404
- `x-middleware-rewrite: /zh-Hant` header 確認了內部 rewrite 目標

## 原因

next-intl 需要 `[locale]` dynamic segment 才能讓 proxy 的 locale-aware rewrite 對應到正確 route。Route group `(marketing)` 只做組織用途、不暴露 URL segment，所以 proxy 無法把 `/` rewrite 到 `[locale]=zh-Hant`。

## 修正

把 route 從 `(marketing)` 改放到 `[locale]` 下：
```
app/
  layout.tsx              # 只放 <html>/<body>
  [locale]/
    layout.tsx            # 含 NextIntlClientProvider + ThemeProvider + header/footer
    page.tsx              # / 
    camera/page.tsx       # /camera
    mood/page.tsx         # /mood
```

`[locale]/layout.tsx` 必須：
```ts
const { locale } = await params;
if (!hasLocale(routing.locales, locale)) notFound();
setRequestLocale(locale);
```

## 學習

- **next-intl 文件 100% 都用 `[locale]` segment pattern**，我當時選 `(marketing)` 是為了「避免 URL 變髒」，結果踩坑
- **Route group vs dynamic segment**：group 純組織用途，segment 才是 URL 路由。URL 結構相關的需求用 segment
- **`localePrefix: 'never'` 仍會有內部 rewrite**，但因為有 `[locale]` segment，rewrite 目標合法 → 不會 404
- **proxy.ts: 486ms 在 log 是 proxy 真的跑了**，但後續 route resolution 失敗。debug 時看 `x-middleware-rewrite` header 可知 rewrite 目標

## 相關

- `.harness/coding-standards.md` — 之後可加 next-intl 必須用 [locale] 的規則
- `app/layout.tsx` — globals.css 也要在 root layout import，不能因為重構移到 [locale] 就漏掉

## 副發現：globals.css 也要在 root layout

重構時把 globals.css import 從原 `(marketing)/layout.tsx` 漏掉到新 `[locale]/layout.tsx`。結果 tailwind 沒套用，整頁 `display: block` 而不是 grid。

教訓：**root layout 永遠 import globals.css**，即使大部分內容已搬到 nested layout。