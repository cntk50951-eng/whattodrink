# 2026-09-27 D.4 文案＋V2Home 被同樹回退事故（第三次，實錘）

## 情境

- 用戶報 MISSING_MESSAGE（`chatOfflineGroup`，zh-Hans）：D.4 新 key 全缺。
- 查證：代碼在（list 頁跑新碼故炸）、`messages/*` 三檔 D.4 keys 全無、V2Home pill 退役＋`?friend=` 全無——同伴側有 staged messages（26 行）＋持續寫盤（行數 418→390，5 秒內行號漂移）。

## 問題

- 同樹 last-write-wins 第三彈（前兩彈：batch3a 被吞、DEF-006 被回退）：同伴寫盤-profit 覆蓋我未提交 hunks；且 edit 工具在對方活躍寫盤時會「假成功」（報 applied 但文件即被覆寫，讀驗才現形）。

## 原因

- 同一工作樹無鎖並寫＋messages 是雙方高頻區；`git status MM`（staged＋unstaged 同時髒）即危險信號。

## 修正

- 恢復：三檔 keys（單 edit＋node require 即驗，三檔 ALL-PRESENT）＋V2Home 四 hunk（pill 導航＋退役＋`?friend=`，grep＋tsc 即驗）；lint 0 error／36 測綠。
- 流程要求（請用戶拍板）：① 同樹施工打招呼＋錯峰（寫 messages 前吼一聲）② 高頻文件改完 60 秒內 node/grep 即驗 ③ 我的 D.4 hunks 下次提交前重驗一遍（防再被覆）。
- 教訓：edit 成功≠落地——高頻並行下，**寫後即驗是強制步**（read/grep/node 三選一當輪做）。

## 關聯

- UR D.4 [WIP]（待複驗＋合入）；用户原三問之 Network 答案仍待回填（`/conversations` 回包定末句缺失是數據還是代碼）
