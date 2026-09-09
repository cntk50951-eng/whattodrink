# UR A.1 API 架構設計（EPIC 2）

> 狀態：設計稿（未實現）。關聯：`docs/PRODUCT_BACKLOG.md` UR A.1、
> `docs/data/future-schema.md`（表草圖）、`.env.example`（key 佔位）、
> `.harness/architecture.md`（Supabase 託管路線 A＋Vercel 已定）。
> 回答 UR 原文 5 問：①②見 §3 端點清單（Public／Auth 列）；
> ③見 §4（Supabase Auth JWT＋雙通道）；
> ④見 §5（Next Route Handlers 單體，升級線已留）；
> ⑤見 §6（同一 REST＋OpenAPI 契約三端共用）。
> 分析師 review（2026-09-09）已合併：checkins 行級可見性（§7）、
> 檢舉 1／3 門檻（§3／§7）、境外揭露接 UI（§7）、語音上限分層（§6）、
> §10 五問＋三加題全定案。

## 1. 目標與非目標

- 目標：public／登入兩類流量的劃界、認證標準做法、三端兼容契約、
  Vercel 可部署形態、以及 mock→DB 的替換路徑（§8）。
- 非目標：本稿不建表（表見 future-schema，UI-first 原則不變）、
  不寫任何 endpoint 實現、不選原生殼方案（只在 §10 留選項）。

## 2. 總覽

```
Web（Next.js）   iOS（SwiftUI）   AOS（Compose）
      │                │               │
      └────── HTTPS + JSON（同一 /api/v1） ──────┘
                         │
              Vercel · Next.js 16（本 repo）
              ├─ RSC pages（SEO／靜態）
              └─ /api/v1/* Route Handlers（Node／Edge，見 §5）
                    │            │             │
              Supabase Postgres  Supabase Auth  Supabase Storage
              （RLS 強制隔离）   （JWT 簽發）    （signed URL 直傳）
                    │
        Server-only 代理：iFlytek／Claude／Google Places
        （key 永不出前端，沿用 /api/transcribe 配方）
```

- 後端＝本 repo 的一部分，不另起服務（理由見 §5）。
- Supabase project 區域：新加坡（沿 `.env.example` 註記，離港最近）。

## 3. 端點清單 v1（回答 Q1＋Q2）

認證列：🌐 public（anon key＋RLS 只讀）／🔒 登入後（user JWT＋RLS）。
「現 mock」列是今天要替掉的東西，替換順序見 §9。

### 3.1 Public（免登入可請求）

| 方法＋路徑 | 讀什麼 | 現 mock | DB／來源 |
|---|---|---|---|
| `GET /api/v1/beers` | 酒目錄 15 條 | `lib/beers.ts` 靜態 | `beers` 表（靜態直遷） |
| `GET /api/v1/bars/nearby?lat&lng` | 附近酒吧 | `lib/nearby.ts`＋MOCK | Google Places 服務端代理（key 不落地前端） |
| `GET /api/v1/wall?sort=hot\|latest&cursor` | 公開牆 | `lib/posts.ts` 種子 | `checkins`（僅公開欄位，見 §7） |
| `GET /api/v1/map/pins?bbox` | 他人 pin（模糊） | `lib/checkins.ts` MOCK | `checkins`（座標模糊到街區級，見 §7） |
| `GET /api/v1/mood/recommendations` | 心情推薦讀 | stub | Claude 服務端代理（可緩存， QS 相同輸入限流） |

### 3.2 登入後（缺／壞 token 一律 401 `{error:{code:"unauthorized"}}`）

| 方法＋路徑 | 寫什麼 | 現 mock | DB／來源 |
|---|---|---|---|
| `GET/PATCH /api/v1/me` | 暱稱／頭像／性別 | `lib/me.ts`（MOCK_ME） | `users`（行級：只讀寫自己） |
| `POST /api/v1/checkins` | 想喝／拍照／心情三流歸一 | `wantRecord`＋`saveMyPosts` | `checkins`（照片／音頻先走 §6 上傳） |
| `DELETE /api/v1/checkins/:id` | 自刪（牆詳情自刪按鈕） | `deleteMyPost` | `checkins`（只刪自己；公開牆即時消失） |
| `POST /api/v1/wall/:id/likes` | 讚（toggle 語義，冪等） | `toggleLike`＋overrides | `post_likes`（唯一鍵防重，計數實時 `count`） |
| `POST /api/v1/wall/:id/reports` | 檢舉（1 次只對檢舉人藏，3 個不重複 user 才全局藏） | `reported` 覆寫 | `post_reports`（多檢升級走 EPIC 3.0 審核隊列） |
| `POST /api/v1/cheers` | 乾杯 | `wtd-cheers-daily` | `cheers`（日額度服務端算，不再信前端） |
| `POST /api/v1/invites` | 找人喝酒邀請 | `drink_invites` 未接線 | `drink_invites`＋Realtime 推被邀人 |
| `POST /api/v1/mood/logs` | 心情輸入流 | stub | `mood_logs` |
| `POST /api/v1/transcribe` | 語音轉文字（現有路由版本化） | `/api/transcribe`＋iFlytek | 同今（Node runtime，配額按 user 限流） |
| `POST /api/v1/uploads/sign` | 拿簽名上傳 URL | dataURL 直存 localStorage | Storage 簽名（§6；照片 ≤10MB，語音沿 400KB 口徑放寬到 2MB） |
| `POST /api/v1/devices` | 推送 token 登記 | 無 | `devices`（web push／APNs／FCM 三端同表，見 §6） |

