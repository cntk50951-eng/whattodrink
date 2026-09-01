# Changelog

所有重要修改會記錄在這個檔案。格式借鑑 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/)。

## [Unreleased]

### Planned
- 等用戶從 20 張風格圖選定方向，把更多 theme preset 填進 `lib/themes/presets/`
- 第一個 prototype 頁面（Tonight's Pick landing）
- 裝 vitest，補 theme registry 的 unit test（呼應 `.memory/2026-09-01-skipped-unit-tests-before-commit.md`）

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
