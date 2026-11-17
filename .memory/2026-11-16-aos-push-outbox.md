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

## 發佈核對（2026-11-16）
+- 已commit／push：52f81ae9f506fbd90aa7ac256d1f7eb7731ac435（23files，只含D12及D11狀態更新）。GitHub Production deployment7846097392狀態success，Vercel6qcCYK6eg2ERAdyVX5jSYTZM8wJE；environment_url https://whattodrink-qmmgy4ln4-cntk50951-8657s-projects.vercel.app。原intro WIP仍留工作樹。
+- 精準index127檔／1297tests綠（完整工作樹128檔／1304tests）；並非帶intro額外7tests發佈。未執行0077／Vaultcron，未改正式Secret或SITE_LIVE，未發任何真推送。
+- 下一步用戶Supabase Dashboard SQL Editor執行supabase/migrations/0077_native_push_outbox.sql，成功再依FCM_SETUP完成CRON_SECRET／Vault與push-dispatch-cron.sql；手機恢復後照AOS PUSH_TEST_PLAN逐22項真機。AOS未提交／安裝最新包。

- 收尾：Production未授權POST dispatcher實測401 JSON unauthorized，正式首頁仍307→/coming-soon；沒有觸發投遞。已清本輪臨時腳本／gatelog／index快照／PGlite套件，保留repo驗證腳本、APK與build報告。手機temp APK依暫停ADB要求仍待日後清理。

- 最新聯調狀態（2026-11-16）：Android新APK安裝中裝置斷線、pm install無Success，結果未確認；用戶確認手機一直重啟，要求先記memory並暫停裝機。Supabase0077／Vaultcron仍未收到成功回報，不能將52f81ae部署成功等同22事件生產啟用／真機驗收。沒有新增正式DB／Secret／推送操作。

## cron用途澄清（2026-11-16）
+- 用戶問要跑哪些SQL、cron是否已建及是否僅補發。應明確回答：只有0077 migration＋push-dispatch-cron.sql兩份本輪SQL；正式DB未由agent執行，未核實cron.job存在。
+- 現行新pipeline沒有event後立即喚醒dispatcher掛點：messages／invites／notifications只transaction入outbox，每分鐘cron負責首次投遞、到期重試與時間型reminder／attendance產生。平時可多等約0–60秒，積壓／provider／網路會更久，不能宣稱聊天已即時或cron純兜底。
+- 好友申請／接受、碰杯、遊戲邀請仍走原API after即時嘗試／有限重試，未進新持久queue，cron不替這三family補發。若後續改即時派發＋cron兜底，需實際補即時喚醒並測試，不能只改文案。
+- 啟用順序0077→確認Vercel CRON_SECRET（與Firebase service account不同）／Supabase extensions與Vault兩個值→push-dispatch-cron.sql。job名native-push-dispatch，查cron.job核實；沒有動手機、正式SQL、Secret或排程。

## 用戶回報cron已建立（2026-11-16）
+- 用戶確認已執行cron SQL、返回schedule=6；按此腳本為cron.schedule回傳job ID6，屬用戶回報，尚未讀cron.job／run_details／HTTP結果核實。
+- 狀態更新：不再說cron完全未執行。0077 migration是否成功、Vault／Vercel CRON_SECRET及實際派發仍未確認；先讓用戶跑只讀readiness檢查，勿重複建立job或宣稱端到端完成。
+- 建立job不會驗證wake函數裡的Vault值或後端HTTP；cron run succeeded也只表示HTTP請求已入pg_net queue，仍需看net._http_response結果。agent沒有執行正式DB或裝置操作。

## 用戶回報readiness四項全true（2026-11-16）
+- outbox_ready／deliveries_ready／claim_ready／cron_active均true（用戶SQL結果）；確認核心表／claim RPC存在，job6 native-push-dispatch active。不再要求重跑建立SQL。
+- 尚未核實：cron.job_run_details實際status與return_message，及對應後端HTTP結果；四個存在／active旗標不能證明Vault可讀、Secret匹配、FCM憑證有效或真機送達。下一步只讀查job6最近執行紀錄，之後確認HTTP，沒有新建物件或觸發手動投遞。

## DEF-20261116-003／cron Vault守衛失敗
+- 用戶貼job6 UTC07:17/18/19皆failed，錯誤push cron configuration missing，wake函數line7 RAISE。已在web docs/DEFECTS落條Open→Investigating，關聯D.12；仍未修復。
+- 來源腳本確定守衛條件為endpoint NULL／regex不符，或secret NULL／char_length<16；在net.http_post之前返回，不能歸因Vercel／Firebase或手機。
+- 下一步只讀aggregate檢查URL／Secret存在與格式／長度，各輸出boolean，不回decrypted_secret；具體錯項待用戶結果。Vercel環境值不能視為已配置SupabaseVault。不用重跑0077或建立另一個job。
+- 教訓：先前readiness只驗物件存在／jobactive，未覆蓋runtime Vault值；應分開交代建立成功、job執行成功與HTTP成功。未讀Secret、未動手機／生產DB。

## Vault缺項確診（2026-11-16，DEF-20261116-003）
+- 用戶boolean結果url_exists／url_correct／secret_exists／secret_length_ok全false，證實兩個具名Vaultsecret都不存在，不是僅URL格式或長度錯誤；對應wake函數配置守衛。
+- 待用戶在SupabaseVault建立push_dispatch_url＝正式dispatcher HTTPS網址及push_dispatch_secret＝與Vercel CRON_SECRET相同、至少16字元的共用值。Vercel若無CRON_SECRET需先配置Production並redeploy；若已有則沿用，不任意輪替而影響其他cron。不用Firebase私鑰替代、不索取或輸出Secret。
+- 不重建0077／job6；補齊後等下一個每分鐘排程再查job6執行，然後確認HTTP。維持Investigating／WIP，配置未由agent修改，手機繼續暫停。

## Vercel舊Secret不可讀回的配置修正（2026-11-16）
- 用戶已配置push_dispatch_url，但舊CRON_SECRET無法讀回／複製；官方確認新Secret類型只可替換、不可取回，先前讓用戶複製舊值的指引不適用。
- 檢索CRON_SECRET亦供purge-accounts／meet-suggestions。推送新增PUSH_DISPATCH_SECRET優先，未設定才相容CRON_SECRET；明確空／短時拒絕、不回退。Vault仍叫push_dispatch_secret，不輪替共用Secret、不動其他cron。
- web契約1.67.1／認證／env範例／操作說明同改，沿本次推送原授權提交部署；不讀／產生／輸出真密鑰，不動正式Vault或手機。handler tests及完整gate／部署結果待補，缺陷端到端仍未驗收。
- 工具教訓：長多行patch漏行前綴會整批拒絕、未寫入；改程式逐行加前綴產生patch，不假定前段已落地。

- 專用Secret完整gate：build139頁、129檔／1312tests綠（新8項handler認證／fallback／failclosed）、lint0errors12既有warnings；技能code-review已自檢，github-api沿本次推送授權使用；只發佈本批push修正，intro工作樹保留。未碰真密鑰、Supabase或手機。
