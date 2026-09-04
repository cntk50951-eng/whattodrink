<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# OpenCode Instructions for this project — whattodrink

> 香港年輕人選酒/喝酒心情記錄 app。產品方向見 `docs/PRODUCT_BACKLOG.md`，開發日誌見 `CHANGELOG.md`。

## ⚠️ 每次開始任務前必讀（不可跳過）

1. **`.harness/workflow.md`** — 10 步開發流程（理解需求 → 思考確認 → 工具查 API → 寫碼 → 驗證 → 測試 → 修正 → 紀錄 → 日誌 → 確認提交）
2. **`.harness/coding-standards.md`** — 寫程式前的風格對齊
3. **`.memory/` 最新 3–5 條** — 確認沒有重蹈覆轍（檔名格式 `YYYY-MM-DD-*.md`）
4. 依任務性質再讀對應的 `.harness/` 子檔（testing / git / architecture）

開始寫程式前，如果最近 24 小時有新增 memory 條目，**全部讀完**。

## 開發時必須遵守的硬規則

- **未經用戶確認前不要自動 commit / push**（workflow.md Step 10）
- **含 UI 變更的開發完成後，必須先用本地瀏覽器讓用戶親眼確認**（Step 10a-10b），不能用 vision tool 自動看截圖就當用戶已過目
- **新 lib / 新版本要先用 context7 查 API**（Step 3），不要憑訓練資料寫
- **邏輯有錯立即修，並重新走 step 3→7**（Step 7）
- **每次修正 / 用戶糾正 / 工具鏈踩雷都要寫 memory**（Step 8）

## 開發後提交前必做（Step 10 摘要）

```
1. 確認 dev server 跑著（背景 task）
2. 啟動瀏覽器：open http://localhost:3000/ 或給用戶 URL
3. **等用戶在瀏覽器親眼確認**（視響應式、theme 切換、互動）
4. 等用戶回覆「OK 可以 commit」或具體修改指示
5. AskUserQuestion 拿最終 commit 確認
6. 才執行 git commit + git push
```

**例外**：純文檔 / config / refactor（無 UI 變更）可省略步驟 2-3，但仍要 4-6。

## 環境要求

- Node 22+：`nvm use 22`（每次非互動 bash 都要 `export PATH="/Users/yuki/.nvm/versions/node/v22.22.0/bin:$PATH"`）
- npm（本機沒裝 pnpm，請用 npm）
- 不要嘗試裝 gh CLI；用 GitHub API + `curl` 處理 GitHub 操作

## 提交前必跑

- `npm run build` — 編譯 + TypeScript 型別檢查
- `npm run lint` — ESLint
- `npm test` — vitest（如已安裝；見 `.harness/testing.md`）

任何含新邏輯的 commit **必須**包含對應 unit test。例外見 `.harness/testing.md`。

## 安全

- 不可把 `.env` 內容硬編碼進 shell command、URL、commit message
- API key 從 `.env` 讀取時，用 `grep '^KEY_NAME=' .env | cut -d= -f2-` 抽出後存到 shell variable
- 推送用 token 時，建議 inline URL（`https://x-access-token:${TOKEN}@github.com/...`），不要 `git remote set-url` 寫進 git config

---

# Muse Code harness 對應（Muse Code powered by Meta Muse Spark）

> Muse Code 啟動時讀本檔（`AGENTS.md`）為專案規則；`.harness/` 是跨工具共享規範，不需另建 `.muse/` 配置。

## Skill 位置

- Muse 可讀的專案 skill 在 `.agents/skills/`（跨工具共享根；Muse 另相容掃描 `.claude/skills`、`.codex/skills`）：
  - `harness-workflow` — 每次任務開始前必讀（10 步流程）
  - `code-review` — 每次 commit 前的 self-review checklist
  - `github-api` — GitHub 操作（REST + curl，不用 `gh` CLI）
- 內容與 `.opencode/skills/` 下同名 skill 一致；改任一邊時同步另一邊（見 `.agents/skills/README.md`）。

## 工具對應（Claude / opencode 寫法 → Muse）

| 原規範寫法 | Muse 對應 |
|---|---|
| `mcp__context7__*` 查最新 API（Step 3） | `web_search` + `web_fetch`（skill 全文用 `read_skill` 載入） |
| `AskUserQuestion`（Step 2 / Step 10d） | `request_user_input` |
| `TaskCreate` / `TaskUpdate`（Step 4） | `write_todos` |
| Playwright / 瀏覽器 MCP（Step 6） | `agent-browser` skill（user scope 已安裝） |
| `gh` CLI | 不用；走 `github-api` skill（curl） |

## 插件對應（`.claude/settings.json` → Muse）

`.claude/settings.json` 的 7 個 Claude 插件在 Muse 沒有 1:1 ID，不建假配置，對應如下：

| Claude 插件 | Muse 對應 |
|---|---|
| `context7` | `web_search` + `web_fetch` |
| `playwright` | `agent-browser` skill |
| `github` | `github-api` skill（REST + curl） |
| `code-review` | `code-review` skill（`.agents/skills/`） |
| `frontend-design` / `superdesign` | `design-taste-frontend` 等 user skill（按需 `read_skill`） |
| `superpowers` | `harness-workflow` skill + `.harness/` |

## 不變的硬規則

- `.harness/` 即規範全文；`CLAUDE.md` 的硬規則（Step 10 確認提交、UI 需用戶親眼確認等）對 Muse 同樣生效。
- 未經用戶確認不 `commit` / `push`；含 UI 變更先 `open http://localhost:3000/` 等用戶親眼確認。
