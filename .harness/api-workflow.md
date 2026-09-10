# API Workflow — API 開發七步流程（UR A.3 硬規則）

> Claude Code 與 Muse Code 共用同一份（`.harness/` 是跨工具共享規範，
> 不需同步副本；兩工具的操作差異見 `AGENTS.md` 工具對應表）。
> 每個 API 從第 1 步走到第 7 步，一次一個端點，不打包。
> 「做完」定義：用戶親驗通過（curl／頁面）＋三閘全綠＋文檔回寫。

## 第 1 步 · 分析前端頁面的數據需求

- 列出該 API 服務的 UI 面（具名 route／component）。
- 逐字段過堂：每個欄位回答「前端哪裡讀／寫它」（指到 lib type 或
  `docs/data/*` 行）。答不出的不建，缺的補上才准往下。
-  artifacts：過堂結論寫進 backlog 改動記錄（一行）。

## 第 2 步 · 設計數據庫

- 表／列／enum／索引／FK，沿 `docs/data/future-schema.md`（有出入先改草圖）。
- 定 visibility 預設、RLS 檔位、私有列清單（沿 `api-architecture.md` §7）。
- seed 誠實：只放真實靜態數據；假用戶／假互動不進庫。

## 第 3 步 · 構建數據庫表

- 寫 `supabase/migrations/NNNN_*.sql`（RLS 全 ENABLE、policy 另批，空窗安全）。
- **執行是用戶動作**（Dashboard SQL Editor）：agent 只給「貼哪段、先後順序、
  成功長什麼樣」。用戶貼回結果（Success／報錯）才算完。
- 驗：Table Editor 見表＋行數對。

## 第 4 步 · 設計 API 功能和安全性

- 契約先行（寫出來再寫碼）：方法＋路徑＋認證（🌐／🔒）＋入參（zod 形狀）＋
  出參＋錯誤碼＋限流＋冪等（寫操作）。
- RLS policy SQL 與契約同批給（一個洞一個 policy，不多開）。
- artifacts：契約寫進 `docs/api-a2-todo.md` 對應行（或當輪設計小節）。

## 第 5 步 · 構建 API 合約（api spec）

- 實現前把契約落成機器可讀：`docs/api-openapi.yaml` 加路徑條目
  （request／response schema＋auth＋錯誤包絡）。
- yaml 即測試夾具：三端聯調以它為準，改契約先改 yaml。

## 第 6 步 · 開發 API

- route＋mapper（純函數）＋單測（壞行／空表／包絡），沿 `lib/api/*` 既有形狀。
- route 不吞錯：DB 錯 `console.error(code/message/details/hint)`＋500 包絡
  （PGRST205 排障梯子見 memory：service_role 同查→同錯＝表不存在；
  401＝key 錯 project；anon 空＋service 有數＝policy 沒開）。
- 三閘：`tsc`＋`npm test`＋`npm run lint`（build 照例 sandbox 攔，留用戶側）。

## 第 7 步 · 交給用戶驗收

- 給用戶三樣：跑什麼（curl／頁面路徑）、看到什麼算過、壞了貼什麼回來
  （terminal 行／SQL Editor 報錯／截圖）。
- 用戶說過才打勾（to-do ✅＋backlog 改動記錄）；不過→回第 4 步，不跳步。
- 未經用戶明確「提交」不 commit／push（沿 workflow Step 10）。
