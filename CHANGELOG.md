# Changelog

所有重要修改會記錄在這個檔案。格式借鑑 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/)。

## [Unreleased]

### Added
- **UR 1.1 — 首頁互動式頁面重構（WIP，待用戶側 build＋瀏覽器驗收）**
  - 新依賴：`leaflet@1.9.4`（真實地理底圖＋免費 CARTO Voyager 瓦片，免 key）、`vitest@^3`（`@types/node@20` 與 vitest 5 互斥，只能用 v3）＋ `npm test` 腳本
  - `components/map/DrinkMap.tsx` — 地圖＋推薦入口同一組件：geolocation 狀態機、拒絕／失敗→全港視圖、塗鴉 pins（自己／MOCK 他人／「想喝」虛線圈）、自訂縮放＋睇全港按鈕、乾杯卡（本地 mock）、`prefers-reduced-motion` 降級
  - `lib/geo.ts`（全港 bounds＋`isWithinHongKong`）、`lib/checkins.ts`（MOCK 種子，處處標 MOCK）、`hooks/useGeolocation.ts`（idle→locating→success/denied/unavailable/timeout/unsupported）
  - `lib/geo.test.ts`＋`lib/checkins.test.ts` — 8 tests 全綠；`tsc` 全過；lint 無新增 error（僅剩 theme-provider 舊 error）
  - 首頁重排：`Hero variant="slim"`（標題保留，啤酒杯抽成 `BeerMugDoodle` 供地圖角落復用）→ `DrinkMapSection` 置頂主角 → Bento 後移；三語 `map` 文案
  - 選型結論：Remotion 是視頻渲染框架，不做即時互動地圖——只借其設計語言（粗描邊／扁平色／貼紙感）用 CSS＋SVG 實現，未引入依賴（見 memory）
  - 待用戶側跑 `npm run build`＋瀏覽器驗收（sandbox 內 Turbopack／dev server 起不來）：定位允許／拒絕、縮放至全港、隨機推薦→「想喝」落點、乾杯卡三條路徑
  - fix（用戶驗收發現）：React 覆蓋層缺 z-index 被 Leaflet panes（200–700）壓住導致「入口按鈕消失」——`.above{z-index:1000}`；點自己 pin 無反應——改彈 self 卡（含推薦按鈕）；手繪增強：筆記本圓點紙紋、膠帶貼、指南針貼紙、LIVE 跳動點、pins 交錯傾斜（全走 token＋reduced-motion 降級）
  - fix（底圖換源）：CARTO 政策改為匿名瓦片打「API KEY REQUIRED」水印——主源換 Stadia Stamen Watercolor（`NEXT_PUBLIC_STADIA_KEY`，見 `.env.example`），無 key 時自動降級 Esri 淺灰（免 key），水彩原生只到 z16（`maxNativeZoom` 過縮）；attribution 依官方文檔更新
  - fix（底圖再換源，用戶決策）：免 key 優先——主源改 OSM 標準 raster（零註冊，彩色街道／水系／公園，attribution 合規，prototype 規模可用），Stadia 水彩降為休眠備選（builder＋attribution 保留）；手繪皮膚第一版盲調（暖 sepia＋高飽和＋紙紋，待親眼驗收再迭代）；Esri 備用移除
  - fix（定位失敗無入口，用戶回報）：定位失敗卡片加「重新定位」按鈕（接 hook 既有 retry）＋拒絕重開指引（Chrome／iPhone 路徑＋微信／IG 轉 Safari／Chrome 提示），三語；未提交，等驗收一併處理
  - fix（手機無彈框，用戶回報）：Permissions API 預檢（已拒絕直接進指引，不再靜默失敗；不支援的瀏覽器走原路徑）；指引擴到 unavailable（系統總開關步驟放第一位）；超時 10s→15s 照顧手機冷啟動；未提交
  - fix（權限指引卡，用戶回報）：定位失敗改底部指引卡——`lib/device.ts` 純函數 UA 辨平台／瀏覽器（Safari／Chrome iOS／Chrome Android／內置瀏覽器，單測覆蓋），步驟精確到瀏覽器（iOS Chrome 是「設定→Chrome→位置」，不是 Safari）；Android 附一鍵直達系統定位 intent，iOS 無網頁可達的設定 deep-link 只給手動步驟；卡片可關，關後剩小 pill 點即重試＋重開卡；未提交
- Muse Code harness 對應（與 Claude / opencode 同步）
  - `.agents/skills/` — `harness-workflow` / `code-review` / `github-api`（內容同 `.opencode/skills/`，查 API 改用 `web_search` + `web_fetch`）
  - `AGENTS.md` 新增 Muse 工具 / 插件對應段（Muse 讀本檔為專案規則；不另建 `.muse/settings.json`）
