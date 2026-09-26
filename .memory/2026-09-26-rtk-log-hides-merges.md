# 2026-09-26 rtk 包裝的 git log 不顯示 merge commit

## 情境

A.16 合併後用 `rtk git log --oneline` 確認 main，頂部始終是 `9f9cc48` 而非 merge commit，花 4 輪排查以為合併未生效。

## 問題

`git rev-parse HEAD`＝`54b846c`（GitHub 回的 merge sha），`git show HEAD` parents 齊全、訊息為 Merge PR #11——HEAD 本體正確，只是 log 不顯示它（`--first-parent` 同樣跳過）。

## 原因

`rtk` 包裝後的 log 輸出會過濾 merge commit 行（原因未深究，可能 alias／pager 層過濾）。

## 修正

以後確認合併用 `git rev-parse HEAD`＋`git show --no-patch --format='%H %P %s' HEAD` 對 sha，不用 log 頂行判斷。
