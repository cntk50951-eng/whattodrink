# 2026-09-05: squash 合併後的長壽分支必有重複衝突

## 情境

`feat/ur1.1-drink-map` 經 PR squash 合併進 main 後，分支上再推新 commit 開新 PR，
GitHub 報衝突——即使內容完全一樣。

## 問題

squash 改寫了 SHA，分支與 main 失散：同內容、不同歷史，
GitHub 每次都把相同位置算成衝突（本次 5 個檔全中）。

## 原因

長壽分支＋squash merge 是合法組合，但每個後續 PR 都要重解一次
相同的文本衝突；且 `git checkout --ours`＋`git add -A` 順手會把
工作區其他未提交雜物掃進 merge commit（本次差點把 camera／backlog／
全部 untracked 推進去，靠 `reset --soft HEAD^1` 救回）。

## 修正

1. squash 策略下，分支合併一次就刪（或每單開新分支），不要養長壽分支。
2. 解衝突時逐檔 `checkout --ours`＋具名 `add`，絕不用 `add -A`；
   解完用 `git diff <base> <merge> --name-only` 驗收零雜物。
3. 誤收進 merge commit 時：`reset --soft HEAD^1`＋`reset` 可無損回退重做。