- Stitch MCP：key 存 `.env`（`STITCH_API_KEY`，gitignored），`.env.example` 加佔位；Muse 側配 `~/.config/muse/settings.json` → `mcp_servers.stitch`（streamable_http，見 `.memory/2026-09-04-stitch-mcp-setup.md`）
- **UR 1.5 — 首頁正式開發（doodle 單風格，WIP 未驗收）**
  - `lib/themes/presets/doodle.ts` — 07 POC 精確色票 token 化，註冊為預設（其他 preset 保留無入口）
  - `app/[locale]/layout.tsx` — 移除主題／語言切換器 UI（基建保留）；`components/marketing/hero.tsx` — 筆記本 hero＋程序化塗鴉杯（token 驅動）；標題字換 Caveat 手寫體（`<link>` 載入，見 memory）
  - 待用戶側跑 `npm run build`＋瀏覽器驗收（sandbox 內 Turbopack／dev server 起不來）
  - fix：`LOCKED_THEME_ID` 鎖死 doodle（殘留的 flat-illustration 深底曾劫持首頁）；次卡 teal／粉實底、全卡 2px 墨線、hero 補酒花麥穗氣泡（貼近 07 POC）
  - detail pass：hero 加膠帶、手寫旁注、星星愛心、杯上粉色 W·D 徽章、標題紅波浪線；三卡片加迷你塗鴉（瓶杯／手機／心形氣泡）
- **UR 2.1 — 拍照喚起與權限處理（WIP，待真機驗收）**
  - `components/camera/camera-flow.tsx` — 單屏 entry（用途＋PDPO 同意＋雙入口，一次點即同意，仍獨立於原生彈窗）；拒絕→重試＋上傳，永久封鎖→設定指引，無相機→直接上傳；拍攝止於縮圖＋重拍（後續屬 UR2.2）
  - `lib/camera.ts` — 純函數錯誤分類＋能力偵測（待 vitest 落地補 test）
  - 待用戶真機驗收（sandbox 無相機）：允許／拒絕／封鎖／上傳四條路徑
- **UR 2.2 — 拍照後輸入補充（WIP，待真機＋咪驗收）**
  - `CameraFlow` 加 `review` 階段（同頁延續，免跨路由傳圖）：大預覽＋重拍／換源、選填文字（500 字＋計數）、`VoiceRecorder`（錄音鍵＋計時＋60 秒自動停＋回放重錄，轉文字留 UR2.3）、可空送出→收到確認＋再來一張
  - 無障礙：錄音中文字＋跳動點＋aria-live，全原生 button／textarea；待用戶真機驗（相機＋咪）
- **UR 2.3 — 語音轉文字（WIP，待訊飛 key 實測）**
  - 訊飛 IAT v2（`lib/iflytek.ts`，由舊專案實證模式移植，Node 原生 WebSocket 免新依賴）＋`app/api/transcribe`（粵→普→英順序兜底，key 全放 server）
  - 瀏覽器側 `lib/audio.ts`（webm 解碼→16k 單聲道→WAV base64）；錄完自動轉、可改、可重試、失敗回打字；送出 bundle 帶 note＋transcript
  - 待訊飛 APP_ID／API_KEY／API_SECRET 做粵語實測（AC1–AC4 全要真錄音驗）
  - redesign（taste skill）：筆記改橫線紙＋膠帶＋手寫計數；錄音改圓形錄音鍵＋計時＋60 秒真實進度軌＋自訂播放（去 emoji，換 lucide）；送出改全幅藥丸＋硬陰影＋按壓動效；EN 文案去 em-dash

### Planned
- 等用戶從 20 張風格圖選定方向，把更多 theme preset 填進 `lib/themes/presets/`
- 用戶會在 backlog 補首頁詳細需求，屆時替換 sections 的 placeholder 內容
- 裝 vitest，補 theme registry 的 unit test（呼應 `.memory/2026-09-01-skipped-unit-tests-before-commit.md`）

## [0.7.0] — 2026-09-02

### Added
- **UR 1.2 — 語言與主題切換元件**
  - `components/language-switcher.tsx` — segmented control（3 按鈕：繁/简/EN），常駐顯示、`aria-pressed` 狀態
  - `components/theme-switcher.tsx` — 雙軌：桌面 Popover（anchored）+ 手機 Sheet（bottom）
  - `components/theme-preview-card.tsx` — 主題視覺縮圖，**局部套用 theme tokens** 確保預覽反映主題實際樣貌
- **shadcn 新元件** `components/ui/popover.tsx`（base-ui Popover）+ `components/ui/sheet.tsx`（base-ui Dialog）

