# 舉報與審核資料（iOS DEF-20261125-019〜024；openapi 1.71.0，遷移 0070／0090）

## 舉報人看到的（App「我的舉報」、動態「舉報」分頁）

| 頁面／用途 | 類型 | 當前來源 | 表映射 |
|---|---|---|---|
| 舉報列表一行：類型＋對象 | target_type: user／post／message；target_name、target_avatar_url；place_name（帖子） | `GET /api/v1/me/reports`（服務端反查 users／checkins） | cheers_reports.target_type／target_user_id／target_ref → users.nickname／avatar_url、checkins.place_name |
| 原因與補充 | reason_code: harassment／inappropriate／spam／underage／other；reason ≤200 | 舉報提交 | cheers_reports.reason_code／reason |
| 狀態膠囊 | status: reviewing／actioned／dismissed；stage: submitted／human_review／closed | `myReportStatus`／`myReportStage`（lib/api/myReports.ts）由 status＋ai_decision 推導 | cheers_reports.status（pending／reviewed／actioned／dismissed）＋ai_decision |
| 誰審核 | decided_by: system／staff | 推導（AI 自動＝system；有 decided_by 或人工＝staff），不回審核人 id | cheers_reports.decided_by／ai_decision |
| 結果說明 | decision_note ≤200 | 系統預設文案或後台填寫 | cheers_reports.decision_note（0090） |
| 處理進度 | timeline: [{step, at}] | `GET /api/v1/me/reports/{id}` 推導 | created_at／ai_checked_at／decided_at |
| 舉報時的內容 | evidence: [{who, kind, text, at}] | 提交時服務端快照（不信客戶端文字）；已處理案件 7 天後清空 | cheers_reports.snapshot |
| 動態通知 | report_submitted／report_resolved（舉報人）；post_reported／post_actioned／report_actioned（被舉報人，匿名） | notifications，payload.report_id | notifications.kind／payload |

**不給舉報人**：AI 分數、AI 類別、轉人工原因、審核人身份、被舉報人的其他舉報數。

## 後台與系統使用（不出現在 App）

| 用途 | 類型 | 當前來源 | 表映射 |
|---|---|---|---|
| AI 初審結果 | ai_decision: auto_actioned／auto_dismissed／human | `routeReport`（lib/reportTriage.ts） | cheers_reports.ai_decision（0090） |
| 置信度 | ai_score 0–1（OpenAI category_scores 最大值；Minimax 兜底為 NULL） | OpenAI omni-moderation | cheers_reports.ai_score |
| 命中類別／轉人工原因 | ai_categories text[]；ai_route_reason | 同上 | cheers_reports.ai_categories／ai_route_reason |
| 客服郵件 | support_emailed_at | Resend REST（先 CAS 佔位再寄） | cheers_reports.support_emailed_at |
| 改判前的帖子可見性 | hidden_prev_visibility | 自動／人工處分下架時記錄，供改判不成立時還原 | cheers_reports.hidden_prev_visibility（0091） |

門檻：≥0.85 自動處分、≤0.10 且未標記自動結案；spam／underage／other、AI 不可用、無內容一律人工。
