# 2026-09-27 — E.1 提交合併＋split-car SOP 定稿

## PR #38 `719fa39`＋PR #39 `ccf0ebc`（E.1 代碼＋mark done，均已合入）
- split-car 全流程（混樹，隊友 D.4/F 實時施工）：裸 `git diff`（`rtk git diff` 重定向會吃 `@@/+-` 前綴，不可用於 patch）→ python 按內容標記分 hunk（V2Home 8/13 我方，BACKLOG 1/2，wantRecord 全我方，messages MIXED 單獨重放）→ checkout→apply→暫存→分支態驗 tsc→提交→PR→合併。
- messages 重放：cam key 在 **v2 ns 尾部**（第一版腳本誤放 map，已糾正；以 `/tmp/keep` 工作樹為準對拍，差異應全是隊友項）。
- 教訓：json 全文件重寫前先看縮進（本倉 2 空格，diff 乾淨才敢寫）； teammate 的未提交改動原樣保留，提交信息註明。

## 同樹高危狀態（2026-09-27 晚）
- 隊友實時在線：施工中 D.4（conversations/read-status/friends）＋EPIC F（gatherings/＋dialog＋package.json 裝包）；stash 棧留二：keep2（messages 舊）、keep1（WIP 全套）——**別 pop 別刪**，恢復順序 keep2 先後 keep1，先問隊友（keep2/keep1 都碰 messages，可能衝突，由主人解）。
- 同步期間被擋三次（messages 連續髒）均為隊友實時寫入，非我方殘留。

## 下一个（建議）
- E.2（POST＋pins＋他人卡，需協調 C.10＋照片存法問答）或 D 驗收批；E 線 IG 級特效（MediaPipe）值得單獨立項先做 spike（包體積＋模型託管先驗）。