## 4. 認證：public 怎麼做、登入怎麼做（回答 Q3）

- 標準答案就是 **JWT**，但不自簽——用 **Supabase Auth** 簽發＋驗證：
  access token（短命 1h）＋refresh token 輪換，符合 RFC 8725／OAuth2 慣例，
  業界（Firebase／Auth0／Clerk）同構，只是換成已定的 Supabase 路線。
- 雙通道（同一 JWT，兩種攜帶）：
  - Web：`@supabase/ssr`，access／refresh 放 httpOnly cookie，
    Server Component 直接讀 session；middleware 刷新過期 token。
  - iOS／AOS：`Authorization: Bearer <access>`，refresh 存
    Keychain／EncryptedSharedPreferences；401 即 refresh 重試一次。
- 第二道鎖 **RLS**：`deny-by-default`，每表按（anon／authenticated／owner）
  三檔寫 policy（匿名只能讀公開列，登入只能寫自己的行，見 §7）。
  即使 anon key 洩漏（它是設計可曝光的），也拿不到非公開數據。
- `service_role` 只活在 Route Handler／transcribe 這類服務端，
  永不進前端、不進 repo（沿 `.env` 鐵律）。
- 自簽 JWT／自建 session 表：否決——密碼學運維（輪換、洩漏、撤銷）是
  負資產，v1 團隊規模不該碰；等要離開 Supabase 那天再談。

## 5. 框架與架構（回答 Q4）

- **v1＝Next.js Route Handlers 單體**（本 repo `/api/v1/*`），不上新框架：
  同語言同 repo、Vercel 原生（Edge 跑讀、Node 跑轉碼／加解密）、
  RSC pages＋API 同構部署，一次 `git push` 全上。
- 升級線（出現任一即拆）：團隊要前後端分工／需要長連接或隊列／
  要離開 Vercel——屆時把 handlers 原樣搬進 Hono（同 TypeScript，
  測不動），契約（§6）不變，前端零改。
- 橫切約定：版本前綴 `/api/v1`（破壞性變更才升 v2，老版並行 6 個月）；
  入參 **zod** 校驗（all 400 `{error:{code:"invalid_params"}}` 同一包絡）；
  列表一律 cursor 分頁（`?cursor&limit`，不用 offset——牆會一直插新帖）；
  讚／乾杯／發帖帶 `Idempotency-Key`（弱網重試不 double 計數）；
  runtime 表：讀預設 Edge，`transcribe`／簽名／加解密鎖 `nodejs`。

## 6. 三端兼容（回答 Q5：web＋iOS＋AOS 同一契約）

- 同一 REST＋JSON，同一 OpenAPI（`docs/api-openapi.yaml`，A.2 建表時順手生成，
  當三端聯調的唯一真源；改契約先改 yaml，再改實現——yaml 即測試夾具）。
- 認證雙通道見 §4；語言走 `Accept-Language`（沿 next-intl 三語，
  服務端錯誤文案也三語，code 穩定、message 可換）。
- 上傳三端一致：先 `POST /uploads/sign` 拿限時簽名 URL →
  直傳 Supabase Storage（照片 bucket 公開讀、語音 bucket 私有＋播時簽名）。
  今天 dataURL 塞 localStorage 的做法只留作**離線草稿**（見下）。
- 語音上限不在 bucket 層一刀切：bucket 只設寬上限（2MB），
  各自 endpoint 驗證層按情境收（乾杯介紹 15s／心情描述 60s，沿 UR3.4 口徑）。
- 推送三端同表：`devices(platform, push_token)`，web 走 Web Push，
  iOS／AOS 走 APNs／FCM——服務端只認表，不認端。
- 離線策略（今天 localStorage 配方的去處）：不斷網即直調 API；
  發帖／讚／乾杯先寫本地 outbox（沿用現 `wtd-*` 結構），恢復連線按
  `Idempotency-Key` 重放——今天的 mock 層直接轉正為離線緩存層，不刪除。

## 7. DB 集成（行級：表×誰×能幹嘛）

- 表沿 `future-schema.md`（`users／beers／checkins／cheers／mood_logs／
  drink_invites／post_likes／post_reports`＋新增 `devices`），
  migrations 走 Supabase CLI（`supabase/migrations/*.sql`，A.2 建）。
