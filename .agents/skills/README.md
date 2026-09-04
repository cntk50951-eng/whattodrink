# `.agents/skills/` — 跨工具共享的專案 skill（Muse Code 可讀）

Muse Code 讀取此目錄為 project skills（另相容掃描 `.claude/skills`、`.codex/skills`）。
內容與 `.opencode/skills/` 下同名 skill 保持一致：

| skill | 用途 |
|---|---|
| `harness-workflow` | 每次任務開始前必讀（10 步流程） |
| `code-review` | 每次 commit 前的 self-review checklist |
| `github-api` | GitHub 操作（REST + curl，不用 `gh` CLI） |

改任一邊時同步另一邊；僅工具調用層的差異允許不同（例如查最新 API：此處用 `web_search` + `web_fetch`，opencode 側用 context7 MCP）。