### Changed
- `app/[locale]/layout.tsx` — 用 `LanguageSwitcher` 取代 `LanguagePicker`（dropdown）、用 `ThemeSwitcher` 取代 `ThemePicker`（dropdown）
- 移除 `components/language-picker.tsx` 與 `components/theme-picker.tsx`（被取代）

### Memory
- `.memory/2026-09-02-base-ui-popover-sheet-pattern.md` — 同 trigger 不同 viewport 行為的雙軌設計、local CSS vars 預覽手法

## [0.6.0] — 2026-09-02

### Added
- **i18n architecture (next-intl 4.x + Next.js 16)**
  - `i18n/routing.ts` — `defineRouting({ locales: ["zh-Hant","zh-Hans","en"], defaultLocale: "zh-Hant", localePrefix: "never" })`
  - `i18n/request.ts` — `getRequestConfig` loads messages per locale
  - `proxy.ts` — Next.js 16 renamed from `middleware.ts`, runs `createMiddleware(routing)`
  - `messages/{zh-Hant,zh-Hans,en}.json` — translation files for all 3 locales
- **`app/[locale]/` route segment** — required by next-intl for URL routing; was ` (marketing)` before (didn't work — proxy rewrites to `/zh-Hant` with no matching route)
  - `layout.tsx` — `NextIntlClientProvider`, `ThemeProvider`, header (theme picker + language picker + sign-in CTA), Footer
  - `page.tsx` — Bento Grid (UR 1.1)
  - `camera/page.tsx` — stub
  - `mood/page.tsx` — stub
- **`components/language-picker.tsx`** — header dropdown; switches cookie + `window.location.reload()`
- **Theme + language i18n** — `useTheme()` + `useTranslations()` integration across nav, footer, Bento cards, metadata title
- **Bento Grid (UR 1.1)** — 3 cards in asymmetric CSS Grid
  - `RandomPickCard` (client, in-place expand with state machine: idle → loading → result / timeout)
  - `PhotoPickCard` (server, Link → /camera)
  - `MoodRecCard` (server, Link → /mood)
- **`lib/beers.ts`** — 15-entry mock beer catalog + `pickRandomBeer()` pure function

### Changed
- **Route structure** — all pages moved into `[locale]/` segment (was `(marketing)` + `(app)`)
- **`components/ui/button.tsx` style** — `buttonVariants` now imported directly into ThemePicker / LanguagePicker instead of using Button wrapper (base-ui's `render` prop doesn't pass children)
- **`components/ui/dropdown-menu.tsx`** — wrapped Label/Items in `DropdownMenuGroup` per base-ui's MenuGroupContext requirement

### Memory
- `.memory/2026-09-02-next-intl-requires-locale-segment.md`
- `.memory/2026-09-02-base-ui-dropdown-patterns.md`

## [0.5.2] — 2026-09-02

### Changed
- `.harness/workflow.md` — Step 10 拆成 10a-10d，明確「含 UI 變更的開發完成後必須啟動瀏覽器讓用戶親眼確認才 commit」；純文檔/config/refactor 例外
- `CLAUDE.md` — 硬規則區塊新增此條，並列 Step 10 摘要

### Memory
- `.memory/2026-09-02-user-must-verify-ui-in-browser.md` — 用戶糾正：vision tool 不是用戶確認的替代品

## [0.5.1] — 2026-09-02

### Fixed
- `<Button render={<a>}>` 在 5 處加 `nativeButton={false}`，消除 Base UI 的 5 條「nativeButton expected」console warning（影響 accessibility 與表單語意）

### Changed（防禦性，順手加）
- 字級 mobile 從 `text-4xl` 降到 `text-3xl`（hero h1）/ `text-3xl` 降到 `text-2xl`（section h2）— 窄螢幕更穩
- `text-balance` / `text-pretty` → `break-words` — 對未知長度更 robust
- `<body>` 加 `overflow-x-hidden` — 兜底防意外
- `<Stack>` 加 `min-w-0` — flex container 防 overflow 通用守則

### Memory
- `.memory/2026-09-02-skipped-playwright-step-6.md` — 漏執行 Step 6 的紀錄
- `.memory/2026-09-02-chrome-headless-screenshot-unreliable.md` — Chrome headless `--screenshot` 在 CJK 字型渲染不可靠，視覺回報可能是 false alarm；改用 playwright

## [0.5.0] — 2026-09-02

## [0.4.0] — 2026-09-02

### Changed
- `.harness/workflow.md` 重寫為完整 10 步流程：理解需求 → 思考確認 → 工具查 API → 寫碼 → 驗證 → 瀏覽器測試 → 修正 → memory → 日誌 → 確認提交。每步有 input/output 與降階條件。
- `CLAUDE.md` 加入硬規則摘要：未確認不 commit / 新 lib 先查 API / 邏輯錯立即修並重走 step 3-7 / 每次修正要寫 memory

### Added
- `.memory/2026-09-02-workflow-10-step-process.md` — 記錄這次 workflow 升級的決策與理由

## [0.3.0] — 2026-09-01

### Added
- **`.harness/` 目錄** — 團隊開發規範，分五個面向：
  - `README.md` — 索引與讀取時機
  - `workflow.md` — 任務流程、提交前檢查清單
  - `coding-standards.md` — TypeScript / React / 檔案結構 / 命名 / import 順序 / 不做清單
  - `testing.md` — 何時必寫 unit test、commit gate、例外標記
  - `git.md` — 分支策略、commit 格式（type/scope/subject/body/footer）、不可做清單
  - `architecture.md` — 技術棧決策與原因、theme 系統設計、待補 ADR
- **`.memory/` 目錄** — 教訓紀錄，初始 5 條：
  - `README.md` — 格式規範（四段：情境/問題/原因/修正）
  - `2026-09-01-skipped-unit-tests-before-commit.md` — 跳過 unit test 的疏漏
  - `2026-09-01-git-post-buffer-large-commit.md` — git 2.15 push 7MiB commit 失敗
  - `2026-09-01-shadcn-uses-base-ui-not-radix.md` — shadcn 新版用 base-ui 不是 Radix
  - `2026-09-01-node-version-pinning-required.md` — Node 22 是 hard requirement
  - `2026-09-01-co-authored-by-apostrophe-shell-escape.md` — Bash commit message 含 apostrophe 報錯
- **`CLAUDE.md` 補上** — Claude Code 啟動時必讀 `.harness/workflow.md` + `.memory/`，每次開發任務開始前先檢查
- **`.nvmrc`** — 寫入 `22`，讓 `nvm use` 自動選對版本
- **`package.json` engines** — `node: ">=22"` 明確聲明最低版本

### Changed
- 沒有改既有功能，純加規範基礎建設

## [0.2.0] — 2026-09-01

## [0.2.0] — 2026-09-01

### Added
- **Theme system 骨架** — `lib/themes/` 下建立 registry + 4 個 preset：
  - `nova`（shadcn Nova 預設，留空 tokens 用 globals.css 預設值）
  - `flat-illustration`（深 navy + 暖琥珀 + 圓角）
  - `neo-brutalism`（白底 + 酸黃 + 紫紅 + 零圓角 + 粗黑邊）
  - `watercolor`（米白 + 淡彩 + 大留白 + 大圓角）
- `components/theme-provider.tsx` — client component，把 theme tokens 套到 `<html>` 的 inline style，存 localStorage
- `components/theme-picker.tsx` — header 右上角下拉選單，用 `render` prop（base-ui API，不是 Radix asChild）切換 theme
- `app/layout.tsx` — 包 `<ThemeProvider>` + `<ThemePicker>`，標題改為 `Whattodrink — 今晚喝咩？`
- `app/page.tsx` — 改成 Tonight's Pick landing prototype：標題、CTA、active theme 預覽卡（列出每個 token）、token 規則說明
- `.env.example` — 列出 `github_key` / `minimaxi_api_key` / Supabase / Claude / Google Places 的 placeholder 與申請連結

### Changed
- `package.json` — Next.js 16.3.4（原本想裝 15，環境是 Node 18 太舊，改升級 Node 22 後裝 16）+ React 19.2.8 + Tailwind v4 + `@base-ui/react` (shadcn 新 base 庫)
- `.gitignore` — 保留 Next.js 預設，加上 `.claude/`、`!.env.example` allowlist

## [0.1.0] — 2026-09-01

### Added
- 初始化 Next.js 16 + React 19 + Tailwind CSS v4 + TypeScript + ESLint scaffold
- 建立 `docs/PRODUCT_BACKLOG.md`（原 `product backlog.md` 移入）
- 建立本 `CHANGELOG.md`
- `.gitignore` 排除 `.env*`、`.claude/`、`.staging/`、`node_modules/`、`.next/`
- `.gitignore` 允許 `.env.example` 提交（給團隊協作的環境變數範本）
- `README.md` 寫入專案概覽、文檔索引、技術棧、開發指令、設計原則
- GitHub repo 建立：`https://github.com/cntk50951-eng/whattodrink.git`

### Notes
- Node 版本要求 22+（`nvm use 22`）
- `UI style/` 目錄保留 20 張風格探索圖（MiniMax image-01 生成），作為 design system 選型參考
