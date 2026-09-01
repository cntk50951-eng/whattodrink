# Workflow — 任務流程

## 開始任何任務前

1. **讀 `.harness/workflow.md`**（這個檔案）確認流程
2. **讀 `.memory/` 最新 3–5 條**，確認沒有重蹈覆轍
3. 如果是 multi-step task，建立 TaskList 追蹤

## 開發流程

```
1. 環境：nvm use 22 + npm install（必要時）
2. 寫程式：遵循 coding-standards.md
3. 測試：遵循 testing.md — 對新邏輯先寫 test
4. 驗證 gate（提交前必跑）：
   □ npm run build     — 編譯 + TypeScript 型別檢查
   □ npm run lint      — ESLint 無 error
   □ npm test          — vitest 全綠（如已安裝）
5. 文件：更新 CHANGELOG.md（每個 PR 一條）
6. commit：遵循 git.md
```

## 提交前 checklist（不可跳過）

- [ ] `npm run build` 通過
- [ ] `npm run lint` 無 error
- [ ] 新邏輯有對應 unit test 並通過
- [ ] `CHANGELOG.md` 更新
- [ ] Commit message 描述清楚改了什麼、為什麼

## 例外

- **純 scaffold / config-only commit**（如只改 `.gitignore`、初始化目錄）可以免 test，但必須在 commit message 註明 `[skip-tests]`
- **純文檔修改**（如只動 `*.md`）可以免 build，但仍需跑 lint
- **lockfile-only 變更**（如 `package-lock.json`）免 test/build，但仍需 lint
