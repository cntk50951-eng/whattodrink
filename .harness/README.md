# `.harness/` — 開發規範總覽

`harness` 控制這個專案「怎麼寫」。每個檔案是一個面向。

## 何時讀

| 任務性質 | 必讀檔案 |
|---|---|
| **每次開始任務** | `workflow.md` + `ur-status.md` |
| **寫程式前** | `coding-standards.md` |
| **測試相關** | `testing.md` |
| **commit / PR 前** | `git.md` + `workflow.md` |
| **架構決策** | `architecture.md` |

## 檔案索引

- [`workflow.md`](workflow.md) — 任務流程與提交前檢查清單
- [`coding-standards.md`](coding-standards.md) — TypeScript / React / 檔案結構 / 命名
- [`testing.md`](testing.md) — 何時必須寫 unit test、工具、commit gate
- [`git.md`](git.md) — 分支策略、commit 格式、PR 規範
- [`architecture.md`](architecture.md) — 技術棧決策與原因
- [`ur-status.md`](ur-status.md) — UR 狀態標記（`[]`／`[WIP]`／`[✓]`）與打勾規則

## 與 `.memory/` 的關係

- **`.harness/`** = 穩定的規範（人工共識後寫入）
- **`.memory/`** = 動態的教訓（踩到坑就記一筆，下次讀到避免重蹈）

規範有可能因為 memory 的累積而演進，但 memory 不會直接改 harness，要改就開 PR 討論。
