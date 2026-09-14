# 2026-09-10 UR A.7 登入方案決策（Google only）

## 情境 / 用户指示
- 拍照上傳需身份（簽名 URL 綁人、RLS、防刷），現狀全站匿名裸奔。
- 用户推翻架構 §10 Q1「匿名設備號先行」，改要 Google＋Email；經思考摘要＋兩問，
  最終拍板：**只要 Google 授權登入**（Google 帳號＝email，OTP/密碼全不要）。

## 決策
- 路徑：Supabase Auth 原生 Google OAuth（PKCE），Web `@supabase/ssr` httpOnly cookie；
  否決自建（密碼學負資產）與匿名先行（認領合併大坑）。
- 範圍 UR A.7：`/login` 頁＋Google 鈕、`/auth/callback` code 換 session、
  users 自動建行 trigger、新舊 middleware 並存、登出、RLS owner 檔（users 自讀寫；
  checkins 在 public 讀之外加 owner 全權；post_likes/reports 同理後續端點按需）。
- Non-goal：Email OTP（不要了）、本地 localStorage 數據合併（不進庫）、刪號
  （Apple 審核才要，原生階段再做，註記）、原生 SDK 接入（架構兼容，後續 UR）。
- 待回寫：`docs/api-architecture.md` §10 Q1（匿名→Google，附原因）＋backlog UR A.7。

## 用户側配置（驗收前置，實現不依賴，先給）
1. Google Cloud Console 建 OAuth 2.0 Client（Web 應用）：Authorized redirect URIs 加
   `https://<supabase-ref>.supabase.co/auth/v1/callback`（本地測加 `http://localhost:3000/auth/callback`？不——回調走 Supabase 端，只需加 Supabase callback；本站 `/auth/callback` 是站內路由）。
   拿 Client ID＋Secret。
2. Supabase Dashboard → Authentication → Providers → 開 Google，填上兩值；
   URL Configuration → Site URL 填生產域名，Redirect URLs 加 `http://localhost:3000/**`＋生產域名。
