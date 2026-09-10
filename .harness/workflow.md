# Workflow — 10 步開發流程

每個任務都走這 10 步。從 `.harness/workflow.md` 開始讀起。

---

## Step 1 · 理解用戶需求

- **重述需求**：用自己的話寫出 goal & non-goal，給用戶確認
- **拆 acceptance criteria**：完成條件是什麼？（可驗證的）
- **查 product backlog**：`docs/PRODUCT_BACKLOG.md` 有沒有對應 epic / UR
- **查 UR 狀態**（見 `ur-status.md`）：要碰的 UR 無 tag 先補 `[]`；開工（第一個實作動作前）置 `[WIP]`
- **不要假設**：用戶說「做個 X」時，先確認他腦中的 X 是哪個 X

### 開工門禁 · 記憶回顧（硬性，未做不許進 Step 4）

1. 讀完 `.memory/` 最近 24 小時新增的**全部**條目＋最近 3–5 條
  （AGENTS.md 已有要求，這裡是執行點）。
2. 在本輪第一次實質回覆（計劃／提問／開工說明）中**報備**：
   讀了哪幾篇、哪條約束本輪生效。沒報備＝沒讀完，不許寫第一行代碼。
3. compaction 後首個動作就是重讀，不讀完不動代碼（斷片是返工之源）。

## Step 2 · 獨立深度思考 + 找不確定點

- 列出可能的實作路徑（≥2 個）並寫出取捨
- 識別不確定的點：
  - 範圍（scope）模糊？例如「首頁」是指 marketing landing 還是 in-app home？
  - 命名 / 結構 / 檔案位置？
  - 與既有功能 / 規範是否衝突？
  - 視覺 / 互動細節沒講？
- **有疑慮就用 AskUserQuestion**，不要帶著假設往下做
- 沒有疑慮才進 step 3

### 思考摘要門禁（硬性，用戶指令）

思考過程不可只存在腦子裡。進 Step 3 之前，必須在回覆裡輸出一段
**思考摘要**，缺一不可：

1. 候選路徑 ≥2 個（A／B／C）
2. 每條的取捨（一句話：選它得到什麼、付出什麼）
3. 否決項的否決理由（一句話）
4. 疑慮清單：問了什麼／為什麼不問

沒輸出這段＝沒思考，不許開工。反面教材：UR1.7 首版只有結論沒有推演
（被打回調 skill 重做），UR2.0 範圍拍腦袋（漏他人卡片返工）。

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
- API 開發另走 `.harness/api-workflow.md` 七步（一次一個端點，不打包）

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

### 改動回寫 UR（硬性，用戶指令）

用戶每次提出新改動（驗收返工／bug 修／需求追加）並完成後：

1. 回到 backlog 對應 UR：範圍／邊界／AC 有變化就同步改，並在該 UR 下
   `*改動記錄*` 追加一行（日期＋改了什麼＋為什麼）。
2. `CHANGELOG.md` 對應 UR 下加 fix 行呼應（兩處互為索引）。
3. memory 按 Step 8 照記（修正／糾正必記）。
4. 收工 checklist 自查時逐項驗這三處。

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

## Step 9b · 數據文檔檢查（UR1.9 硬規則）

UI 全確定前不建表，但數據文檔（`docs/data/`）必須與前端同進退：

- 每次功能／增強改動後，逐一回答：**新增／改變了前端展示或使用的數據嗎？**
  （新字段、新 localStorage、新 mock 結構、新外部 API 數據、state 轉持久化都算）
- 有 → 同步更新 `docs/data/` 對應文檔（四列：頁面位置／類型／當前來源／未來表映射），
  隨相關 commit 一起提交
- 無 → commit message 註明 `數據文檔無需更新`（留痕，免得後人猜）
- 純 UI 位移、純文案、不改數據的重構：免檢，但上面那句留痕照寫

## Step 9c · 收尾逐項報備（硬性，用戶指令）

完工回覆（驗收請求／交付總結）必須逐項報備，報不清＝沒做完：

1. **gate 结果**：build／lint／test 各自全綠或失敗原因（貼數字，不說“通過了”）
2. **memory**：新增哪篇（文件名），沒新增就說為什麼沒新增
3. **CHANGELOG**：寫了哪幾行
4. **9b**：同步了哪幾個文件／哪幾行，或“零新增、無需更新”
5. **temp 清理**：刪了什麼／本輪無殘留（常駐指令，每輪交代一句）

反面教材：UR2.0 首版 9b 只報“已同步”，實則漏他人字段——報備要報到
文件名＋行級，籠統的一句不算數。

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

- 先對 UR 狀態（見 `ur-status.md`）：只有用戶**明確確認該 UR 完成**，才把 backlog 標題改為 `[✓]`；測試綠／已合併／轉場下一題都不算完成。狀態改動隨相關 commit 一起提交，不必單獨 commit
- push／合併完成後，**主動問一句該 UR 是否驗收通過**（不問＝狀態爛掉，這是硬性動作）：過→當場 `[✓]`；不過→記問題、保持 `[WIP]` 繼續修

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
□ Step 1 — 需求有寫下來、AC 列了、UR 狀態 tag 對（無→`[]`，開工→`[WIP]`）、記憶回顧已報備
□ Step 2 — 疑慮有問完、思考摘要已輸出（≥2 路徑＋取捨＋否決理由）
□ Step 3 — API 查過最新版本
□ Step 4 — coding-standards 對齊
□ Step 5 — build / lint / test 全綠（API 任務另檢 `.harness/api-workflow.md` 七步）
□ Step 6 — UI 功能用瀏覽器實際點過
□ Step 7 — 看到的錯都修了（root cause 不是 patch）、UR 改動記錄已回寫
□ Step 8 — memory 有加（如有修正）
□ Step 9 — CHANGELOG 更新
□ Step 9b — 數據文檔檢查（有新增／改變數據就同步 `docs/data/`，無則 commit 留痕）
□ Step 10 — 等用戶確認 commit；`[✓]` 只在用戶明確驗收該 UR 後打勾
□ 收尾 — gates＋memory＋CHANGELOG＋9b＋temp 已逐項報備（9c）
```

## 例外與降階

| 情境 | 降階方式 |
|---|---|
| 純 scaffold / config-only commit | 可免 step 5 的 test，但 message 註明 `[skip-tests]` |
| 純文檔修改（`.md` only） | 可免 build，但仍需 lint |
| lockfile-only 變更 | 可免 test/build，但仍需 lint |
| 用戶明確指示跳過某 step | 在 commit message 註明 `[skip-<step>]` 原因 |
