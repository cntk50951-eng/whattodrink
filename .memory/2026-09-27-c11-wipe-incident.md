# 2026-09-27 並行丟失事故（誤報更正）：C.11 代碼全在

> ⚠️ 本篇前半是誤診，保留作記錄，結論以追記為準。

## 情境

- C.11 全量改完未提交（分支 `feat/c11-trail-oneclick`，髒樹裸奔）：V2Home／V2MapView／css／backlog／CHANGELOG＋lib／memory。
- 10:33–10:34 並行線切分支＋提交（`875c9b4` C.7 fix）＋切回＋pull；之後我樹上 C.11 代碼大面積消失。

## 問題（forensics，reflog＋git show＋逐文件驗）

- 丟失：V2Home C.11 hunks／V2MapView C.11 hunks／css dash＋pulse／backlog C.11 節／CHANGELOG C.11 塊（grep 零命中）。
- 倖存：lib/trail.ts＋test（parseTrailResume）、memory 筆記（untracked 免死）、backlog 是 sibling 的 +24（非我的塊）。
- `875c9b4` 只含 C.7 六文件——我的東西沒被吸入，是被**清掉**（revert／conflict 取對方／`checkout --`，機制未完全定罪；stash list 空）。
- 伪警兩則：① rtk grep `\|` 按字面處理致誤報零命中，改原生 `git grep` 才看到真相；② `read` 尾部幻影行（已另記）。

## 原因

- 根因：C.8 教訓重演——未提交的 tracked 改動在並行髒樹下無保護。上次是被吞（batch3a），這次是被清。
- 次因：V2Home／V2MapView／css／backlog／CHANGELOG 正是並行線也在改的文件，重疊面 100%。

## 追記：誤報（原生 git grep 逐 marker 驗證）

- **C.11 代碼全在**（fitPoints／handleTrailTab／stopsOpen／wantReturnTo／dash 全命中，僅 v2heat 缺席＝本來就沒寫）。
- 誤診鏈：① `read` 吐出**陳舊快照**（舊 trail 塊＋尾部幻影行）；② `rtk grep \|` 按字面致零命中誤報；③ 兩者疊加推出「被清」。
- 真教訓：`read` 可陳舊，**原生 `git grep` 才是真相源**；以後凡「代碼不見了」先原生 grep 全 marker 表再下結論。
- 真實並行狀態：main 被推前到 PR #26（C.12 捏合）；樹上是「我的 C.11 未提交＋同伴新髒」的疊加態——提交前逐文件驗 hunks（C.8 配方）。

## 關聯（原結論作廢）

- UR C.11 [WIP] 文檔節實測仍在（backlog marker 命中）；分支 `feat/c11-trail-oneclick` 仍在；下一步＝熱力呼吸（v2heat）直接開工，無需重寫
