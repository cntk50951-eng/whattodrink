# 2026-09-02: 開發後必須用戶親眼在瀏覽器確認，不可憑 vision tool 截圖代勞

## 情境

寫完 marketing landing framework 後，跑 playwright 截圖確認 layout 沒問題，就用 AskUserQuestion 問「要 commit + push 嗎？」

用戶糾正：「按照 harness 的要求，每次開發完成之後，我需要你啟動本地瀏覽器，讓我查看結果、確認、反饋，得到我的反饋之後，你才可以提交。」

## 問題

1. **harness 規範原本沒有寫死這條** — workflow.md Step 10 之前只說「等用戶確認才 commit」，沒明確「必須讓用戶在瀏覽器親眼確認」
2. **我跳過了「啟動瀏覽器給用戶看」這步**，直接用 vision tool 看完截圖就準備 commit
3. **vision tool 看的不等於用戶看** — vision 對細節（間距、字體、互動手感）判斷力有限，更不能代替用戶對「這個設計我喜不喜歡」的主觀決策

## 原因

- 我把 Step 10 簡化為「build 過 + 我自己截圖看過 = 可以 commit」
- 沒意識到 UI 變更需要用戶**主觀**確認（喜不喜歡、有沒有遺漏需求）
- vision tool 是給我 debug 用的輔助，不是用戶驗收的替代

## 修正

1. **`.harness/workflow.md` Step 10 改寫** — 拆成 10a / 10b / 10c / 10d：
   - 10a 啟動本地瀏覽器（dev server + `open` URL）
   - 10b 等用戶反饋（不可省）
   - 10c 收到反饋後的分支（OK 進 10d，要改回 Step 4）
   - 10d 才到 AskUserQuestion 拿最終 commit 確認
2. **`CLAUDE.md` 硬規則區塊加一條**：「含 UI 變更的開發完成後，必須先用本地瀏覽器讓用戶親眼確認」
3. **例外條款**：純文檔 / config / refactor（無 UI 變更）可省 10a-10b，但仍要 10c-10d
4. **commit message 註明** `[no-ui-change]` / `[docs-only]` 等

## 學習

- **vision tool ≠ 用戶眼睛**：vision 能抓明顯 bug，但對「這個設計好不好」完全沒能力判斷
- **commit 之前的最後一關必須是用戶**，不是 AI 工具
- **harness 規範要明確到 step 層級**，不能假設「顯然該這樣做」

## 相關

- `.harness/workflow.md` — Step 10 改寫後版本
- `CLAUDE.md` — 硬規則區塊更新
- `.memory/2026-09-02-skipped-playwright-step-6.md` — 同類疏漏
- `.memory/2026-09-02-chrome-headless-screenshot-unreliable.md` — 之前對 vision tool 的誤判

## 未來自我提醒

寫完任何含 UI 的東西：
- ❌ 不要直接 `git commit`
- ❌ 不要只跑 vision tool 看截圖就當確認
- ✅ 要 `open http://localhost:3000/` 啟動瀏覽器
- ✅ 等用戶打字回覆「OK / 這裡要改」才進下一步
