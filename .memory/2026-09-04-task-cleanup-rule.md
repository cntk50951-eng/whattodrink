# 2026-09-04: 任務結束必須清理本輪臨時文件

## 情境

用戶明確指示：「在 harness（muse 的）中加一個，每次任務結束，都應該清理本輪任務產生的臨時文件」。

## 問題

之前任務在 `/tmp` 留了一堆 scratch（截圖腳本、校驗片段、下載的 Stitch 參考圖、API 回包），無人清理會越積越多。

## 原因

原 `harness-workflow` skill 只有「臨時文件放 /tmp、不要進版控」，沒有「收尾刪除」一步。

## 修正

1. `.agents/skills/harness-workflow/SKILL.md` 新增 `## Cleanup — end of every task`：交工前刪本輪 `/tmp` scratch 與 workspace 雜物，按精確路徑 `rm -f`；deliverable、memory、CHANGELOG、用戶點名要留的不刪；非本 session 建的、不在任務範圍的不碰。
2. 只加在 muse 側 skill（用戶指定範圍），共享 `.harness/` 不動。
