# 2026-09-01: Scaffold commit 前跳過 unit test

## 情境

完成 Next.js 16 + Tailwind v4 + shadcn/ui + theme system scaffold 後，直接：
1. `git commit -m "..."`
2. `git push` 到 GitHub

`CHANGELOG.md` 寫了 0.1.0 + 0.2.0 兩個版本，包含 theme provider、theme picker、4 個 theme presets。

## 問題

- **完全沒寫 unit test**
- **完全沒跑 test**（npm test 也不存在，因為 vitest 還沒裝）
- 只有跑 `npm run build`（含 TypeScript 型別檢查）
- 用戶問「做過 unit test 和編譯測試了嗎」才意識到疏漏

## 原因

- 想趕快把骨架送上去給團隊看，覺得「先有東西比較重要」
- 當時 `.harness/testing.md` 還沒寫，沒有規範約束
- 預設 vitest 沒裝，技術上跑不了 test，心態上就當作「之後再說」
- Theme registry 是純資料，誤以為不需要測

## 修正

1. **寫進 `.harness/testing.md`**：含新邏輯的 commit 必須先寫 unit test 並跑過
2. **寫進 `.harness/workflow.md`**：提交前必跑 `build` + `lint` + `test` 三道 gate
3. **寫進 `CLAUDE.md`**：讓 Claude 每次開始任務前讀 `.harness/` + `.memory/`
4. **下次有機會**：裝 vitest，把 theme registry 的 `getTheme` 等純函數補上測試
5. **心態校正**：scaffold 階段就該裝 test framework，不要等到「有邏輯」才裝

## 學習

- 「純資料」≠ 「不需要測」— 即使是 registry，至少要測 fallback、id 唯一性、預設值
- 規範文件要在第一次 commit 前先寫，這樣不會有「v0.1.0 已發但規範後補」的尷尬
- 工具鏈（vitest）應該跟主框架（Next.js）一起裝，不要分階段

## 相關

- `.harness/testing.md`
- `.harness/workflow.md`
- `.harness/coding-standards.md`
