@AGENTS.md

# Claude Code Instructions for this project — whattodrink

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
