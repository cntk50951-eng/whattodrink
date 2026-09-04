# 2026-09-04: Muse Code skill 與 harness 對等安裝

## 情境

專案已有 Claude Code / opencode 的 harness 控制（`.harness/`、`CLAUDE.md`、`.claude/settings.json`、`.opencode/skills/` 下 3 個 skill），用戶要求為 Muse Code（Muse Spark）安裝同樣的 skill 與 harness control。

## 問題

三個位置不明，需先查清 Muse 的讀取約定，否則會建錯地方：

1. Muse 專案 skill 讀哪？實測 `muse init --dry-run` 顯示 Muse 只讀專案根 `AGENTS.md` 為專案規則；公開資料確認 project skills 位於 `.agents/skills/<id>/SKILL.md`（跨工具共享根，另相容掃 `.claude/skills`、`.codex/skills`）。
2. `.claude/settings.json` 的 7 個插件（frontend-design、superdesign、superpowers、context7、code-review、playwright、github）在 Muse 沒有 1:1 ID，硬建對等配置會是讀不到的假配置。
3. `muse skills list` 在本機 sandbox 下報 `failed to read skill file at /Users/yuki/.config/muse/skills: Operation not permitted`，無法用 list 驗證 project skills 是否被發現。

## 原因

- `.opencode/skills/` 是 opencode 私有路徑，Muse 不掃；必須另放 `.agents/skills/`。
- Muse 查 API / 瀏覽器 / 提問的工具與 Claude 不同（`web_search` + `web_fetch`、`agent-browser` skill、`request_user_input`），skill 內工具引用需改寫，不能逐字複製。
- sandbox 擋掉 `~/.config/muse/skills` 讀取，連帶讓 `skills list` 失敗；`skills validate <path>` 走專案路徑，不受影響。

## 修正

1. 複製（非搬移）3 個 skill 到 `.agents/skills/`，`.opencode/` 原樣保留；僅 `harness-workflow` 改寫工具引用（context7 MCP → `web_search` + `web_fetch`、`AskUserQuestion` → `request_user_input`），另加 `.agents/skills/README.md` 註明兩邊同步。
2. `AGENTS.md` 末尾加「Muse Code harness 對應」段（skill 位置、工具對應表、插件對應表）；不建 `.muse/settings.json`。
3. 驗證用 `muse skills validate .agents/skills/<name>` 逐個跑，不要依賴 `muse skills list`（sandbox 下不可用）。
4. 之後改任一邊 skill 時同步另一邊，避免漂移。
