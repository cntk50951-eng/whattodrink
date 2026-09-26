# 2026-09-25 學到：pull --ff-only 不會清掉本地分支已存在的內容

## 情境
URC 1.0–1.4 工作完 commit + push 後，本地 main 落後 remote 19 commits。
pull --ff-only 同步後，用戶說他的 PRODUCT_BACKLOG.md 只有 URC 1.1——但實際
上 d0d7dcf（URC 1.3）還在 commit history 裡。

## 問題
URC 1.3 在 d0d7dcf commit 還在，但 merge feat/a16-stealth-mode 到 main
時（54b846c），conflict 解決時被手動 drop（merge 衝突解決時人手刪掉），
造成 commit graph 還在、文件內容卻消失。

ff-only pull 不會警告這種 content-loss merge。

## 修正
- 從 d0d7dcf `git show :docs/PRODUCT_BACKLOG.md` 撈回 URC 1.3 完整 block
- 用 Python 腳本插回 URC 1.2 跟 URC 1.4 之間
- 純文檔修復，零代碼變動
- commit + push（60d85d9）

## 教訓
**merge 後要 diff 文件實際內容**，不只是 commit graph：
- `git diff <remote-merge-base>..main -- <files>` 看實際差異
- 或 `git show main:<file> | grep -c <pattern>` 確認特定條目是否還在
- 看到 merge 衝突處理記錄要額外警覺，自動 drop 的 hunk 通常是目標

下次 git 操作後可以主動跑：
```
git grep "^\*\*URC" docs/PRODUCT_BACKLOG.md
```
驗完整 UR list 是否在，預防類似問題。