- RLS 矩陣（deny-by-default，每表三檔）：
  - `beers`：anon＋auth 可讀，不可寫（寫走後台／seed）。
  - `checkins`：**行級可見性優先於欄位級**（分析師缺口，A.2 建表前定案）——
    新增 `type`（`want`／`share`／`mood`）＋`visibility`
    （`private`／`public`，預設 `private`）；只有走分享流程的 `share`
    行才是 `public`，隨手「想喝」永遠不出現在公開牆（PDPO 收集目的原則：
    足跡目的收的資料不轉作展示用途）。
    `GET wall`／`map/pins` 硬過濾 `visibility='public'`；anon 對非 public
    行整行不可見（不是欄位遮罩）。欄位級照舊：公開行內精確座標／audio／
    transcript 仍僅 owner 可讀，他人只見 photo／note／nickname／模糊座標。
    寫／刪僅 owner；檢舉：1 次只對檢舉人藏（客戶端記我檢舉過），
    3 個不重複 user 才全局藏＋cron 凍結（防惡意檢舉）。
  - `post_likes／cheers`：讀公開計數，寫僅本人（唯一鍵防重）。
  - `post_reports／mood_logs／invites／devices`：僅相關人可讀寫，
    anon 全拒。
- 公開隱私線：他人 pin 座標模糊到街區級（服務端砍精度，不靠前端藏）；
  list 接口永遠不回精確 lat／lng、email、push token。
- 境外傳輸揭露（backlog 第 3 節合規要求，接回 UI）：sin1＝境外，
  「資料可能傳輸至境外處理」的揭露＋同意必須出現在使用者流程裡
  （併入 UR2.0 年齡閘門或首次使用同意提示，A.3 Auth UI 時一起做），
  不能只躺在架構文檔。
- Realtime（先只開兩條，別全開）：`invites`（被邀即時到）＋
  `cheers`（被乾杯即時飄）。牆讚數用下拉刷新／回焦重讀（沿今天口徑），
  不值得為計數開 socket。
- Storage：`checkin-photos`（公開讀，≤10MB，圖片類型白名單）、
  `voice-clips`（私有，≤2MB，播時 60s 簽名 URL）。

## 8. Vercel 部署形態

- 同一 project：`main`→production，`feat/*`→preview（聯調和今天一樣看 URL）。
- Env：`NEXT_PUBLIC_SUPABASE_URL／ANON`（可曝光）進 Edge，
  `SUPABASE_SERVICE_ROLE_KEY／IFLYTEK_*／ANTHROPIC_*／PLACES_*` 只進
  Node functions（沿 `.env.example` 分組，Vercel Dashboard 按組填）。
- Region：`sin1`（新加坡，離港最低延遲）；transcribe 等重路由可另標。
- Cron（Vercel Cron，先留一個）：每日清過期簽名／凍結被多檢舉帖
  （V1 先人手＋cron 半自動，審核隊列是 EPIC 3.0 的事）。

## 9. 演進路線（A.2 起的施工順序）

1. A.2：Supabase 建 project＋migrations＋RLS＋Storage buckets（只建，不接線）。
2. A.3：Auth 接線（登入 UI＋middleware＋雙通道冒煙：web cookie／curl Bearer）。
3. A.4 起逐個替 mock（每換一個，`docs/data/*` 對應行＋單測一起走）：
   `beers`讀 → `wall`讀 → `likes` → `checkins`發表／自刪 → `cheers` →
   `transcribe` 版本化（`/api/transcribe`→`/api/v1/transcribe`，舊路徑 302 半年）。
4. 替換對照（今天 localStorage key 的去處）：
   `wtd-wall-my-posts`→`POST checkins`＋`GET wall`；
   `wtd-wall-overrides`→`post_likes／post_reports`；
   `want*`→`POST checkins(type=want)`；`wtd-cheers-daily`→`cheers`（額度服務端算）；
   同意／已讀／引導 flags（consent／seen／guide）**永久留本地**——端上狀態不進庫。
5. 原生殼（只留選項不選型）：Capacitor／Tauri／純 PWA 三選一，
   等 web 端 API 穩定（A.4 走完）再議——今天的契約設計已保證到時前端零改。

## 10. 未決→已決（分析師 review 2026-09-09，全接受）

1. 登入方式：**匿名設備號先行**（分析師同意；零門檻哲學＋合併大坑早定早好）。
2. 語音保留期：**90 天自動清**，轉錄文字永久留（符合 PDPO 最小化）。
3. 匿名期數據：**登入後認領**，靠 `devices` 綁定。
4. 限流額度：**先 60 RPM**，上線看流量調。
5. Realtime：**維持兩條**，牆不加即時推播（回焦重讀夠用）。
6. 檢舉門檻（分析師加題）：**1 次只對檢舉人藏，3 不重複 user 全局藏**——已寫入 §3／§7。
7. 境外揭露接 UI（分析師加題）：併入年齡閘門／首次同意，A.3 做——已寫入 §7。
8. 語音上限分層（分析師提醒）：bucket 只設寬限，各 endpoint 按情境收——已寫入 §6。

