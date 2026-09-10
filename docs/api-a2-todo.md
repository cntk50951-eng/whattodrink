# A.2 API 開發 To-do List（EPIC 2 施工清單）

> 來源：`docs/api-architecture.md` §3／§9。順序原則：地基 → 公開讀 →
> 登入寫 → 收尾；每換一個 mock，`docs/data/*` 對應行＋單測一起走。
> 格式：`- [ ]` 未做／`- [x]` 完成。先做 P0，不跳序。

## P0 地基（不做，後面全是空話）

- [x] A.2-0 Supabase 建 project（區域 ap-southeast-1 新加坡）＋三組 key 進 Vercel env
  - 功能：DB／Auth／Storage／Realtime 總開關。驗收：Dashboard 連通，`NEXT_PUBLIC_*` 可讀。（2026-09-09 用戶本地 health `configured:true` 閉環）
- [ ] A.2-1 migrations 落表（`supabase/migrations/*.sql`，沿 `future-schema.md`）
  - 功能：`users／beers／checkins（含 type＋visibility）／cheers／mood_logs／drink_invites／post_likes／post_reports／devices` 九表一次建好。驗收：migration 可重放，seed 15 條 beers。（SQL 已寫好待執行；牆種子故意不進庫——假用戶數據不污染真表，決定見 migration 註記）
- [ ] A.2-2 RLS 全表 deny-by-default＋三檔 policy（§7 矩陣逐表寫 Rob policy 測試）
  - 功能：anon 只讀公開行列／owner 寫刪自己／檢舉審核列。驗收：拿 anon key 打私有行全 403／404。
- [ ] A.2-3 Storage buckets：`checkin-photos`（公開讀 10MB）＋`voice-clips`（私有 2MB）
  - 功能：上傳目的地就緒。驗收：簽名上傳→讀取鏈走通。
- [ ] A.2-4 Handler 腳手架（`lib/api/*`）：錯誤包絡＋zod 校驗 helper＋auth 取 session helper＋`docs/api-openapi.yaml` 骨架
  - 功能：後面 16 條端點共用同一寫法。驗收：`/api/v1/health` 回 `{ok:true}`，401／400 包絡長一樣。

## P1 公開讀（免登入，驗收＝匿名 curl 全通）

| # | 端點 | 實現功能 | 替掉的 mock | 驗收 |
|---|---|---|---|---|
| A.4-1 | `GET /api/v1/beers` | 酒目錄 15 條（類別／emoji／tagline） | `lib/beers.ts` | 條數＝15，欄位齊 | ✅ 2026-09-09（匿名讀 15 行＋匿名寫 401＋用戶 curl 通） |
| A.4-2 | `GET /api/v1/wall?sort&cursor` | 公開牆（只回 `visibility=public` 行＋公開列） | `lib/posts.ts` 種子＋`sortHot` | cursor 翻頁無重無漏，非 public 行不出 |
| A.4-3 | `GET /api/v1/map/pins?bbox` | 他人 pin（座標服務端模糊到街區） | `lib/checkins.ts` MOCK | 回的座標精度≤街區，無精確 lat／lng |
| A.4-4 | `GET /api/v1/bars/nearby?lat&lng` | 附近酒吧（Places 服務端代理＋60 RPM 限流） | `lib/nearby.ts` | key 不出前端，超限 429 |
| A.4-5 | `GET /api/v1/mood/recommendations` | 心情推薦讀（Claude 代理＋同輸入緩存） | mood stub | 相同輸入命中緩存不重調 |

## P2 登入寫（驗收＝無 token 401＋越權 403／404＋happy path）

| # | 端點 | 實現功能 | 替掉的 mock | 驗收 |
|---|---|---|---|---|
| A.4-6 | `GET/PATCH /api/v1/me` | 讀寫自己暱稱／頭像／性別 | `lib/me.ts` | 只能讀寫自己 |
| A.4-7 | `POST /api/v1/checkins` | 發帖三流歸一（want 預設 private，share 才 public；照片／語音走簽名 URL，不再收 dataURL） | `wantRecord`＋`saveMyPosts` | want 行不上牆；空包拒收（沿 v6 口徑） |
| A.4-8 | `DELETE /api/v1/checkins/:id` | 自刪自己帖（牆即時消失） | `deleteMyPost` | 刪別人帖 403／404 |
| A.4-9 | `POST /api/v1/wall/:id/likes` | 讚 toggle（冪等鍵＋唯一鍵防重） | `toggleLike`＋overrides | 重放同鍵不 double 計數 |
| A.4-10 | `POST /api/v1/wall/:id/reports` | 檢舉（1 次只對自己藏，3 不重複 user 全局藏） | `reported` 覆寫 | 第 3 個不重複檢舉後 anon 讀不到 |
| A.4-11 | `POST /api/v1/cheers` | 乾杯（日額度服務端算，不再信前端） | `wtd-cheers-daily` | 超額 429，前端 key 可偽造也沒用 |
| A.4-12 | `POST /api/v1/invites` | 找人喝酒邀請＋Realtime 推被邀人 | 未接線 | 被邀人即時收到 |
| A.4-13 | `POST /api/v1/mood/logs` | 心情輸入流 | stub | 寫入＋本人可查 |
| A.4-14 | `POST /api/v1/uploads/sign` | 簽名上傳 URL（照片／語音分 bucket，語音按情境秒數驗收：乾杯 15s／心情 60s） | dataURL 直存 | 簽名 60s 過期，超限 400 |
| A.4-15 | `POST /api/v1/devices` | 推送 token 登記（web／APNs／FCM 同表） | 無 | 三 platform 各一條通路冒煙 |

## P3 收尾（全綠才算 EPIC 2 完工）

- [ ] A.4-16 `POST /api/v1/transcribe` 版本化（舊 `/api/transcribe` 302 半年，Node runtime＋按 user 限流）
- [ ] A.4-17 全域限流（public 讀 60 RPM 起，寫按 user 限）
- [ ] A.4-18 Vercel Cron：清過期簽名＋凍結多檢舉帖（半自動，人工確認在 Dashboard）
- [ ] A.4-19 離線 outbox：發帖／讚／乾杯斷網寫本地，恢復按 `Idempotency-Key` 重放（mock 層轉正）
- [ ] A.4-20 境外揭露文案進同意流程（§7 合規項，併 A.3 Auth UI）
- [ ] A.4-21 OpenAPI yaml 補全 16＋6 條＋雙通道冒煙（web cookie＋curl Bearer）

## 不做（本輪明確排除）

- 原生殼（Capacitor／PWA 選型等 A.4 走完，見 §9.5）
- 審核隊列（EPIC 3.0）、推薦算法（EPIC 4.0）、自建認證（永不）
