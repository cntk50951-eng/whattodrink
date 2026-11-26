# 2026-11-26 / 舉報分流：只有公開檔案的用戶舉報不自動結案、頭像實際送審

- 模塊／關鍵詞：`lib/reportTriage.ts`、`lib/api/reportStp.ts`、`app/api/v1/cheers/reports/route.ts`、MiniMax、avatars bucket、report_resolved。
- 現象（iOS DEF-20261126-009／010）：舉報用戶後幾秒內收到「已提交」「已審核完畢」兩條，看不出是哪宗、結果是什麼；團隊問送 MiniMax 的頭像／暱稱是否合理。
- 根因：①頭像存的是 avatars bucket 的 https 公開連結，route 只收 `data:image/` → 頭像從未送審（95fe0e8 的 commit 訊息說「帶頭像」但實際沒有）；②沒附聊天的用戶舉報只送暱稱＋簡介，正常檔案得分 ≤0.10 → 秒級自動結案「未發現違規」，騷擾多發生在聊天／酒局現場，這樣結案不合理；③`report_resolved` payload 不帶對象名。
- 修：`routeReport({profileOnly})` 低分不結案（`profile_only` 轉人工，≥0.85 仍可處分）；`avatarStoragePath` 解析公開連結 → 背景從 avatars 下載送審（聊天圖優先佔 4 張名額）；`applyReportDecision`／補發路徑寫 `actor_nickname`（未傳就查 users）。`rewrite()`／override 是合併 payload，名字會保留。
- 教訓：審核鏈改動要拿一條真實數據形態核對（URL vs data URL），不要只看類型；「AI 判乾淨」只能在 AI 真的看到被舉報行為時才可當結論。
- 用戶定（同日）：MiniMax `input_sensitive` 平台攔截原本硬給 0.95 直接自動處分 → 一律轉人工（`platform_blocked`），遊戲房不自動撤回只標 ai_flagged。識別靠 `minimax:` 類別前綴（模型回包同前綴丟掉防冒用）。
- 待辦：個資（暱稱／簡介／頭像／聊天）送 MiniMax 的跨境披露，確認私隱政策已寫。
- 同日加酒局舉報（0093）：沿用 cheers_reports，`asReportTargetType` 收口所有 target_type 判斷——舊寫法 `post||message ? x : "user"` 會把新類型靜默當 user，新增類型時要全倉 grep。`lib/push/send` 依賴 `@/` 別名，被 reportStp 靜態引入會讓其單測載入失敗 → 動態 import。
