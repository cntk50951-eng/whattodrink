# 2026-09-08 Claude Code harness 對齊（免提交，本地配置＋docs）

## 情境
- 用戶要 Claude Code 打開專案即有同等 harness control＋docs 裡的 skill 安裝命令；明確不用提交。

## 發現
- `.claude/` 整目錄被 `.gitignore` 忽略 → `settings.json`（7 plugins）新 clone 沒有；且 Claude Code 不讀 `.agents/skills/`（只認 `.claude/skills/`／`~/.claude/skills/`／plugin skills）。
- `.opencode/skills/` 缺 `harness-workflow`、`beer-icon`；`code-review/` 未追蹤（與 `.agents` 僅差一字 "the"）——opencode 側缺口，本輪未動，用戶只點了 claude。

## 做法
- `.claude/skills/` 新建 4 skill：`github-api`、`beer-icon` 逐字複製；`harness-workflow` 改 4 處、`code-review` 改 1 處（僅工具層：read_skill→Skill tool、web_search→context7、request_user_input→AskUserQuestion、agent-browser→playwright）。diff 已驗：除此 5 行外與 `.agents` 一致。
- 新增 `docs/claude-code-setup.md`：marketplace add＋7 條 plugin install＋cp 重建 skills＋驗證＋同步規則；命令用本機 `claude plugin --help`／`marketplace list`（v2.1.252）核實。
- 未提交（用戶要求＋硬規則）。

## 教訓
- 跨工具 skill 同步現在是三處：`.agents/skills/` ↔ `.claude/skills/` ↔ `.opencode/skills/`（後者還欠兩檔）；工具層差異允許不同，內容改動必須三處同改。
