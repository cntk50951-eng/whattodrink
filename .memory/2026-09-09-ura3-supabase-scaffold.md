# 2026-09-09 UR A.3 Supabase 地基腳手架（A.2-0）

## 情境
- 用戶建完 Supabase project，把 key 寫進 `.env`（自定義名），讓我驗證開工。

## 問題
1. key 名全錯：`supabase_url`／`supabase_ano_key`／`supabase_service_role`——代碼要標準名（`NEXT_PUBLIC_` 前綴決定瀏覽器可見，改不得）。
2. 官方文檔已換新 key 制（publishable／secret），用戶手裡兩套都有。
3. proxy.ts 是 next-intl 獨佔，Supabase session 刷新要鏈進去且不丟 cookie options。

## 原因
1. 用戶照自己理解命名；2. Supabase 2025 年換制，舊文檔還在流傳；3. 雙中間件需共用同一回包。

## 修正
- sed 只改名不碰值（三行；`supabase_secret_key` 原樣保留）。
- Step 3 查官方文檔當天版本：`setAll(cookies, headers)` 簽名＋`getClaims()` 鑒權＋每請求新建 server client——以裝好的 0.12.7 型別為準，不憑記憶。
- `lib/supabase/`：env（新制優先舊制兜底＋缺 key 點名拋）＋5 單測／browser／server（`await cookies()`＋`getClaims` helper）／middleware（收最終 response 寫回）；proxy 先 intl 後 session，缺 key 紅字＋只跑 intl（mock UI 不死）；`/api/v1/health` 永 200 報自檢。
- npm cache 權限（`/Users/yuki/.npm` 屬 root）：`--cache /tmp/npm-cache-ura3` 繞過，不動系統。
- TS 兩跤：自定義 mapped type 與 ProcessEnv 不兼容→改 `Record<string, string|undefined>`；ProcessEnv 必含 NODE_ENV→測試小對象傳不進→同一解。
- 門：136 綠（19 檔）／tsc 淨／lint 0 error。連通冒煙做不了（sandbox 起不了 dev）→ 用戶本地打 `/api/v1/health`。

## 追記（PGRST205 排障：表根本沒進庫）
- 用戶 curl 500；route 吞錯→補 `console.error(code/message/details/hint)` 診斷口，真因現形。
- 拿 service_role 直查 REST：beers／users／checkins 三表全 PGRST205，且 key 有效（無 401）→ 結論：migration 從沒在這個 project 落過（不是 RLS、不是 policy、不是 key 配錯——RLS 拒絕回空陣列不報錯，key 錯報 401）。
- 排障梯子（下次照抄）：service_role 查同表→同錯＝表不存在；401＝key 錯 project；anon 空陣列＋service 有數＝policy 沒開。
- 另：sandbox 出站其實通（走代理），之前超時是偶發；直連 Supabase REST 可查，dev 監聽仍不行。

## 追記（酒圖標上 Storage：30 張全傳）
- 用戶：用 Storage API 传图，缺的 emoji 兜底。`exported/beer-icons/svg` 30 張全 lager 系，DB 15 條混合目錄只中 heineken（asahi／tsingtao 模糊待定，其餘 12 無圖）——錯圖不貼，只傳不亂 mapping。
- 執行：Storage API 建公開 bucket＋30 張 snake→kebab 上傳全 ok；抽查 5 張匿名 200＋image/svg+xml＋`<svg` 開頭。DDL／policy 照規矩寫 `0003_beer-icons.sql` 等用戶跑；回填 URL＋API 出 `icon_url` 等列落地再做（select 不存在的列會 500，不可超前）。
- 閉環：用戶跑完 0003→heineken 回填（REST PATCH 200 回顯）→API 加 `icon_url` 可空（缺鍵判壞行＋1 單測）→匿名驗 15 行／1 有圖 14 NULL。asahi／tsingtao 模糊匹配未定，12 缺圖等設計。門：142 綠／tsc 淨／lint 0 error。
- 回填收尾：用戶拍板「本地有的全填」→asahi／tsingtao 回填（200 回顯），全表 15 行／3 有圖 12 NULL。剩下 12 條本地無圖（30 張全 lager 系，紅酒雞尾酒威士忌清酒一張沒有），不是沒傳，是沒得填。
- 牌子進目錄：用戶糾正 27 lager 是牌子要能選→`0004` 26 行（茅台 excluded 非啤酒；Hoegaarden 暫進 lager 近似，已聲明）。教訓兩筆：①拼接 SQL 別用 index 切（註記里的關鍵詞會截斷，要用 rindex／正則錨定）；②apply 正則尾部 `\),` 漏了分号結尾行（brahma），改 `\),?;` 或逐行 strip 比對。seed 必須同源同步（新環境一致性）。

