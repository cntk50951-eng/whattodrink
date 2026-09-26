# 2026-09-26 V1/V2 雙向隔離寫入 harness（EPIC C 硬規則）

## 情境

用戶指令：v2 改動不許碰 v1（硬性，進 harness）；同時團隊照常迭代 v1 不許受影響——相互隔離。同步四處：`.harness` 主本＋Muse／Claude／opencode 三 skill。

## 問題

- 原 harness 無隔離條款，v2 動工即有污染 v1 風險。
- 單向冻结不夠：v2→v1 要禁，v1→v2 也要保（共用層一改，v2 頁跟著動）。

## 原因

- v2 文件獨立（`app/[locale]/v2/...`＋自帶 css）只解決一半；另一半是共用層（`lib/`／`hooks/`／API）的變更方向。
- 解法：文件級隔離（v2 單＋v1 單，git status 自查）＋語義級隔離（共用層只做加法、向下兼容）＋雙回歸（一改兩驗）。

## 修正

- `.harness/workflow.md` Step 4 新增「V1／V2 隔離」小節（四條：v2→v1 零修改／v1→v2 零影響＋向下兼容／共用層雙回歸／提交自查）＋checklist 加一項。
- 三 skill（`.agents`／`.opencode`／`.claude` 下 `harness-workflow`）各加同一條 hard rule，指回主本小節＋backlog EPIC C。
- 純規範文檔，零代碼，不跑三閘（`[docs-only]` 口徑，隨下一單一起交）。

## 關聯

- 涉及：`.harness/workflow.md`、三處 `harness-workflow/SKILL.md`
- 上游指令：EPIC C 鐵律（backlog）；用户原話「硬性要求」「相互隔离」
