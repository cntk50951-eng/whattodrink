# 2026-09-26 OpenCode harness 分工糾正：gates 照跑、瀏覽器免測

## 情境

三模式任務開工時引用 `.opencode/skills/harness-workflow/SKILL.md`（OpenCode 版），其 Step 10／gates 寫著「OpenCode 跳過自測，build／lint／test 均由用戶手動跑」。

## 問題

用戶糾正：`npm run build`／`lint`／`test` 照做（由 agent 跑），只有瀏覽器本地驗證交給用戶，不要用 playwright／agent-browser 自測。

## 原因

`.opencode` 版 skill 與 `.agents`／`.claude` 版寫的不一致：後兩者早已是「gates 由 agent 跑、瀏覽器由用戶驗」，只有 `.opencode` 版寫成全部跳過。AGENTS.md 要求三處鏡像同步，但當初改寫 OpenCode 版時把 gates 也一併豁免了，屬於同步改寫過頭。

## 修正

- `.opencode/skills/harness-workflow/SKILL.md` 已改：Step 10 明確分工（agent 跑三閘全綠 → 提示用戶開瀏覽器自驗 → 等 OK → 拿 commit 確認 → 才提交）；gates 節改為 agent 照跑不跳過；唯瀏覽器驗證交用戶手動。
- `.agents`／`.claude` 版原本即對齊，本次只讀驗不改。
- 之後三處任一改動都要對讀另兩處再下筆，避免再次單邊漂移。

## 關聯

- 涉及：`.opencode/skills/harness-workflow/SKILL.md`（Step 10 summary＋Pre-commit gates 兩節）
- 教訓：跨工具 skill 同步時只允許工具調用層差異，gates 責任歸屬不算工具差異，不許單邊改。
