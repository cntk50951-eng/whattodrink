# 2026-09-27 harness 新增版本指向門禁（v1／v2 先問再動）

## 情境

用戶指令：加一條 harness control 給三工具（Muse／opencode／Claude）——用戶提需求但沒說改 v1 還是 v2，一律先問。

## 修正

- `.harness/workflow.md` Step 1 加「版本指向門禁」 bullet（硬性：禁默認→Step 2 AskUserQuestion→拿答案才進 Step 4；免問例外純共用層／文檔／config＋留痕；违反返工）。
- 三 skill（`.agents`／`.opencode`／`.claude` 下 `harness-workflow/SKILL.md`）Hard rules 各加同一條（同語義；opencode 版工具調用層差異保留）。
- 四處已對讀驗同語義（agents==claude；opencode 僅既有工具措辭差異）。

## 關聯

- 上游指令：2026-09-27 用戶原話；隨 docs commit 合入 main
