@AGENTS.md

# Claude Code Instructions for this project — whattodrink

> 香港年輕人選酒/喝酒心情記錄 app。產品方向見 `docs/PRODUCT_BACKLOG.md`，開發日誌見 `CHANGELOG.md`。

## ⚠️ 每次開始任務前必讀（不可跳過）

1. **`.harness/workflow.md`** — 任務流程與提交前檢查清單
2. **`.harness/coding-standards.md`** — 寫程式前的風格對齊
3. **`.memory/` 最新 3–5 條** — 確認沒有重蹈覆轍（檔名格式 `YYYY-MM-DD-*.md`）
4. 依任務性質再讀對應的 `.harness/` 子檔（testing / git / architecture）

開始寫程式前，如果最近 24 小時有新增 memory 條目，**全部讀完**。

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
