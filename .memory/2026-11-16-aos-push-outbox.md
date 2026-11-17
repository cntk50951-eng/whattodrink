# 2026-11-16 / AOS完整業務推送outbox（UR D.12）

## 情境
用戶授權完整AOS推送後端工作；以AOS A01～A22 checklist為準，iOS保留既有APNs，新增事件先不發iOS。D.11已是FCM基礎通道，不能繼續說Android沒有SDK／後端通道。

## 問題／原因
前台輪詢／站內通知不代表背景push；after並非持久隊列。消息與invites缺送達事件，member_joined／complaint_ack／response_needed沒有實際producer；出席通知要GET才生成，1h提醒只有手工cron範例。FCM notification自動展示不能由App先檢查當前帳號。

## 修正
OpenAPI1.67定data-only字串契約（recipient_id／event_id／epoch-ms expires_at／collapse_id及導航ID）；0077建立transaction trigger outbox＋delivery，claim使用SKIP LOCKED／3min lease／8次退避；dispatcher AOS-only，source與privacy查詢fail closed、每設備成功記錄避免部分重試重發。生產者補齊member_joined、投訴ack／response；1h及結束24h出席由每分鐘producer生成，原lazy GET共用。舊三family after保留，只補Android真實來源row事件ID／帳號／到期，不宣稱那些family也已持久化。

## 教訓／驗證與後續
- provider接受後DB記錄前可中斷，無法網路exactly-once；event_id重試不變，Android必須去重和核對recipient。鎖屏copy通用，不收聊天body／坐標／證據／自由文本。chat_mutes是刪好友pair禁言，conversation_members.muted才是單會話免打擾，兩者皆查。
- messages插入後才更新conversation.expires_at，所以enqueue不能用插入當下舊expiry丟事件；派發時查最新。game_join_result實際decision是approved/rejected。declined邀約通知是本次明確清單要求的行為更新（舊注釋稱靜默）。
- 用戶必須自己在Dashboard執行0077與push-dispatch-cron.sql、配置Vault與Vercel CRON_SECRET；沒有寫正式DB、沒有代設cron或Secret，不需新增付費Vercelcron。unique提醒索引如遇舊重複應調查，勿盲刪。
- 本地專項outbox15＋reversePending路由3＝18測試綠（隱私、已讀／mute、陌生偏好、過期、投訴已回應、部分設備重試）；整體gate由主代理跑。未真實FCM送達／未真機／未SQL啟用；未commit／push。設置與觀測看docs/FCM_SETUP.md，資料見docs/data/push-devices.md。

- 工具／相容修正：相鄰repo唯讀執行tsc會嘗試寫tsconfig.tsbuildinfo而EPERM；只讀型別檢查用--incremental false。attendance新RPC在0077未跑時僅PGRST202／42883回退舊producer，其餘DB錯誤不假裝成功、不重走雙寫。

- 覆蓋修正：POST /friends reversePending互相請求自動接受原本漏發；本輪加awaited after且aosOnly，不擴iOS原掛點。outbox每事件用computeBadge共用角標算法，notice／game不私加數字。

- 主代理用臨時PGlite真PostgreSQL驗證0077：apply／replay、message／join／invite／complaint triggers、reminder／attendance去重、claim不重疊＋lease重領、RPC權限與過期dead均通過；沒有連正式DB，沒有向專案加runtime依賴。

## 主代理整體gate與發佈範圍
- web完整build139頁；128檔／1304tests綠（D.12新增19項含FCM TTL／dataonly），lint0errors／12既有warnings。精準index snapshot另行測試，避免把intro WIP當本次發佈內容。
- scripts/verify-push-outbox-sql.mjs保留可重跑PGlite SQL整合案例，臨時套件不加入project runtime；無正式SQL／Vault／cron／真推送操作。AOS747tests及assemble過，lint25既有error，待真機。
- 用戶授權本次web API commit／push觸發Vercel，僅本批push files與D12台帳；intro M8/M9仍不提交。D11 fb17dcf已推送且Vercel success；D12實際部署SHA／狀態在後續核對，不以本機gate代稱已部署。
