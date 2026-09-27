# 2026-09-05: 任務收尾必清臨時文件（用戶常駐指令）

## 情境

用戶明確指示：「每次開發完成之後，臨時生成的文件如果不需要了，你要去清理」。

## 問題

`.memory/2026-09-04-task-cleanup-rule.md` 已有「收尾刪 /tmp scratch」
的規範，但本輪仍漏了一個：`/tmp/whattodrink-dev.log`
（setsid 啟動 dev server 失敗那次留下的空 log）。

## 原因

清理只在「記得」時做，沒有放進任務收尾 checklist 的固定動作；
且只想到 workspace，沒掃 /tmp。

## 修正

1. 收尾固定兩掃：工作區 `git status` 看雜物＋`ls /tmp` 看本輪殘留；
   只刪本 session 建的、交付物／memory／CHANGELOG／用戶點名要留的不碰、
   非本 session 的（如 warp 的 log）不碰。
2. 本輪已清：`/tmp/whattodrink-dev.log`（rm）；`warp_docktile` 系統 log 保留。
3. 此條為常駐指令，後續每個任務收尾執行並在回報裡交代一句。
