# 2026-11-28 遇見電郵找人與匹配度（UR I.4，migration 0098）

- 電郵在 `auth.users`：用只給 service_role 的 SECURITY DEFINER 函數查；是否允許在函數裡判斷。
- `users` 行本人可直接 UPDATE（0006），次數上限要放只有服務端能寫的表。
- 「不送 AI」包括內容審核（OpenAI／MiniMax）；兩個入口（`/search/plan`、`/meet/search {query}`）都要先抽電郵。
- 查不到與未開啟必須回包相同，不回 stats／relaxed。
- 法律頁版本號與兩端 `currentVersion` 鎖在一起（`lib/legal.test.ts`），升版會觸發 App 重新同意。
- 未驗：0098 未在任何資料庫執行。
- 法律文字有三份：web `content/legal`、iOS `Resources/Legal`、AOS `assets/legal`；改完整檔覆蓋兩端，並同步三處版本常量。
