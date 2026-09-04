# 2026-09-04: sandbox 下 next/font 與 Turbopack build 全滅，改走 <link> + 獨立驗證

## 情境

UR1.5 要加 Caveat 手寫字體，原生做法 `next/font/google` 在 `npm run build` 全滅。

## 問題

1. `next/font/google`（連本來好好的 Geist）全部 `module-not-found`：sandbox proxy 回給 next/font 的 CSS 是 truetype-only（正常應為 woff2），next/font 打包失敗。curl 實測 `fonts.googleapis.com` 經 proxy 可通並回 200，但內容被改寫過。
2. 拿掉 next/font 改 `<link>` 後，`next build`（Turbopack）panic：`evaluate_webpack_loader → creating new process → binding to a port → Operation not permitted`。Turbopack 的 CSS worker 要開 process 綁 port，被 sandbox 擋。`--no-turbopack` 旗在 Next 16 不存在。
3. 連帶：`npm run dev` 綁 :3000 同樣會被擋，`open` 調不到 LaunchServices——sandbox session 的 build/dev/瀏覽器三件套只能用戶在自己終端跑。

## 原因

sandbox 擋三樣：非代理直連（迫使經 proxy，改寫字體 CSS）、子行程綁 port（Turbopack worker、dev server）、LaunchServices／瀏覽器行程。

## 修正

1. 字體改 `<link>`（root layout `<head>`，同 POC 做法），`--font-*` 變成 globals.css `:root` 明碼變量；`@utility font-hand` 照寫。
2. 在 sandbox 內能驗的拆開驗：`npx tsc --noEmit`（型別）、`npm run lint`（無新增 error 即可，舊 error 不擋）、node 直跑 `postcss([require('@tailwindcss/postcss')])` 編 globals.css（驗 `@utility`/變量，指標：`.font-hand` 有生成）。
3. 完整 `next build`＋`npm run dev`＋瀏覽器驗收交給用戶在自己終端跑，回報後再進 commit 流程。
4. `no-page-custom-font` warning（root layout 的 font `<link>`）可接受：gate 只擋 error；消不掉且不值得繞。
