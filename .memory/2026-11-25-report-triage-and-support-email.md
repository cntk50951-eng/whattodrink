# 2026-11-25 / 舉報閉環：AI 置信度分流＋人工審核郵件（iOS DEF-20261125-019〜024）

- 用戶定案：AI STP 處理；高置信自動，低置信轉人工並寄 support@whattodrink.app；dashboard 可更新人工結果；高置信無違規可自動結案並通知舉報人。
- 置信度＝OpenAI omni-moderation `category_scores` 最大值（`maxCategoryScore`）；Minimax 兜底沒分數 → 一律人工，不據此自動處分／結案。門檻常量在 `lib/reportTriage.ts`（0.85／0.10）。
- AI 判斷不了的理由（spam／underage／other）直接人工、不調 AI；用戶／訊息舉報審快照裡 who=reported 的文字，沒文字＝no_content 轉人工。
- 郵件：Resend REST（無 SDK），`Idempotency-Key`；先 CAS `support_emailed_at IS NULL` 佔位再寄，寄失敗清回 NULL；寄件網域須在 Resend 驗證，否則 403（錯誤記 `[needs-repair]`，案件照在人工隊列）。
- 推翻 AI 自動結案：0087 唯一索引讓舉報人第二條 report_resolved 23505 → 改寫原通知 payload（decision、note、updated）＋置頂未讀。反向（成立→不成立）要還原下架與誠信分，本期未做。
- 0090 未遷移時所有新欄位讀寫都 42703/PGRST204 降級，不擋舉報主流程。
