# Workflow — 10 步開發流程

每個任務都走這 10 步。從 `.harness/workflow.md` 開始讀起。

---

## Step 1 · 理解用戶需求

- **重述需求**：用自己的話寫出 goal & non-goal，給用戶確認
- **拆 acceptance criteria**：完成條件是什麼？（可驗證的）
- **查 product backlog**：`docs/PRODUCT_BACKLOG.md` 有沒有對應 epic / UR
- **查 UR 狀態**（見 `ur-status.md`）：要碰的 UR 無 tag 先補 `[]`；開工（第一個實作動作前）置 `[WIP]`
- **不要假設**：用戶說「做個 X」時，先確認他腦中的 X 是哪個 X

## Step 2 · 獨立深度思考 + 找不確定點

- 列出可能的實作路徑（≥2 個）並寫出取捨
- 識別不確定的點：
  - 範圍（scope）模糊？例如「首頁」是指 marketing landing 還是 in-app home？
  - 命名 / 結構 / 檔案位置？
  - 與既有功能 / 規範是否衝突？
  - 視覺 / 互動細節沒講？
- **有疑慮就用 AskUserQuestion**，不要帶著假設往下做
- 沒有疑慮才進 step 3

## Step 3 · 工具調用確認 API

- **新 lib / 新版本**：用 `mcp__context7__resolve-library-id` + `mcp__context7__query-docs` 查最新 API
- **官方文檔**：`WebFetch` 拿原始頁面
- **breaking change**：訓練資料可能過時，每個新東西都要現查
- 把查到的 API 摘要寫下來再開始寫 code

## Step 4 · 開始代碼開發

- 遵循 `coding-standards.md`
- 一次只動一個範疇，**不要在同一個 commit 夾帶多個無關改動**
- 多步 task 用 `TaskCreate` / `TaskUpdate` 追蹤進度
- Server Component by default；只在需要 state/effect/event 才 `"use client"`
- 重要 decision 在程式碼旁寫 comment（為什麼這樣選）

## Step 5 · 編譯驗證 + 單元測試

- `npm run build` — 編譯 + TypeScript 型別檢查
- `npm test` — vitest（如已裝）；純函數 / 邏輯分支必測
- `npm run lint` — ESLint 無 error
- **三道 gate 全綠才能進 step 6**

## Step 6 · 瀏覽器測試（具體功能時）

- 涉及**具體 UI 功能**（互動、表單、動畫、狀態變化）時，用 Playwright 或瀏覽器 MCP 開瀏覽器實際點
- 純 layout / 靜態頁面可以靠 `npm run build` 通過就算
- 截圖記錄視覺對不對
- 之後做 app（React Native / Flutter）時再想測試方法，目前先 web

## Step 7 · 發現與修正

- 看到錯誤立即修：
  - 畫面破版 / 排版錯
  - TypeScript / lint error
  - 邏輯跑出非預期結果
  - Console error / warning
- **修正過程重新走 step 3 → 7**（從查 API 開始）
- 不要 patch 症狀，要找 **root cause**
- 同一個錯修超過 2 次 → 該寫進 `.harness/`（成為規範）
- 每次修正都是 **memory 候選**（見 step 8）

## Step 8 · 紀錄 memory

寫進 `.memory/YYYY-MM-DD-<slug>.md` 的情境：
- ✅ 任何修正（包括 step 7 的修正）
- ✅ 用戶的修正指示（用戶糾正你做的事）
- ✅ 用戶的明確指示（「以後都要這樣做」「不要再這樣」）
- ✅ 工具鏈踩雷（找不到 / 報錯 / 行為反直覺）
- ✅ 找到的非顯而易見 workaround

格式固定四段：**情境 / 問題 / 原因 / 修正**（見 `.memory/README.md`）

每個 commit 結束前檢查「這次有沒有任何修正或教訓？」→ 有就寫

## Step 9 · 紀錄修改日誌

- 更新 `CHANGELOG.md`，新增版本段（[Unreleased] / [0.x.0]）
- 列：Added / Changed / Deprecated / Removed / Fixed / Security
- 中文或英文皆可，但 type 統一英文
- 同個版本可以包含多個 commits 的累積變更

## Step 10 · 用戶視覺確認 + 提交

> 任何**含 UI 變更**的開發完成後，必須先用本地瀏覽器讓用戶親眼確認，才進 commit 流程。

### 10a. 啟動本地瀏覽器

- 確保 dev server 跑著（`npm run dev` 在背景）
- 用 macOS `open` 指令或提供 URL 給用戶開啟
  ```bash
  open http://localhost:3000/
  ```
- 提供 network URL（同網段手機可測響應式）：
  ```
  http://<lan-ip>:3000/
  ```
- **不要**用 vision tool 自動看截圖就當用戶已確認 — vision 看的不等於人眼

### 10b. 等用戶反饋

- 等用戶：
  - 在瀏覽器實際打開
  - 切換不同 viewport（DevTools device mode）看響應式
  - 切換 theme picker 看 design tokens 即時換
  - 確認 layout / 文案 / 互動 OK，或指出要改的地方
- 在用戶給出「OK 可以 commit」或具體修改指示前，**不要**：
  - git commit
  - git push
  - 準備「確認提交？」問題

### 10c. 收到反饋後

- 如果用戶說「OK 可以 commit」 → 進 10d
- 如果用戶指出要改 → 回 Step 4（修改）→ 重走 Step 5-9 → 再回 10a（瀏覽器確認）

### 10d. 確認提交

- 先對 UR 狀態（見 `ur-status.md`）：只有用戶**明確確認該 UR 完成**，才把 backlog 標題改為 `[x]`；測試綠／已合併／轉場下一題都不算完成。狀態改動隨相關 commit 一起提交，不必單獨 commit

- 準備 commit 時顯示：
  - 改了哪些檔
  - CHANGELOG 寫了什麼
  - test / build / lint 結果
- 用 `AskUserQuestion` 問「Commit + push 嗎？」拿最終確認
- 等用戶明確答「要」才執行 `git commit` + `git push`
- commit message 遵循 `git.md` 格式
- 推送用 token inline URL，不寫進 git config

### 例外（純非 UI 變更）

- 純文檔、純 config、純 refactor（沒改任何視覺或行為）：
  - 可以**省略 10a-10b**（不需開瀏覽器）
  - 但仍要 10c-10d（拿到 commit 確認）
- commit message 註明 `[docs-only]` / `[skip-tests]` / `[no-ui-change]`

---

## 快速 checklist（每個任務結束前自查）

```
□ Step 1 — 需求有寫下來、AC 列了、UR 狀態 tag 對（無→`[]`，開工→`[WIP]`）
□ Step 2 — 疑慮有問完
□ Step 3 — API 查過最新版本
□ Step 4 — coding-standards 對齊
□ Step 5 — build / lint / test 全綠
□ Step 6 — UI 功能用瀏覽器實際點過
□ Step 7 — 看到的錯都修了（root cause 不是 patch）
□ Step 8 — memory 有加（如有修正）
□ Step 9 — CHANGELOG 更新
□ Step 10 — 等用戶確認 commit；`[x]` 只在用戶明確驗收該 UR 後打勾
```

## 例外與降階

| 情境 | 降階方式 |
|---|---|
| 純 scaffold / config-only commit | 可免 step 5 的 test，但 message 註明 `[skip-tests]` |
| 純文檔修改（`.md` only） | 可免 build，但仍需 lint |
| lockfile-only 變更 | 可免 test/build，但仍需 lint |
| 用戶明確指示跳過某 step | 在 commit message 註明 `[skip-<step>]` 原因 |
