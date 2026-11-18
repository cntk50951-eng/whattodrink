# 2026-11-17 / AOS推送啟用聯調（D.12／DEF-20261116-003）

## 情境
- 用戶回報已完成Vercel Production PUSH_DISPATCH_SECRET及SupabaseVault push_dispatch_secret配置（前文步驟2、3），貼回secret_exists=true、secret_length_ok=true。URL之前亦由用戶回報已配置。

## 問題／原因
- 原本job6報push cron configuration missing；此前兩個Vault配置都不存在，後又遇共用CRON_SECRET無法讀回。web3f0929f已部署推送專用Secret支援，其他cron沿用共用值。

## 修正／目前證據
- Vault Secret存在及長度已確認（用戶SQL結果）；Vercel配置／redeploy依用戶完成步驟2回報，agent未讀任何真密鑰或修改正式配置。
- 此兩欄不證明Vercel／Vault值一致、URL有效、cron runtime或HTTP成功。下一步等下一分鐘後只讀查job6最近run；再核對對應HTTP，不能憑Secret存在將缺陷標Verified或宣稱推送已可用。
- 手機仍按用戶指令暫停裝機／ADB；未真機送達。前情：2026-11-16-aos-push-outbox.md；Defect／D.12保持Fixing／WIP。

## 配置後job6仍失敗（用戶UTC08:04／08:05／08:06紀錄）
- 證據：仍為push cron configuration missing，wake函數line7 RAISE；這是HTTP前的Vault guard，不是HTTP401或FCM發送失敗。
- 先前只收到secret_exists／secret_length_ok兩欄true，URL只有用戶口頭已設、沒有SQL結果；不能把Secret兩項通過當所有配置通過。上一輪直接重查cron應先補驗URL，已修正排查順序。
- 下一步用supabase/push-dispatch-readiness.sql以與wake相同URL regex重查五個boolean（包括URL存在、格式、正式endpoint）；不顯示任何Secret。具體URL錯項待結果，先不輪替密鑰／redeploy／重建job／更改函數。若全true仍fail，再核對實際函數與讀取角色／時間，不盲改。
- 同一web DEF-20261116-003持續Fixing，沒有新建重複defect、沒有變更正式配置或手機。

## 五欄確認URL缺失（2026-11-17）
- 用戶最新只讀結果：url_exists=false／url_format_ok=false／url_correct=false，secret_exists=true／secret_length_ok=true。確認當前查詢的Vault仍沒有可讀的push_dispatch_url；Secret兩項通過，還不能推斷兩端值一致或HTTP已成功。
- 根因定位後準備supabase/push-dispatch-set-url.sql：只將公開URL按固定名稱建立或更新（先查vault.secrets ID，再create／update），不讀回密鑰、不改push_dispatch_secret、不重跑0077或建立job。正式執行仍由用戶Dashboard完成，尚無成功回報。
- 用戶執行成功後再跑只讀readiness五欄全true，等下一分鐘查job6最新status，再核對HTTP；同一DEF-20261116-003維持Fixing，手機暫停。

## URL修正後Vault五欄全true（2026-11-17）
- 用戶已執行push-dispatch-set-url.sql，貼回url_exists／url_format_ok／url_correct／secret_exists／secret_length_ok全true。URL公開配置建立／修正已確認，Secret不曾由agent讀取。
- 下一步請用戶明確執行SELECT public.wake_native_push_dispatch() AS request_id；此為一次實際派發喚醒（可能處理待發事件），不是只讀查詢。回傳值是pg_net request ID，尚不代表HTTP200或FCM送達；之後按同ID查net._http_response，避免拿其他cron的HTTP結果誤判。
- 最後仍須確認job6新run及真機送達。DEF-20261116-003維持Fixing，手機依用戶要求暫停。agent沒有執行正式SQL或手動發送。

## 手動wake回傳request_id482（2026-11-17）
- 用戶執行public.wake_native_push_dispatch()成功回傳482，證實本次函數已通過Vault guard並將HTTP請求交給pg_net；不能單憑ID認定HTTP200、provider接受或真機送達。
- 下一步只讀查net._http_response WHERE id=482，僅status_code／timed_out／error_msg／content，不讀headers或request queue密鑰。此ID由本次wake取得，避免混入其他job的HTTP結果；若尚無回覆等候後重查。
- 仍待HTTP、job6自動run與真機；原手機暫停不變，沒有由agent觸發正式SQL或推送。

## request482 HTTP200、空批次正常（2026-11-17）
- 用戶查net._http_response id482：status_code200、timed_out=false、error_msg=null；content claimed/sent/skipped/retry/failed全0。
- 已證實本次SupabaseVault守衛、pg_net→Production HTTPS、PUSH_DISPATCH_SECRET認證及後端producer／claim RPC完成。claimed0僅代表本批無可領取事件，不保證整張queue永遠空；sent0正常，不是發送失敗。
- 本次未呼叫FCM provider（沒有claim事件），不能據此認定服務帳戶發送權限或真機送達已驗。下一步只讀查job6自動run的最新status；成功後可確認本次cron配置缺陷解決，D12全功能／真機UR仍WIP。
- agent未查真密鑰或操作裝置；手機仍按用戶指令暫停。

## 自動cron連續三次成功，配置缺陷驗證通過（2026-11-17）
- 用戶回報job6於UTC08:22／08:23／08:24三次status=succeeded、return_message=1 row。這表示自動wake正常完成並提交HTTP請求，不將1 row誤認為送出一條通知。
- 綜合證據：核心物件與jobactive全true、Vault五欄全true、手動request482 HTTP200（空批次正常）、自動cron連續成功。web DEF-20261116-003配置問題置Verified，未經用戶close不置Closed；D.12全功能仍WIP。
- Supabase配置這部分無需再建表／重建cron／新增Secret。仍待有實際事件的FCM provider發送、真機權限／接收／點擊／切帳號及22項矩陣；目前空批次未證實FCM發送權限。手機依原指令繼續暫停。
- 以上為用戶提供SQL結果與先前已核實部署資料；本輪不執行正式SQL、不讀Secret、不操作ADB。