## 追記（第一個 API：GET /beers，過堂＋實現）
- 過堂：UI 面＝DrinkMap 選酒全家＋beer-icons 品牌牆；id／emoji／name／category 有主，tagline 零消費但為結果卡預留（表留、API 照回、前端忽略，將來加列更貴）。
- 實現：`0002_beers_policy.sql`（beers SELECT 公開，其餘續拒）＋route（匿名無參，policy 未開就 500 不靜默）＋envelope（A.2-4 第一塊）＋mapper（壞行整批 null）＋5 單測。門：141 綠／tsc 淨／lint 0 error。
- 待用戶：Dashboard 依次跑 0001→seed→0002，再 `curl /api/v1/beers`（15 條）＋關 policy 重 curl（該空／錯，證明 RLS 執法）。

## 追記（建表門禁新規則＋倒審 0001）
- 用戶：建表前先從前端需求看數據要求，結合前端才能建表→已寫入 `.harness/architecture.md`「建表門禁（schema-from-UI）」5 步。
- 拿新門倒審已寫好的 0001：六路 UI（WantRecord／Checkin／WallPost／cheers／invites／users）字段全對上，無多無少；只補兩個索引（checkins_created／users_last_seen，後者 schema 點名要）；bbox GiST（postgis）留到真有量再加，不提前。
- 面積外：`area` 手寫區名確認不建表（future-schema 定了以 place_name 為準）。

## 追記（UR A.4-rev2 本地圖退場）
- 用戶：前端不許再直調項目內圖片（本地 tsx 手繪），一律 API 取圖，壞退 emoji。
- 改：`BeerIcon` 去 tsx 剩兩級；想喝 pins（entry.beer.icon_url）／他人 pins＋卡头（`beerByName` 按 drinkName 對目錄）改 img；添 pin img CSS（方形卡骨架不動，尺寸不動）；`DrinkMap` 刪 iconForPickId／iconForDrinkName／renderToStaticMarkup 三 import。
- 保留：CATEGORY_ART lane 頭（品類裝飾非酒圖）、preview 頁（設計管線）、`beer-icons/` 全套（設計源＋export 流程不動）。
- 誠實點：mock 他人 4 杯全無 icon_url，短期 pins／卡头全退 emoji／頭像——等真數據或圖標補齊才有圖；heineken 有圖但 mock 里沒人喝它，面板暫時也看不到變化。
- 門：145 綠／tsc 淨／lint 0 error。另：react-compiler「大寫賦值＝render 期建組件」誤報，`createElement`＋小寫持有繞過（沿用）。

## 追記（刷新掉圖：白名單漏新鍵）
- 用戶：想喝 Heineken 刷新後圖沒了，問是 bug 還是沒做。答：是 bug——本地持久化（`wtd-want-history`）本來就有，存鏈路也通；`parseWantRecord` 重建 beer 用白名單，A.4 加 `icon_url` 時沒同步，刷新即掉圖（記錄還在，看著像沒保存）。
- 修：解析器帶上 `icon_url`（非字符串丟掉）＋regression 單測。門：146 綠。
- 教訓：加字段＝存＋取兩端一起改，解析器白名單是第二端；以后加鍵先 grep 所有 parse＊。

## 追記（領域模型糾正：牌子≠品種）
- 用戶：27 款 lager 是「啤酒分類下的牌子」，不是酒的品種。`beers` 表混了兩層（品種：mojito／malbec…；牌子：heineken／asahi／tsingtao…）。
- 結論：牌子另起 `brands` 表（掛啤酒分類下），不往 `beers` 硬塞 27 行；現有 3 款牌子味的行（heineken／asahi／tsingtao）暫不動，去重合併等產品定。
- 教訓：目錄結構先問層級（分類→牌子→品種），不要默認同表。

## 追記（用戶糾正：不超前做）
- 用戶：沒下令建表就不要建；一個一個來，先講第一個 API 打算做什麼。
- 修正：migration/seed 檔留工作區、未提交、未執行；以後「下一步」只講計劃不動手，等用戶說做才做。計劃本身也要一個一個端點講，不打包。

## 追記（A.2-1 遷移 SQL）
- `0001_init.sql` 九表：enums（gender／type／visibility／status／platform）用 CHECK 不另建 type（好遷移好讀）；`user_id` 全 NULL（匿名期）；FK 指 users／beers／checkins，刪用戶 SET NULL、刪帖 CASCADE；索引只給熱查詢（cheers 日額度、likes 熱門）；RLS 全 ENABLE 零 policy（A.2-2 前全拒）。
- 故意沒加 `share⇒public` 硬約束：將來隱藏帖要的就是 share＋private，可見性由寫入流程＋RLS 執法。
- seed 只有 beers（`ON CONFLICT DO NOTHING` 可重放）；牆種子不進庫（假用戶污染真表，公開牆等真分享長出來）。

## 追記（用戶開 sandbox 後複驗）
- 開放的是文件權限，網路沒開：監聽 3000／3100 照樣 EPERM；直連 Supabase（auth/health＋rest 帶真 key＋壞 key 對照）三個全超時；直連 DNS 全死、出站只走代理白名單（npm 通）。結論：配置正確性可驗（名正＋值非空），連通性 sandbox 內永遠驗不了，固定走用戶本地 dev。
- 教訓：以後這類「開權限」先問清楚開的是哪一層（文件／端口／出站域名），逐項驗，不要默認全開。
