# Git — 版控規範

## 分支策略

- **`main`** — 主分支，永遠可部署
- **`feat/<slug>`** — feature branch，如 `feat/random-pick-button`
- **`fix/<slug>`** — bug fix
- **`refactor/<slug>`** — 重構
- **`docs/<slug>`** — 文檔變更

PR 從 feature branch 合併到 main。main 上的 commit 必須是經 review 的 squash merge 或 clean merge。

## Commit Message 格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type

| type | 用途 |
|---|---|
| `feat` | 新功能 |
| `fix` | bug fix |
| `refactor` | 重構（不改變行為） |
| `chore` | 雜務（build、CI、依賴更新） |
| `docs` | 文檔 |
| `test` | 測試 |
| `style` | 純格式化（不改邏輯） |
| `perf` | 性能優化 |

### Subject

- 中文或英文皆可
- < 50 字
- 不加句號
- 用動詞開頭（feat: add / fix: correct / refactor: extract）

### Body

- 改了什麼、為什麼改、怎麼驗證
- 中文或英文皆可

### Footer

- 引用 issue：`Refs: #123` 或 `Closes: #123`
- 標記例外：`[skip-tests]` / `[docs-only]` / `[lockfile-only]`
- 共同作者：`Co-Authored-By: Name <email>`

## 範例

```
feat(theme): add vintage-tiki preset

- 新增第三個 theme preset：tropical tiki colors
- 在 registry 註冊並驗證 picker 切換正常
- 對應 UI style/08 Vintage Tiki.jpg

Co-Authored-By: Claude Code <noreply@anthropic.com>
```

## 不可做

- ❌ 直接 push 到 main（除非 hotfix 且已開 PR / 同意）
- ❌ `git push --force` 到 main
- ❌ commit 含 `.env` 或 secrets（pre-commit hook 應擋）
- ❌ 把 `node_modules/` 或 `.next/` commit 進去（`.gitignore` 應擋）
