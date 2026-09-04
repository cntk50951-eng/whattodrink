# Changelog

所有重要修改會記錄在這個檔案。格式借鑑 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/)。

## [Unreleased]

### Added
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
