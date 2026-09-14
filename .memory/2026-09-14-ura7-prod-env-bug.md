# 2026-09-14 UR A.7 prod env bug：瀏覽器 createClient 誤用 secret-requiring env

## 情境
- A.7 剛上線，用戶在 production（Vercel `whattodrink-psi.vercel.app`）點
  Google 登入，UI 直接顯示「登入失敗，再試一次」。
- 用戶報：F12 Network 點完按鈕**完全沒新請求**，Console 也**沒紅字**。
- 排查走了一圈：Supabase Site URL ✓、Redirect URLs ✓、Google Provider
  ON + Client ID/Secret 有值 ✓、Vercel env 三條 key 名都對（含
  `NEXT_PUBLIC_` 前綴）✓、Redeploy 後還掛。**所有外部配置都對，症狀不合常理**。

## 問題
症狀：「點按鈕 → 沒請求 → 沒 console 紅字 → UI 顯示登入失敗」。
這組合只可能來自：**try/catch 吞掉的 client-side throw**。

## 原因
- `lib/supabase/client.ts:10` 原本寫 `requireSupabaseEnv()`。
- `requireSupabaseEnv` 要求**三組 key**（含 `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SECRET_KEY`）。
- **Next.js 行為**：build 時只把 `NEXT_PUBLIC_*` inline 進瀏覽器 bundle。
  `SUPABASE_SERVICE_ROLE_KEY` 沒前綴 → **瀏覽器永遠讀不到**，Vercel
  env 怎麼設都一樣。
- 結果：`createClient()` throw → `LoginPanel` 的 `try/catch` 靜默吞掉（**沒寫
  `console.error`**，所以 console 也不紅字）→ `setError(true)` → UI 報失敗。
  連 `supabase.auth.signInWithOAuth` 那行都沒跑到，所以 Network 沒請求。
- **本地 `npm run dev` 從來沒事**：dev server 是 Node 進程，process.env
  有 `SUPABASE_SERVICE_ROLE_KEY`（從 `.env` 讀），瀏覽器端是 dev server
  注入的。**只有 production build 觸發**——經典「本地能跑 prod 掛」陷阱。

## 修正
- `lib/supabase/env.ts` 加 `SupabasePublicEnv` 型別 + `resolveSupabasePublicEnv` +
  `requireSupabasePublicEnv`（只要求 `NEXT_PUBLIC_SUPABASE_URL` + 一個 public key，
  publishable 優先 anon 兜底，不碰 secret）。
- `lib/supabase/client.ts` 改用 public 版，加 doc 註記「瀏覽器端拿不到
  server-only key」的根因。
- `components/auth/LoginPanel.tsx` 的 `try/catch` 補 `console.error`——
  之前 silent 吞錯害這次 debug 兩輪，下次同症狀第一時間 console 見紅字。
- `lib/supabase/env.test.ts` 補 4 個 case 釘住「public-only 場景」：成功、
  publishable 兼容、缺 URL 拋、缺 public key 拋。

## 教訓（兩條）
1. **Client/Server 共用 env helper 時要分開**：`requireSupabaseEnv` 寫成「三組
   全要」是 server-friendly 但 client-unfriendly，導致 client 端誤用。修法是
   開 public 版本專給瀏覽器，server 端仍用全祕版。下次寫共用 env helper
   就要想清楚 client/server 分支，或直接拆兩個。
2. **`try/catch` 不要 silent**——`console.error` 一行就能省 debug 兩輪。本地
   dev console 是 debug 黃金入口，prod 雖然用戶看不到但 Sentry 之類會抓，
   至少不會再「UI 報錯但無 log 線索」。

## 門
- 173 passed（+4）／tsc 淨／lint 0 error（3 預存 warning 無關）／build ✓。
- 待用戶 Redeploy Vercel 才生效（env 改了不需 redeploy，但 code 改了要）。
