# 2026-11-02 · 用戶／帖子／聊天訊息舉報進後台隊列

- 模塊 cheers／ops 關鍵詞 舉報 cheers_reports 審核隊列 Apple 1.2 user-reports
- 需求：iOS 上架 Apple 1.2 要求 UGC 有舉報＋人工處理；原 `POST /cheers/reports` 只存不審、也沒有帖子／訊息級。用戶授權 iOS session 直接改 web。
- 做法：不新開表，擴 `cheers_reports`（0070：target_type／target_ref／reason_code／status／snapshot／decided_*）；純邏輯 `lib/userReports.ts`（解析、舊形狀兼容、排序、證據行）＋單測；路由按目標反查作者並留快照（訊息含前 5 條上下文）、24h 去重；後台 `/innerharbour/user-reports` 隊列＋詳情，照 `game-reports` 的門禁（白名單＋TOTP、viewer 只讀、寫操作先審計）。openapi 升 1.61.0。
- 要點：
  - 舊客戶端（只傳 target_user_id＋reason）照常可用；`reason` 形如 `harassment: 說明` 會拆出 reason_code。
  - 作者不信客戶端：post／message 一律服務端按目標反查；舉報人用自己的 JWT 讀目標，RLS 保證只能舉報看得到的。
  - 插入策略改成只許 `status='pending'` 且 decided_* 為空，防客戶端直連 PostgREST 自填已處理。
- 踩坑：tsconfig target 不支持正則 `s` 旗標（TS1501），用 `[\s\S]`；openapi 的長 summary 用 `>` 折疊塊，別寫裸 `: `。
- 未做／待定：帳號層面處置（停權）要先有政策，現只記處理結果；沒有回覆時限承諾（不得在條款寫 24h，除非 Ops 認領）；通知舉報人處理結果。
- 狀態：0070 已由用戶在 Supabase 執行（2026-11-02）；`tsc`／lint／vitest 1033／`npm run build` 通過；後台頁面還沒在瀏覽器過目，上線後需用有 moderator 權限的帳號走一遍。
