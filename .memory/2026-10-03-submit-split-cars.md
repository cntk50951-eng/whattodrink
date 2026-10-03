# 2026-10-03 — 三车合流提交（split-car + 同树事故复盘）

## 情境

- 用户令一次过提交：我方 car-1（004＋D.8）／car-2（E.10 端点）／car-3（E.10 UI），同事 E.9 未提交货同树交错。

## 问题

1. 手拼 patch 全灭：凡手敲上下文（含空行）的 patch，`git apply` 全部 `does not apply`；唯 `git diff` 原生 hunk 能过。烧掉约 40 轮排查（含误报：被截断输出骗了三次，`echo $?` 显示字面量、`head` 吞掉 error 行）。
2. 同树顺走半截货：同事合入时把我 004 detail 吞了 10 行进仓（无头无表行，DEF-20260926-016 同款再演）；另有一次把我整段 E.9 误删 Binh——实为我自己脚本 bug（`findIndex` 回 -1 照删），非同事所为，查清。
3. 重建了他人的两处东西：home-map §十二（8 行，按早前读档＋代码语义重建）＋en `recentNext/photoNext` 两值（按 Hant/Hans 平行推断，`Photo post` 低置信）。以 best-effort 标待主验，不可当原文。

## 原因

1. patch 内容必须逐行来自实读（`git show :` 或 worktree 读档），手敲一个空行即死；且 `--check` 结论只信退出码落盘（`echo rc=$?` 写文件再看），不信截断输出。
2. 同树协作无 branch 隔离时，`git diff` 基准（index）会漂：读档→拼 patch→apply 之间文件即变。解法是 backup-dance（cp 备份→删他人行→原生 hunk 暂存→提交→cp 还原→验残留），全程可验、无算术。
3. 教训升级：`.harness` 应加一条——同树多 agent 时，提交前 `git status`＋hunk 归属 failing 即停手，把“谁的在动”先问清楚再拆车。

## 修正

- car-1 `60f88cc`／car-2 `ef1b968`／car-3 `dd73920` 已推，main 同步；006 随车转 Fixed；E.10 保持 [WIP]（用户喊停放一放）。
- 工作区残留经逐文件验全是他人货（E.9／005／hotfix／A.13／E.7-005／wantRecord／package-lock），一字未动。
