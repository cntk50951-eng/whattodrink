# Claude Code setup — plugins＋專案 skills（每台新機器跑一次）

> `.claude/` 整目錄被 `.gitignore` 忽略（本地狀態不進 repo），所以換機器／重 clone 後要重跑下面三步。本機（已配好）不用跑。
> 命令以下面實測輸出為準（Claude Code `2.1.252`，`claude plugin --help`／`claude plugin marketplace list` 核實）。

## Step 1 · 確認 marketplace

```bash
claude plugin marketplace list
```

輸出裡要有 `claude-plugins-official`（Source: GitHub `anthropics/claude-plugins-official`）。沒有才跑：

```bash
claude plugin marketplace add anthropics/claude-plugins-official
```

## Step 2 · 安裝 7 個 plugins（對應 `.claude/settings.json`）

```bash
claude plugin install code-review@claude-plugins-official
claude plugin install context7@claude-plugins-official
claude plugin install frontend-design@claude-plugins-official
claude plugin install github@claude-plugins-official
claude plugin install playwright@claude-plugins-official
claude plugin install superdesign@claude-plugins-official
claude plugin install superpowers@claude-plugins-official
```

## Step 3 · 重建專案 skills（`.claude/skills/`）

`.agents/skills/` 有提交，`.claude/skills/` 沒有——從前者複製，再改 5 處工具層字眼（Muse 寫法 → Claude 寫法）：

```bash
cd /Users/yuki/Desktop/whattodrink
mkdir -p .claude/skills/harness-workflow .claude/skills/code-review .claude/skills/github-api .claude/skills/beer-icon
cp .agents/skills/harness-workflow/SKILL.md .claude/skills/harness-workflow/SKILL.md
cp .agents/skills/code-review/SKILL.md     .claude/skills/code-review/SKILL.md
cp .agents/skills/github-api/SKILL.md      .claude/skills/github-api/SKILL.md
cp .agents/skills/beer-icon/SKILL.md       .claude/skills/beer-icon/SKILL.md
```

複製後在 `.claude/skills/` 副本上手改（`.agents/` 原件不動）：

| 檔案 | 原句（Muse） | 改成（Claude） |
|---|---|---|
| `harness-workflow/SKILL.md` | ``read_skill` tool … `bundled://`…` 註解行 | `Skill tool … files exist under `.claude/skills/`` |
| `harness-workflow/SKILL.md` | ``web_search` + `web_fetch`` | ``context7` plugin` |
| `harness-workflow/SKILL.md` | ``via `read_skill` (`stitch-design`…` | ``via the Skill tool (`stitch-design`…` |
| `harness-workflow/SKILL.md` | `request_user_input for final commit confirmation` | `AskUserQuestion for final commit confirmation` |
| `code-review/SKILL.md` | `use the agent-browser skill to screenshot` | `use the `playwright` plugin to screenshot` |

## 驗證

```bash
claude plugin list          # 7 個都在、Status 為 enabled
ls .claude/skills/*/SKILL.md  # 4 個檔案都在
```

然後在專案根目錄開 `claude`：`CLAUDE.md` 會自動載入，harness 流程（`.harness/`＋`harness-workflow` skill）與 Muse 側一致。

## 同步規則

- 改任一邊的 skill 內容時，同步另一邊（`.agents/skills/` ↔ `.claude/skills/`）；僅上表這類工具調用層差異允許不同。
- 加新 plugin：先 `claude plugin install`，再把名字寫進 `.claude/settings.json`（本機檔案，未提交——換機器靠 Step 2 重裝）。
