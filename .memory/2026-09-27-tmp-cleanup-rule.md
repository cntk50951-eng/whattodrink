# 2026-09-27 任務結束清 temp（用戶硬規則）

## 情境

用戶指令：每次任務結束後，清理本機 `/tmp` 下我產生的臨時文件（token／成本之外，磁盤與隱私 hygiene）。

## 範圍（只刪我建的）

- `vitest alias 探針`：`/tmp/probe.test.ts`（用完即刪；工作區副本同刪）
- `agent-browser 截圖`：`~/.agent-browser/tmp/screenshots/screenshot-<ISO>-*.png`（只刪本次兩張，舊的不碰）
- `dev server 日誌`：`/tmp/wtd-dev.log`（nohup 輸出；起 server 前先確認端口占用，避免重起 EADDRINUSE）
- `git worktree 驗證樹`：`/tmp/verify-main`（git 2.15 無 `worktree remove`，`rm -rf`＋`git worktree prune`）
- `拆車備份`：`/tmp/a20split`、`/tmp/c5split`（對方提交後即刪；提交前留著是救命繩）

## 不碰

- `/tmp/beer-ref/`、`/tmp/npm-cache/`、`/tmp/beer-wall.html`——並行插畫 dev 的進行中文件（skill 配方本來就放這），刪了等於毀人工作。
- 舊截圖與他人 session（`agent-browser session list` 先看再動；我的 session 用完 `close`）。

## 教訓

- 每輪收尾 9c 加一項：`ls /tmp | grep <本輪關鍵詞>` 驗刪（口說刪了不算數）。
- `rtk ls` 輸出無日期列——判斷歸屬用內容＋上下文，不要猜。

## 關聯

- 上游指令：2026-09-27 用戶原話「确保本地机器tmp下你所产生的临时文件在每次任务之后被清理」
