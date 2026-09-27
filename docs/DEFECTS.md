# DEFECTS — 统一缺陷管理

> 单一真相文档（Muse / Claude 双 harness 共用，见 `.harness/workflow.md` Step 7b）。用户提出 defect 关键词时当轮落条，Fix 关联 UR 走完整 10 步。

## 字段模板

| 字段 | 说明 |
|---|---|
| ID | `DEF-YYYYMMDD-001` 递增 |
| 标题 | 一句话概括 |
| 状态 | `Open → Investigating → Fixing → Fixed → Verified → Closed` |
| 严重度 | `P0 阻断 / P1 主要 / P2 次要` |
| 发现日期 / 报告人 | `YYYY-MM-DD / @who` |
| 复现步骤 | 1. 2. 3. ... 可复现的最小路径 |
| 期望 vs 实际 | 期望行为 vs 实际行为 |
| 初判根因 | 收到上报时的第一判断（可填 待确认） |
| 确诊根因 | 排查后确认的根因（含文件:行与证据） |
| 关联 UR | 修复所关联的 UR 编号（新建 `fix/defect-xxx` 或复用） |
| 修复验证 | 自动化/手动验证方式与结果 |
| 回归范围 | 影响面与回归用例 |

---

| ID | 标题 | 状态 | 严重度 | 发现日期 / 报告人 | 关联 UR | 确诊根因 |
|---|---|---|---|---|---|---|
| DEF-20250925-001 | 登出→重登录后打卡酒类消失，不再显示 | Closed | P0 | 2026-09-25 / @yuki | UR A.10 / fix/defect-20250925-001 | DB FK 缺 public.users 行 + 前端回显缺 INITIAL_SESSION（见详情，已验证） |
| DEF-20260926-001 | 模式切换按钮在页面上不可见 | Closed | P1 | 2026-09-26 / @yuki | UR A.16 | 按設計收合＋收合態零提示；常駐pill＋用戶驗收通過，已合入 main |
| DEF-20260926-002 | 隱身乾杯引導層被他人打卡卡蓋住 | Closed | P2 | 2026-09-26 / @yuki | UR A.16 | 收卡＋onSwitched恢復；用戶驗收通過，已合入 main |
| DEF-20260926-003 | 好友打卡 ME 不可見＋綠點全無 | Closed | P1 | 2026-09-26 / @yuki | UR A.17 | scope鏈路實證通（只看好友下pins出現）；綠點待心跳另立項；用戶驗收通過，已合入 main |
| DEF-20260926-004 | 點好友pin自動縮回全港視圖 | Closed | P2 | 2026-09-26 / @yuki | UR A.17 | 退役遠距同框改只飛對方；用戶驗收通過，已合入 main |
| DEF-20260926-005 | 真數據pin點擊不開卡 | Closed | P1 | 2026-09-26 / @yuki | UR A.17 | 共用映射＋開卡認apiPins；用戶驗收通過，已合入 main |
| DEF-20260926-006 | 點好友pin地圖卡死無反應 | Closed | P0 | 2026-09-26 / @yuki | UR A.17 | useMemo凍card identity；用戶驗收通過，已合入 main |
| DEF-20260926-007 | 拖圖自動關卡，用戶要僅X關閉 | Closed | P2 | 2026-09-26 / @yuki | UR A.17 | 刪dragstart關閉；用戶驗收通過，已合入 main |
| DEF-20260926-008 | 好友模式非好友無攔截＋守衛層級不保頂 | Fixing | P1 | 2026-09-26 / @yuki | UR A.19 | ModePrompt改portal＋z1100保頂；好友模式乾杯邀約加關係查（非好友僅公開鈕＋收卡恢復）；附带修真pin邀約認表；三閘綠待复验 |
| DEF-20260926-009 | 守衛文案不跟模式＋缺添加好友 | Closed | P1 | 2026-09-26 / @yuki | UR A.19 | 矩陣＋POST /friends＋乾杯豁免修正；用戶驗收通過，已合入 main |
| DEF-20260926-010 | v2 Button render缺nativeButton報錯 | Closed | P0 | 2026-09-26 / @yuki | UR C.1 | 4處補齊＋零殘留驗訖；用戶驗收通過，已合入 main |
| DEF-20260926-011 | v2 沿用v1配色未現代化 | Closed | P1 | 2026-09-26 / @yuki | UR C.1 | v2scope覆蓋＋去橘去黑到中性；用戶驗收通過，已合入 main |
| DEF-20260926-012 | v2首頁驗收返工（圖層級＋shadcn化＋全屏無footer） | Closed | P0 | 2026-09-26 / @yuki | UR C.1 | round-6止；用戶驗收通過，已合入 main |
| DEF-20260926-013 | v2自打卡面板無法換酒 | Closed | P1 | 2026-09-26 / @yuki | UR C.4 | v2 want 卡無換酒入口；C.4 沿 v1 全搬進底部 Sheet；用戶驗收通過，已合入 main |
| DEF-20260926-014 | v2打卡後酒圖標只顯示emoji無品牌圖 | Closed | P1 | 2026-09-26 / @yuki | UR C.4 | v2 want 卡寫死 emoji 圓＋快照直用；C.4 目錄取新＋BeerImg＋地圖釘圖；用戶驗收通過，已合入 main |
| DEF-20260926-015 | v2地圖釘 createRoot 同步 unmount 撞渲染期報錯 | Closed | P1 | 2026-09-26 / @yuki | UR A.20 | microtask 延後＋try/catch；用戶驗收通過，已合入 main |
| DEF-20260926-016 | Vercel main 部署紅（wall.ts 引缺失模塊） | Closed | P0 | 2026-09-26 / @yuki | 插畫並行線 | 部分推送：wall.ts／index.ts 接線先行，15 枚 .tsx 未進倉；`a8e28c2` 補齊樹後 worktree 驗 tsc 淨＋253 綠 |
| DEF-20260927-002 | locale 根首頁不跳 v2（/zh-Hans 落 v1） | Closed | P1 | 2026-09-27 / @yuki | UR C.7 | 跳轉判斷只認裸 `/`，as-needed 下語言根被放行；修為認段＋帶語言跳；單測＋4，七路實測，用戶驗收通過，已合入 main |
| DEF-20260927-001 | v2 他人打卡弹窗 UI 亂＋信息不全 | Fixed | P1 | 2026-09-27 / @yuki | UR C.10 | `openPin` 丟字段＋他人卡停 C.1 骨架（排查已實證，見詳情） |
| DEF-20260927-002 | v2 足迹脚印动画只播一次不循环 | Closed | P1 | 2026-09-27 / @yuki | UR C.11 | 動畫取消另立需求，本條關閉，見詳情 |
| DEF-20260927-003 | v2 关目录面板足迹动画跟着消失 | Investigating | P1 | 2026-09-27 / @yuki | UR C.11 | 关面板不碰trailOn（已枚举三处）；待用户给精确复现分支，见详情 |
| DEF-20260927-005 | v2 回位按钮无定位时点了解无反应 | Fixing | P1 | 2026-09-27 / @yuki | UR C.11 | V2Home 守卫拦掉调用，见详情 |
| DEF-20260927-004 | v2 地图页崩溃：trailRef is not defined | Fixing | P0 | 2026-09-27 / @yuki | UR C.11 | round-4 删声明漏清理＋并行重构带回悬空行，见详情 |
| DEF-20260927-006 | v2 實時位置（自／友呼吸釘）被打卡釘淹沒難辨 | Fixed | P1 | 2026-09-27 / @yuki | UR C.14 | 同層零層級已修（PR#29；親驗待補），见详情 |
| DEF-20260927-008 | v2 回位按鈕（回到我的位置）點了無反應 | Open | P1 | 2026-09-27 / @yuki | 待查 | 待确认，见详情 |
| DEF-20260927-007 | v2 點好友圓圈無反應（疑無好友數據可點） | Investigating | P1 | 2026-09-27 / @yuki | UR C.15 | 待确认（首嫌 friends 空：匿名／隱身／對方離線即零圓圈；見詳情） |

### DEF-20260927-002 locale 根首頁不跳 v2（/zh-Hans 落 v1）

- **状态**：Closed（2026-09-27 用戶驗收通過：七路實測全中，已合入 main）
- **严重度**：P1 主要（非默認語言用戶首頁永遠 v1）
- **发现日期 / 报告人**：2026-09-27 / @yuki
- **复现步骤**：開 `http://localhost:3000/zh-Hans`（或 `/en`）：落 v1 簡中首頁，不跳 v2
- **期望**：`/zh-Hans`→307→`/zh-Hans/v2`（帶語言）；`/?pick=1` 類深鏈照直通 v1
- **实际**：`resolveHomeTarget` 只認 `pathname === "/"`，`localePrefix as-needed` 下語言根全被放行
- **初判根因**：同上（as-needed  Path 結構漏考慮）
- **确诊根因**：同上。修為認 locale 段（`routing.locales` 傳入）＋帶語言跳（免 cookie 未種丟語言）；未知前綴／子路／查詢串一概不碰
- **关联 UR**：UR C.7
- **修复验证**：單測＋4（locale 根／尾斜杠／未知前綴／v1 檔）；dev 重啟七路實測：`/`、`/zh-Hans`、`/en`、`/zh-Hant`→307 對應 v2，`/v2`、`/zh-Hans/v2`→200，`/zh-Hans?pick=1`→200；三閘綠
- **回归范围**：proxy 全路由（v1 深鏈＋各語言根已覆蓋）；`routing.locales` 只讀引用

### DEF-20250925-001 登出→重登录后打卡酒类消失

- **状态**：Closed（2026-09-26 用户验证通过，已合入 main）
- **严重度**：P0 阻断（核心链路：打卡是 EPIC 1.0/3.0 主链）
- **发现日期 / 报告人**：2026-09-25 / @yuki
- **复现步骤**：
  1. 登录后通过 `今晚飲咩？` 选酒并打卡（`POST /api/v1/checkins` 201）
  2. 登出（`HeaderAuth` → `clearUserLocalCaches` + `LOGOUT_CLEAR_EVENT`）
  3. 重新登录（`signInWithOAuth` → `/auth/callback` → 回 `/`）
  4. 观察 `DrinkMap` 我的打卡/足迹与 `GET /api/v1/checkins/mine` 是否回显
- **期望**：重登录后 `DrinkMap` 应通过 `GET /api/v1/checkins/mine` 回显历史打卡（`WantRecord` 列表与地图 pin）
- **实际**：页面不显示任何打卡，疑似前端未展示或 API 未返回，或数据已被清
- **初判根因**：待确认 — 可能性：A) 前端 `LOGOUT_CLEAR_EVENT` 清理后未在重登录时重新 `fetch /mine`；B) `/mine` RLS/索引/时间过滤（`kind/expires_at`）导致已打卡被过滤；C) 登出时误删 DB 或 `clearUserLocalCaches` 误删持久化键
- **确诊根因**：**主因 DB FK（P0）**：`public.users` 缺行导致 `POST /api/v1/checkins` FK `23503`（`checkins_user_id_fkey`）失败后前端回退 `localStorage`，登出 `clearUserLocalCaches` 清本地即丢失；线上 `auth.users` 有 2 行（`testcheckins+…` 与 `cntk50951@gmail.com 424cfb87…`）而 `public.users` 仅 1 行（缺 Google 账号），`service` 直查 `checkins` 仅 3 行且全为 `private/flash` 旧测数据，`cntk50951` 无任何落库。根因是 `0006_auth_users_trigger_rls.sql` 的 `handle_new_user` 触发器未在 Google 账号创建前生效（该账号 `2026-09-23T15:25:46Z` 早于 0006 重放），需回填。**次因前端**：`DrinkMap.tsx:1101` 仅监听 `SIGNED_IN`，漏 `INITIAL_SESSION/TOKEN_REFRESHED` 且无 `isAuthed` 兜底，`USER_CACHE_KEYS` 未含 `wtd-pending-checkin`。
- **关联 UR**：UR A.10 打卡落库＋二次登录回显（原 WIP）/ 新建 `fix/defect-20250925-001` 走 10 步
- **修复验证**：`TSC 0 / lint 0 err / test 210 / build 30 页` 全绿；`DrinkMap` 扩 `onAuthStateChange` 至 `SIGNED_IN|INITIAL_SESSION|TOKEN_REFRESHED` + `useEffect [isAuthed true]` 兜底；`lib/auth/clear.ts` 补 `wtd-pending-checkin`；`app/api/v1/checkins` 补 `users` 缺行自动创建（`POST` 前 `select→insert`）；`service` 回填 `424cfb87… CnTK` 后 `POST flash/post` 均 `201 public`（`flash expires_at+24h`/`post null`），`GET /mine` 与 `select … order by created_at desc limit 10` 已见新 `public` 置顶；2026-09-26 用户 `fix了` 确认
- **回归范围**：`POST /checkins` 403 stealth、`kind` 双类型、`pins range`、`LOGOUT_CLEAR_EVENT` 清理、`WantRecord` 解析

### DEF-20260926-002 隱身乾杯引導層被他人打卡卡蓋住

- **状态**：Closed（2026-09-26 用户验收通过：卡收→层现→切公开→原卡回→乾杯生效，已合入 main）
- **严重度**：P2 次要（功能可达，層級遮擋＋斷流程）
- **发现日期 / 报告人**：2026-09-26 / @yuki
- **复现步骤**：
  1. 切隱身模式，點任一他人 pin 開打卡卡
  2. 點「乾杯」（或約喝酒）
  3. 观察「隱身模式僅可瀏覽」層位置
- **期望**：他人卡先消失→引導層居中→切公開／好友後原卡恢復續操作
- **实际**：引導層（`fixed z-[999]`）被錨定卡蓋在後面
- **初判根因**：待确认 — 層級（z）低於卡，或卡未收
- **确诊根因**：兩者皆是：`ModePrompt z-[999]` 低於錨定卡層級，且守衛只彈層不收卡。修為守衛先 `setSelectedId(null)`＋`pendingCardId` 記卡，切換成功 `onSwitched` 恢復（錨點按 render 重算，原位重開）；取消／登出清 pending，不恢復
- **关联 UR**：UR A.16（WIP，直接合入，另有關聯新 UR A.19 好友感知引導）
- **修复验证**：三閘全綠（test 220／lint 0 error／build 過；純組件態流轉，無新單測，口徑沿 testing.md）；待用户复验（隱身點乾杯→卡收→層現→切公開→原卡回→乾杯可點）
- **回归范围**：`ModePrompt`（MapHotBoard／PostDetail／camera 共用，僅加可選 `onSwitched`，默認行為不變）、登出清理、打卡 403 路徑（無卡不恢復）

### DEF-20260926-003 好友打卡 ME 不可見＋綠點全無

- **状态**：Closed（2026-09-26 用户验收通过：只看好友下pins出現，scope鏈路實證通；綠點待心跳另立項，已合入 main）
- **严重度**：P1 主要（A.17 驗收阻塞）
- **发现日期 / 报告人**：2026-09-26 / @yuki
- **复现步骤**：
  1. FRIEND 號打卡一張
  2. ME 號看地圖，找 FRIEND 的 pin → 看不到
  3. ME 看不到自己的閃動點，也看不到 FRIEND 的綠點
- **期望**：好友 pin 可見（對應 scope 下）；自己藍點＋好友綠點可見
- **实际**：好友 pin 無；自己點無；好友綠點無
- **初判根因**：待确认 — 可能性：A) FRIEND 以 friends 模式打卡＋ME 沒開「只看好友」（按設計本就不可見，非 bug）；B) RLS／0009 未生效致 scope 查空；C) self 點缺失是定位未授權（UR1.1 既有行為）；D) 好友綠點缺失是全庫無心跳寫入（已知缺口，isOnline 恆 false）
- **确诊根因**：待排查（先問三個判別問題）
- **关联 UR**：UR A.17
- **修复验证**：待定
- **回归范围**：pins scope、綠點規則、定位、只看好友鈕

### DEF-20260926-004 點好友pin自動縮回全港視圖

- **状态**：Closed（2026-09-26 用户验收通过：點pin飛達不拉遠＋開卡，已合入 main）
- **严重度**：P2 次要（能看不能聚焦）
- **发现日期 / 报告人**：2026-09-26 / @yuki
- **复现步骤**：
  1. 好友模式＋開「只看好友」，好友 pin 出現
  2. 點好友 pin
  3. 地圖自動縮到全港視圖
- **期望**：聚焦到該好友（飛過去＋開卡），視圖不應拉遠
- **实际**：視圖拉遠回全港
- **初判根因**：待确认 — 可能性：A) UR1.6 雙人同框按設計工作（有定位即 `fitBounds(自己, 對方)`，你離 HK 遠即拉遠，非 bug 是設計觀感問題）；B) self 座標髒數據致框算錯（真 bug）
- **确诊根因**：`handleFocusPerson` 遠距分支 `fitBounds(自己, 對方)`（UR1.6）：深圳→HK 約 30km 即拉到 z9。修為退役同框、一律 `flyTo(對方, max(zoom,14))`＋開卡；距離資訊由卡片距離行覆蓋（實時，不丟）；同框能力日後加卡內鈕（非破壞式）
- **关联 UR**：UR A.17（觸發自好友 pin；UR1.6 凍結條目已回寫改動記錄）
- **修复验证**：三閘全綠（232／lint 0 error／build 32頁；組件行為改動，用戶瀏覽器覆蓋）；待用户复验（深圳點HK好友pin→飛過去不拉遠＋開卡＋距離行在）
- **回归范围**：`handleFocusPerson`、UR1.6 雙人同框、定位

### DEF-20260926-005 真數據pin點擊不開卡

- **状态**：Closed（2026-09-26 用户验收通过：點真pin開卡＋乾杯可用，已合入 main）
- **严重度**：P1 主要（真數據鏈路開卡全斷；mock pin 不受影響）
- **发现日期 / 报告人**：2026-09-26 / @yuki
- **复现步骤**：
  1. 只看好友下真好友 pin 出現（scope 通）
  2. 點 pin（經 004 fix 後鏡頭飛過去）
  3. 無任何卡片彈出
- **期望**：彈出該好友打卡卡（酒／時間／地點／乾杯／邀約照常）
- **实际**：無卡（`card=null`）
- **初判根因**：開卡派生只認表
- **确诊根因**：`card` 派生只查 `MOCK_CHECKINS`（A.13 真數據接入時漏了開卡側）；真 pin id（UUID）在 mock 表永無命中 → `card=null` → 無卡、無錨點（`focusAt` 跟 card 走故也空）。修為抽 `apiPinToCheckin` 共用映射：pin 層與開卡同一函數（`now` 快照傳參，沿 UR3.3 impure 配方），開卡認 `MOCK → apiPins` 順序
- **关联 UR**：UR A.17
- **修复验证**：三閘全綠（232／lint 0 error／build 32頁；組件派生改動，用戶瀏覽器覆蓋）；待用户复验（點真好友pin→卡出＋乾杯／邀約可用）
- **回归范围**：mock pin 開卡（映射抽共用，行為不變）、想喝／self 卡、錨點、搖一搖聚焦

### DEF-20260926-006 點好友pin地圖卡死無反應

- **状态**：Closed（2026-09-26 用户验收通过：開卡＋地圖可操作，已合入 main）
- **严重度**：P0 阻断（主線程吃滿，地圖全凍；無報錯無網絡，極難從用戶側定位）
- **发现日期 / 报告人**：2026-09-26 / @yuki
- **复现步骤**：
  1. 只看好友下點真好友 pin（005 fix 後會飛過去）
  2. 地圖徹底凍死：拖不動、點不動；Console／Network 乾淨
- **期望**：開卡＋地圖照常可操作
- **实际**：主線程假死
- **初判根因**：005 修法嫌疑（此前 mock pin 無此現象）
- **确诊根因**：005 把 `apiPinToCheckin(...)` 直接放在 render 派生里，每 render 產新 `card` 對象 → view snapshot effect（deps `[mapReady, card, focusAt]`，`focusAt` 跟 card 走同樣每輪新）每輪 cleanup＋重跑＋`setView` → 新 render → 無限循環。MOCK 路徑因表引用穩定從不受影響，故此前無此現象。修為 api 卡 `useMemo([selectedId, apiPins])` 凍住 identity（`nowMs` 會話級穩定，故意不列 deps，卡開期間 onlineAt 凍結可接受）
- **关联 UR**：UR A.17
- **修复验证**：三閘全綠（232／lint 0 error／build 32頁；effect 循環類問題，用戶瀏覽器覆蓋）；待用户复验（點真pin→卡出＋地圖可拖可縮放）
- **回归范围**：mock／想喝／self 開卡（identity 語義不變）、錨點快照、搖一搖聚焦

### DEF-20260926-013 v2自打卡面板無法換酒

- **状态**：Closed（2026-09-26 用户验收通过：Sheet 內換酒點格即換＋兩段刪，已合入 main）
- **严重度**：P1 主要（自打卡核心編輯能力缺失）
- **发现日期 / 报告人**：2026-09-26 / @yuki
- **复现步骤**：開 `/v2` → 今晚飲咩 → 任選一酒落釘 → 點自家想喝釘開卡：卡上只有酒名＋時間，無換酒鈕
- **期望**：像 v1 快照卡有「換酒」鈕（同類候選批，點格即換）
- **实际**：v2 `V2Home.tsx:795-797` want 分支只回顯 sub，無任何編輯入口
- **初判根因**：C.1 只做了唯讀卡，換酒（v1 UR3.7 `swapWantBeer`／UR3.9 `pickSwapBatch`）沒搬過來
- **确诊根因**：同上。修為 want 釘改開底部 Sheet，換酒行＋兩段確認刪除全搬（`V2Home.tsx` 新 `wantSheetAt` 態＋handlers；共用純函數只讀調用零改動）
- **关联 UR**：UR C.4
- **修复验证**：待（換酒點格即換＋刷新持久＋三閘綠＋用戶瀏覽器驗收）
- **回归范围**：v1 快照卡（共用純函數只讀調用，零改動）、選酒 Sheet（不動）

### DEF-20260926-014 v2打卡後酒圖標只顯示emoji無品牌圖

- **状态**：Closed（2026-09-26 用户验收通过：Sheet 主角圖＋地圖釘圖皆品牌圖，已合入 main）
- **严重度**：P1 主要（品牌圖是 v2 核心賣點之一）
- **发现日期 / 报告人**：2026-09-26 / @yuki
- **复现步骤**：開 `/v2` → 落釘任選有圖的酒（如 Heineken）→ 點自家釘：頭圈只有 emoji（如🍺），無品牌圖
- **期望**：像 v1 快照卡主角位顯示品牌圖（有圖上圖，壞圖／無圖才退 emoji）
- **实际**：v2 `V2Home.tsx:752-754` 頭圈寫死渲染 `card.emoji`；`openWant` 直接用快照 `rec.beer.emoji`，不走目錄新鮮解析（DB 回退行 name＝beer_id、emoji＝通用🍺 更錯得徹底）
- **初判根因**：C.1 卡片只做了文字正規形（`V2Card` 無 beer 字段），`BeerImg` 只用在選酒 L2
- **确诊根因**：同上。修為 `resolveWantBeer`（按 `beer.id` 對活目錄取新→`beerByName` 兜底→快照原樣）＋`BeerImg key={fresh.id}`（換酒重掛，沿 v1）
- **追補 round-2（地圖釘圖）**：v1 自釘亦 emoji（`DrinkMap.tsx:1342` 同配方），用戶要 v2 更進一步——want 釘 divIcon 有圖上品牌圖（白底＋琥珀環，`iconUrl` 進 `V2WantMarker`；`escAttr`＋http(s) 限防注入），無圖回琥珀實心；三閘重綠待驗
- **关联 UR**：UR C.4
- **修复验证**：待（有圖酒顯示品牌圖＋壞圖退 emoji＋DB 回退行按 beer_id 對目錄恢復正名正圖＋三閘綠＋用戶瀏覽器驗收）
- **回归范围**：選酒 L2 BeerImg（不動）、v1 BeerIcon（不動）

### DEF-20260926-015 v2地圖釘 createRoot 同步 unmount 撞渲染期報錯

- **状态**：Closed（2026-09-26 用户验收通过：重建路徑 Console 乾淨，已合入 main）
- **严重度**：P1 主要（Console 爆錯；功能面暫無可見損壞）
- **发现日期 / 报告人**：2026-09-26 / @yuki
- **复现步骤**：開 `/v2` → 有自家想喝釘時觸發圖層重建（落釘／換酒／開關足跡）：Console 見 `Attempted to synchronously unmount a root while React was already rendering`（`V2MapView.tsx:216`）
- **期望**：重建只換 DOM，无 Console 報錯
- **实际**：重建 effect 內 `artRoots.current.forEach((r) => r.unmount())` 同步執行，撞上 React 渲染期即報 race
- **初判根因**：root 的 unmount 不能跑在別樹渲染提交途中；應延後到 microtask
- **确诊根因**：同上。修為模塊 `unmountRootsAsync`（microtask 延後＋try/catch 吞併發重卸；圖層 DOM 照舊同步摘），重建入口＋卸載清理雙處調用
- **关联 UR**：UR A.20
- **修复验证**：待（同路徑重走＋Console 乾淨＋三閘綠＋用戶複驗）
- **回归范围**：v2 地圖釘（他人釘／簇／足跡未動）、v1（未動）

### DEF-20260926-016 Vercel main 部署紅（wall.ts 引缺失模塊）

- **状态**：Closed（遠端 `a8e28c2` 已補齊樹；worktree 隔離驗 tsc 淨＋253 綠，見下）
- **严重度**：P0 阻断（main 紅，Vercel 無法部署）
- **发现日期 / 报告人**：2026-09-26 / @yuki（Vercel log 00:29:58，Commit `fd54300`）
- **复现步骤**：Vercel build `fd54300` 在 `Running TypeScript` 掛：`wall.ts(3,27): error TS2307: Cannot find module './andes'`（及 `antarctica-original` 等）
- **期望**：main 常綠可部署
- **实际**：該樹 wall.ts／index.ts 已接 batch3a＋batch3 共 15 組 import／export，但 15 枚 `.tsx` 不在倉內——典型部分推送（只交了 tracked 改動，新文件還躺在 untracked）
- **确诊根因**：同上。並非 A.20／C.5 hunks 問題（`fd54300` 內我的子集經 contents API 驗過干净；且該 commit 的 wall 內容來自並行線合入）。
- **解决**：對方 `a8e28c2`（merge：同步遠端 C.5 並合入 icon15 枚）補齊樹；我方以 `git worktree` 隔離驗該 commit（零碰工作區）：`tsc --noEmit` 淨＋vitest 253 綠。Vercel 下一輪 main 部署應綠（dashboard 待用戶目認）。
- **关联 UR**：插畫並行線（batch3a／batch3；非 A.20／C.5 範圍）
- **修复验证**：worktree@`a8e28c2`：tsc exit 0＋30 文件 253 測全綠（Turbopack 拒 symlink node_modules，故用 tsc 而非全 build；類型閘即 Vercel 掛點已覆蓋）
- **回归范围**：插畫管線——新批次接線與 `.tsx` 必須同 commit 進倉（禁 `commit -a` 只交一半）；已寫進本條＋memory
- **教訓**：`rtk git log` 會吞 HEAD 首行（本輪三次誤讀 graph，改原生 `git rev-parse/show` 才定罪）；Turbopack build 不吃 symlink 的 node_modules（worktree 驗證改走 tsc）

### DEF-20260926-012 v2首頁驗收返工（圖層級＋shadcn化＋全屏無footer）

- **状态**：Closed（2026-09-26 用户验收通过：round-6止＋配色中性，已合入 main）
- **严重度**：P0 阻断（三條並發：不可操作＋不像 shadcn＋版式不符）
- **发现日期 / 报告人**：2026-09-26 / @yuki
- **复现步骤**：開 `/v2`（010／011 修後仍須硬刷新）：按鈕點不動；整體仍像 v1；底下有 footer
- **期望**：按鈕全可點；shadcn 明亮現代；首屏只有地圖 view
- **实际**：疊加層全被地圖蓋住；組件雖是 shadcn 但味不對；footer 在底
- **初判根因**：層級＋token＋版式三件事
- **确诊根因**：
  1. 層級：疊加層 `z-10`，Leaflet panes 自帶 z 200–700 且直參與全局 stacking——v1 UR1.1 `.above{z-index:1000}` 同一課，本次重蹈。修為全部疊加層 `z-[1000]`＋根 `isolate`（portal sheet z-50 在 body 層照樣在上）。
  2. shadcn 化：已用 Button／Card／Badge／Popover／Sheet＋Separator（010 追加），`Avatar` 試圖 `shadcn add` 但本機工具鏈調不通 npx（命令被攔截、直調二進制下載超時 240s），改現成 primitives（圓＋ring＋Badge），Avatar 記 C.x 重試。
  3. 版式：根改 `fixed inset-0` 全屏（header／footer 仍在 DOM 但不可達不擠佔，v1 文件零動）；tab bar 全寬底欄＋CTA 列＋pin 卡照 Snap 位。
- **关联 UR**：UR C.1（返工直接合入）
- **修复验证**：三閘全綠（241／lint 0 error／build 39頁）；待用户复验（硬刷新！按鈕可點＋現代感＋無 footer 痕跡）
- **追補 round-2（同輪驗收四點）**：① 自適應：轉屏／視口變化加 `invalidateSize`（Leaflet 不自跟容器）；② 選酒 Sheet 換 shadcn 件（L1→Button／L2→Card）；③ 頂部重組單容器緊湊左對齊（城市放左，足跡浮條進流排布，永不重疊）；④ 融合感：outline 件全加 ring、tab bar 頂部柔影、pin 卡加 Separator；修完三閘綠，待复驗
- **追補 round-3**：選酒弹窗殘留三處手搓 button 全換 shadcn（模式行／tab 足跡／批量卡內鈕，grep 驗零殘留）；主色去橘改墨黑（Snap 黑白極簡，CTA 層級靠實心黑 vs 白描邊；skill 示例色让路用戶指令，已同步三 skill）；漏關 `</Card>` 致雙紅即修；三閘綠，待复驗
- **追補 round-4**：黑退位改 shadcn 官方 Blue（registry themes.ts 有據；Snap 同系藍）；三閘綠
- **追補 round-5**：按鈕面全去色（主 CTA／相機圓鈕／選中態／kinds／守衛／登入改描邊白淺灰，primary token 留備用；skill 注記同步三文件）；三閘綠，待复驗
- **追補 round-6**：pills 列首颗今晚喝咩漏網仍藍→outline 去色；grep 驗 v2 零 `bg-primary`／`default` variant（剩 8px 牆 Badge 點未動）；三閘綠，待复驗
- **回归范围**：v1 首頁（v2 文件＋作用域，理論零影響）

### DEF-20260926-010 v2 Button render缺nativeButton報錯

- **状态**：Closed（2026-09-26 用户验收通过：Console乾淨，已合入 main）
- **严重度**：P0 阻断（console 爆錯，语义／無障礙受損）
- **发现日期 / 报告人**：2026-09-26 / @yuki
- **复现步骤**：開 `/v2` 即 Console 見三條 base-ui nativeButton 報錯（V2Home pills×2、底部拍照）
- **期望**：零報錯
- **实际**：`render={<Link>}` 未配 `nativeButton={false}`
- **初判根因**：v1 mood 頁同配方漏抄
- **确诊根因**：同上。修為 4 處（含未爆的登入 Link）全補；另修 `v2noscroll` 誤用明串（module hashed 名， along 同單順手）
- **关联 UR**：UR C.1
- **修复验证**：三閘全綠（241／lint 0 error／build 39頁）；待用户复验（Console 乾淨）
- **回归范围**：v1 Button 用法（未動）、登入 Link 層（未開時不渲染）

### DEF-20260926-011 v2 沿用v1配色未現代化

- **状态**：Closed（2026-09-26 用户验收通过：現代感目檢，已合入 main）
- **严重度**：P1 主要（v2 看起來像 v1，試驗無意義）
- **发现日期 / 报告人**：2026-09-26 / @yuki
- **复现步骤**：開 `/v2`，卡片／按鈕呈塗鴉色（米白底＋墨線感）
- **期望**：淺色現代 shadcn（白卡＋柔邊＋琥珀主色）
- **实际**：語義 token 被運行時 doodle 主題值污染
- **初判根因**：token 值問題非組件問題
- **确诊根因**：doodle theme（`LOCKED_THEME_ID`）運行時把 token 值灌進 `<html>` 繼承鏈，v2 語義類全中招。修為 `v2scope` 作用域覆蓋（淺灰底／白卡／柔邊／琥珀主色＋深 slate 字保對比；`color-scheme: light`），只影響 v2 子樹，`globals.css` 原塊一字未動
- **关联 UR**：UR C.1
- **修复验证**：三閘全綠；待用户复验（目檢現代感＋v1 頁回歸無變化）
- **回归范围**：v1 全站（作用域隔離，理論零影響，用戶回歸目檢確認）

### DEF-20260926-009 守衛文案不跟模式＋缺添加好友

- **状态**：Closed（2026-09-26 用户验收通过：矩陣四格＋互加轉正＋層級，已合入 main）
- **严重度**：P1 主要（文案錯導＋缺關鍵動作）
- **发现日期 / 报告人**：2026-09-26 / @yuki
- **复现步骤**：
  1. 切好友模式，點非好友 pin 乾杯
  2. 層顯示隱身文案，且無添加好友鈕
- **期望**：兩維矩陣——隱身非好友：轉公開＋加好友；隱身好友：轉好友／公開；公開非好友：加好友＋直接執行；好友的好友：直接過
- **实际**：全顯示隱身文案雙鈕；無加好友動作
- **初判根因**：文案寫死隱身；加好友流不存在
- **确诊根因**：同上。修為：ModePrompt 按 `(mode, relation)` 選文案＋按鈕（10 新 key×3）；`POST /friends` 最小邀請（雙向 pending 即接受，免接受 UI；並發 23505 重試一次；0010 寫 policy）；地圖卡 friends／public 先查關係（會話緩存，匿名沿舊直過），隱身瞬開層內自查；榜／詳情透傳 target＋mode；camera 補 mode prop（build 捉到）
- **关联 UR**：UR A.19（範圍擴充，直接合入）
- **修复验证**：三閘全綠（237／lint 0 error／build 33頁；文案 26×3 parity＋yaml 合法；組件＋異步守衛用戶瀏覽器覆蓋）；待用户复验（四格矩陣逐格＋互加成好友＋層級）
- **回归范围**：隱身舊雙鈕（文案鍵同名，行為不變）、榜／詳情讚守衛、拍照發布守衛、0009 讀 policy（0010 只加寫）

### DEF-20260926-008 好友模式非好友無攔截＋守衛層級不保頂

- **状态**：Fixing（2026-09-26 修完待用户复验）
- **严重度**：P1 主要（好友模式社交無守衛；層級問題重演 002）
- **发现日期 / 报告人**：2026-09-26 / @yuki
- **复现步骤**：
  1. 切好友模式，點非好友 pin 開卡（按鈕都在）
  2. 點乾杯／約喝酒 → 應攔截彈層（僅公開鈕），層必須在最上
  3. 切公開 → 原卡恢復續操作
- **期望**：按鈕永遠可見（只攔截不隱藏）；層 portal＋z1100 保頂；切換後恢復卡片
- **实际**：好友模式非好友直通無攔截；層 z-999 且困於各 stacking context
- **初判根因**：A.19 只覆蓋了隱身觸發；層級沿舊
- **确诊根因**：同上。修為：① `ModePrompt` 走 `createPortal(document.body)`＋`z-[1100]`（壓過錨定卡／榜 z-1000、chooser z-998）；② `handleCheers／handleInvite` 拆 guard＋proceed，好友模式先調 `friends/check?checkin_id`：好友直過、非好友收卡彈層（A.19 僅公開鈕）、查失敗 fail-open 直過；③ 附带修真 pin 邀約只認 MOCK 表（005 同類漏網，`proceedInvite` 加 api 回退）
- **关联 UR**：UR A.19（本是其範圍延伸，直接合入；likes 未動，另議）
- **追補（同輪用戶糾正）**：乾杯除隱身外一律直過（加好友門只攔邀約）；公開邀約非好友加完即發邀約（不等接受，對方無接受 UI）；隱身維持全唯讀不動（三次拍板的地基，不重定義）
- **修复验证**：三閘全綠（235／lint 0 error／build 32頁；組件＋異步守衛，用戶瀏覽器覆蓋）；待用户复验（好友模式非好友乾杯→層頂→僅公開鈕→切公開→卡回→可乾杯；好友直通無層）
- **回归范围**：隱身守衛（行為不變）、榜／詳情／相機 prompt（portal＋z 變更，層級只升不降）、mock 乾杯邀約（拆函數，語義不變）

### DEF-20260926-007 拖圖自動關卡，用戶要僅X關閉

- **状态**：Closed（2026-09-26 用户验收通过：拖圖卡留＋X關，已合入 main）
- **严重度**：P2 次要（舊決策行為，用戶翻案）
- **发现日期 / 报告人**：2026-09-26 / @yuki
- **复现步骤**：
  1. 點好友 pin 開卡
  2. 拖地圖
  3. 卡自動消失
- **期望**：卡只在點 X（或換選另一 pin／登出）時消失，拖圖時卡跟著 pin 走
- **实际**：拖圖即關（UR2.1 Q1 舊決策）
- **初判根因**：`dragstart → setSelectedId(null)` 既有邏輯
- **确诊根因**：同上，非 bug 是舊決策；用戶翻案，刪該監聽即可（錨點本就跟 move 快照追 pin，不脫鉤）
- **关联 UR**：UR A.17（驗收跟進；UR2.1 凍結條目已回寫改動記錄）
- **修复验证**：三閘全綠（232／lint 0 error／build 32頁）；待用户复验（開卡後拖圖卡還在＋跟著走，點 X 才關）
- **回归范围**：工具列點地圖收起（URC1.3 C3，不動）、換選／登出關卡（不動）

### DEF-20260926-001 模式切换按钮在页面上不可见

- **状态**：Closed（2026-09-26 用户验收通过：首屏 pill＋一点展开三档，已合入 main）
- **严重度**：P1 主要（A.16 核心入口不可达则无法验收）
- **发现日期 / 报告人**：2026-09-26 / @yuki
- **复现步骤**：
  1. 本地 `npm run dev` 启动
  2. 打开首页地图
  3. 左上城市卡下方寻找隐身／好友／公開三檔切换器
  4. 实际：看不到切换按钮
- **期望**：登录＋点城市卡展开工具列后，城市卡下方出现三檔切换器
- **实际**：页面上没有状态切换按钮
- **初判根因**：待确认 — 可能性：A) 未点城市卡展开（切换器只在 toolbarExpanded 时渲染）；B) 未登录（匿名 `isAuthed=false` 时切换器按设计隐藏）；C) dev server 跑的是旧代码（热更新未生效或终端有编译错）；D) 渲染条件/代码 bug
- **确诊根因**：按設計收合（`toolbarExpanded` 假）＋收合態零提示，用戶不知點城市卡可展開（console 雙查證：`[role=toolbar]` 有而 `[role=group]` 無時曾懷疑舊代碼，用戶實證為未展開）。修為收合態常駐精簡 pill（露當前模式，一點展開選三檔，不一次全放）
- **关联 UR**：UR A.16
- **修复验证**：三閘全綠（test 220／lint 0 error／build 過），待用户复验（首屏即見 pill＋一點展開三檔）
- **回归范围**：城市卡展开、登入态、`GET /me`、`ModePrompt` 守衛浮層

### DEF-20260927-001 v2 他人打卡弹窗 UI 亂＋信息不全

- **状态**：Fixed（2026-09-27 用戶瀏覽器親驗通過，已合入 main；待用户复验关闭）
- **严重度**：P1 主要（v2 社交主链入口：點人→乾杯／邀約全經此卡）
- **发现日期 / 报告人**：2026-09-27 / @yuki
- **复现步骤**：
  1. 開 `/v2`，點任一他人 pin
  2. 看彈出的打卡卡
- **期望**：與自家打卡卡同構信息（誰＋喝什麼＋何時何地＋乾杯／邀約），排版一致
- **实际**：僅 emoji＋暱稱＋區＋酒名距離＋按鈕；無頭像性別、無時間、無酒圖，觀感與自家卡迥異（用戶原話「UI 是亂的」）
- **初判根因**：`V2Home openPin` 丟棄 `PinJson` 已有字段（avatarUrl／gender／checkedInAt 全不用）；他人卡 UI 停在 C.1 骨架（C.4 只升級了自家 Sheet）——以前端映射＋UI 為主，零後端
- **确诊根因**：同上，已實證：`PinJson`（`lib/api/pins.ts:33`）含 nickname／avatarUrl／gender／checkedInAt／area／drinkName 全字段；`openPin`（`V2Home.tsx:358`）僅取 7 字段；他人卡（`V2Home.tsx:840`）僅渲染 title／sub／drink／距離／在線／按鈕，無用戶行／酒圖／時間
- **关联 UR**：UR C.10
- **修复验证**：返工後三閘全綠（test 548／lint 0 error／tsc 淨／build 綠；548 含並行線新增）；2026-09-27 用户亲验通过（他人卡進 Sheet 後 X＋結構與自家一致）
- **回归范围**：v2 自家 Sheet（不動）、v1 他人卡（版本問答定案前不動）、乾杯／邀約／守衛行為

### DEF-20260927-002 v2 足迹脚印动画只播一次不循环

- **状态**：Closed（2026-09-27 用戶指令取消動畫另立需求，本條關閉；確診過的斷腿／抖動修法已合入）
- **严重度**：P1 主要（足迹核心体验：动画即足迹存在感）
- **发现日期 / 报告人**：2026-09-27 / @yuki
- **复现步骤**：
  1. 登入態開 `http://localhost:3002/v2`（注意：`:3000` 是並行線舊代碼，必須走 `:3002`）
  2. 點底部足跡 tab 開足跡（多條打卡記錄）
  3. 盯著腳印看 10 秒
- **期望**：腳印序列淡入循環往復，直到點地圖／其他鈕才消失
- **实际**：只播一次就停（用户原話）
- **初判根因**：待确认 — 可能性：A) markers effect 反覆重建（`self`／`others`／`wants` 身份抖動致圖層重掛，動畫每建必重播，看似一次）；B) CSS 本身問題（`infinite` 應循環，嫌疑低）；C) 用戶所處 zoom／數據下 steps 為空（單站／全腿超 50km），看到的是靜態釘誤判
- **排查进展（2026-09-27）**：已排除 B（`v2stepfade infinite` 無誤）與 C（`interpolateFootprints` 4 單測全綠，HK 站必產步）；`apiPins` mount 一次、`others`／`wants` memo 穩定；agent-browser 沙盒起不來無法錄 DOM 實證。現第一嫌疑 A（`self` watch 抖動／未知重渲染致圖層重掛）；止血方案＝足跡獨立層（沿 A.21 常駐層口徑，動畫 DOM 只跟 trail＋zoom），待協調後動工
- **排查进展（2026-09-27 續）**：靜態舉證走完——trail 渲染塊原文無缺（序號釘／錨徽／腳印三路全在）、`trail` 數據鏈（7 站）用戶確認、Console 無相關紅錯；仍無法解釋「整層消失」，轉向要瀏覽器實證（截圖＋鏡頭是否飛），見問題區
- **确诊根因（2026-09-27，代碼實證）**：`useGeolocation({watch:true})` 每回調 `setPosition` 換對象（無距離過濾）→ `self` 身份抖動 → markers effect 反覆重掛整層 → CSS 動畫每建必重播（「只播一次」觀感）；關面板是時間巧合（抖動不停，與面板操作無關）。修法＝`stableSelf` 10m 門檻凍結（v2-only，hook／v1 不動）
- **确诊根因追加（2026-09-27，用戶數據形狀定罪）**：`FOOT_MAX_LEG_M` 50km 斷腿在交替跨區（HK／美國）數據下吃掉**全部**腿 → steps 空數組 → 零腳印（序號釘正常故「靜態在、動態無」）；該規則是 round-6 自發明的，用戶從未要求隱藏跨洋。修法＝刪斷腿（跨洋點線即旅程）＋刪 `haversineMeters` 引用
- **修复验证**：修後三閘全綠；待用户 `:3000` 硬刷新親驗動畫循環（若 003 同消則同根，一併關）
- **确诊根因（2026-09-27，用戶新事實定罪，與 003 同根）**：鏡頭飛了＋回位 dead＋整層「消失」＋無紅錯——`minZoom: 10` 把 HK＋美國 fit 鉗到 z10 落洋中間；動畫／釘一直在，衹是不在視野裡。隔離層止血方案退役（無重建 bug，不建不必要的代碼）
- **关联 UR**：UR C.11
- **修复验证**：待定
- **回归范围**：足跡層（序號釘／錨徽／虛線已退役史）、markers effect 重建觸發面

### DEF-20260927-003 v2 关目录面板足迹动画跟着消失

- **状态**：Investigating（2026-09-27 代碼舉證完成，等用戶給精確複現分支）
- **严重度**：P1 主要（目录↔足迹解耦即本條；流程斷）
- **发现日期 / 报告人**：2026-09-27 / @yuki
- **复现步骤**：
  1. 登入態 `:3002/v2` 開足跡（目錄＋動畫同現）
  2. 關目錄面板（X）
  3. 看地圖足跡層
- **期望**：動畫留著，只在點地圖／其他鈕／tab 二次關／登出才消失
- **实际**：動畫跟著消失（用户原話）
- **初判根因**：待确认 — 可能性：A) 用戶關的是 tab 不是 X（tab 二次關按設計清足跡，屬語義誤會非 bug）；B) 關面板觸發 markers effect 重建＋動畫重播歸零疊加 002，誤判為消失；C) 真有代碼路徑清 trailOn（已枚舉三處，待實證新增嫌疑）
- **排查进展（2026-09-27）**：代碼舉證——關目錄 onClose 只 `setStopsOpen(false)`，`setTrailOn(false)` 僅三處（tab 二次關／浮條返回／登出），關 X 無路徑清足跡；故如用戶關的是 X 則代碼無辜，嫌疑轉 A（tab 語義）或 B（重建觀感，修 002 連帶覆蓋）。待用戶確認關閉動作與硬刷新狀態
- **排查进展（2026-09-27 續）**：用戶確認關 X＋`:3000`＋7 站（HK＋外地）＋Console 無相關紅錯；靜態舉證 trail 塊原文無缺。整層消失仍無解釋，轉向要瀏覽器實證（截圖看層＋鏡頭是否飛），見問題區
- **排查进展（2026-09-27 續二）**：靜態分析枯竭（狀態三處／渲染三路／數據驗證全無辜），轉控制台實證——已給用戶三條只讀指令（DOM 計數＋local 計數），等回填定是「層沒了／步數空／CSS 不可見」哪一支
- **确诊根因（2026-09-27，用戶新事實定罪）**：鏡頭飛了（fit 鏈正常）＋回位鍵 dead（見 DEF-005）＋整層「消失」＋無紅錯——四者同指**跨區 fit 被 `minZoom: 10` 鉗住**：HK＋美國 bounds 本該 z~2，鉗到 z10 落在洋中間，用戶看到的根本不是「空地圖」而是「錯大陸」；釘全在視野外故「消失」；回位又 dead 故被困住。`fitBounds` 按 min/max 鉗 zoom（Leaflet 保證）；HK 境內從未觸發故歷史無報。修法見 UR round-8（需動 V2MapView minZoom，待協調例外）
- **关联 UR**：UR C.11
- **修复验证**：待定
- **回归范围**：`stopsOpen`／`trailOn` 狀態機、tab 語義、登出清理

### DEF-20260927-005 v2 回位按钮无定位时点了没反应

- **状态**：Fixing（2026-09-27 守衛刪除即修，關聯 UR C.11 [WIP] 走 10 步）
- **严重度**：P1 主要（跨區 fit 失靈時回位是唯一逃生口，現雙殺被困洋中間）
- **发现日期 / 报告人**：2026-09-27 / @yuki（貼 DOM `aria-label="回到我的位置"` 為證）
- **复现步骤**：
  1. 拒絕定位（或桌面無 GPS）→ `selfPos === null`
  2. 點右緣工具列回位鈕
  3. 無任何反應（鏡頭不動，不飛香港中心也不重請求定位）
- **期望**：退化飛香港中心（`V2MapApi.recenter` 本就支援 null self；v1 口徑是重請求定位，v2 先對齊 fallback，另議）
- **实际**：`V2Home` 工具列 `onClick` 首行 `if (selfPos !== null)` 把調用整攔掉
- **初判根因**：同確診（守衛過嚴；修法＝刪守衛，直調 `recenter()`，V2Home 單文件，零協調衝突）
- **关联 UR**：UR C.11
- **修复验证**：待修後親驗（拒定位點回位→飛香港中心）
- **回归范围**：回位鈕（有定位行為不變）、`fitHk`（不動）

### DEF-20260927-004 v2 地图页崩溃：trailRef is not defined

- **状态**：Fixing（2026-09-27 根因確診即修，關聯 UR C.11 [WIP] 走 10 步）
- **严重度**：P0 阻断（`/v2` 地圖頁白屏，兩報同根）
- **发现日期 / 报告人**：2026-09-27 / @yuki
- **复现步骤**：
  1. 開 `http://localhost:3000/v2`（團隊統一端口）
  2. 地圖 init 清理（卸載／StrictMode／HMR 任意觸發）即炸
- **期望**：地圖正常加載，清理無報錯
- **实际**：`ReferenceError: trailRef is not defined`（`V2MapView.tsx:348`，兩報同根同行）
- **初判根因**：round-4 退役 polyline 刪了 `trailRef` 聲明，三處清理只刪掉兩處（dispose 那行當時文本已漂移，edit 失敗未察）；疊加並行重構（A.21）又動過 dispose 區，懸空行留到現在
- **确诊根因**：同上，已實證：聲明零處、殘留一處（dispose `trailRef.current?.remove()`）；修法＝刪殘留行（layer 摘除已帶走 polyline，本無需逐個清）
- **关联 UR**：UR C.11
- **修复验证**：修後 `grep trailRef` 零殘留＋tsc 淨／lint 0 error／test 301 綠／build 綠；修法已在工作區（`:3000` 熱重載即生效，無需等合併）——待用户硬刷新親驗轉 Fixed
- **回归范围**：地圖卸載清理（layer／map 移除鏈）、足跡層（獨立 layerRef 已接管）

### DEF-20260927-006 v2 實時位置（自／友呼吸釘）被打卡釘淹沒難辨

- **状态**：Fixed（2026-09-27 PR #29 `e27727f` 已合入 main；用戶雙號親驗待補，完成後轉 Verified）
- **严重度**：P1 主要（A.21 核心價值「一眼看到人在哪」不可見；無崩潰，功能可用但不可用）
- **发现日期 / 报告人**：2026-09-27 / @yuki
- **复现步骤**：
  1. `0011` 遷移已跑；雙號互為好友、皆非隱身、皆開 v2＋定位
  2. 無痕登另一號打 `GET /api/v1/friends/live` → 正常回好友帶 `lat/lng`（實證：`HK Trash 22.3463/114.1261`，API 側正常，問題純 UI）
  3. 開 v2 地圖：自釘＋友釘＋雙方打卡酒釘全疊在同區 → 呼吸／閃動難辨、誰是誰不清
- **期望**：live 位置一眼可辨（自／友呼吸燈不被打卡淹沒，層級分明；重疊區自動散開，超量收列表）
- **实际**：位置、打卡記錄 UI 高度重疊，可用性／可見性差；round-1（自28px雙環＋z壓頂）用戶判仍不明顯
- **确诊根因**：三層實證（`components/v2/V2MapView.tsx`＋`v2.module.css`）：①自釘 18×18（`interactive:false`）與啤酒釘 40–44px 同主 layer、零 `zIndexOffset`——同坐標下物理被蓋；②友釘 40×40 獨立 `friendLayer` 但同尺寸、零 `zIndexOffset`，且主 layer 重建改變插入序 → 堆疊輸贏看運氣；③呼吸環三枚共用同一 `v2-pulse 2s`，自／友視覺無區分。另「不煽動」一半是預期錯位：友釘只在對端心跳（30s＋位移>50m 門）才 `setLatLng`，靜置本來就不動
- **round-2 方案**（2026-09-27 用戶拍板全套）：`lib/mapSpread.ts` Vogel 螺旋自動散開（像素空間，確定性，live 永不進輸入）＋live 徑向避讓＋超 cap（6）收 +N 徽（`v2stack` 白底琥珀環）＋堆疊列表 Sheet（行點開卡＋一鍵散開復用 C.6）；z>11 簇徽退役（小組直散，大組收 +N）；業界 spiderfy／density-spread＋shadcn AvatarGroup +N／popover 口徑
- **关联 UR**：UR C.14
- **修复验证**：`lib/mapSpread.test.ts` 9 單測＋1 快照；三閘317綠／lint 0 error／build 41頁；待用戶雙號瀏覽器親驗（自／友 live 釘可辨＋重疊區散開／+N 列表）
- **回归范围**：v2 地圖釘層（live／打卡／want／序號釘）、C.6 簇徽點擊行為（z>11 改自動散＋列表）、C.9 錨徽（未動）
- **協作備註**（2026-09-27）：本條中途被同樹另一方回退過一次（表格＋詳情整段消失，已重建；另 `onStackClick` 被改 optional，功能無礙保留）。提交走 split-car，只帶己方 hunks

### DEF-20260927-007 v2 點好友圓圈無反應

- **状态**：Investigating（2026-09-27 當輪落條先記後查）
- **严重度**：P1 主要（好友→聊天是 C.15 主入口；點不開即整線不通）
- **发现日期 / 报告人**：2026-09-27 / @yuki
- **复现步骤**：
  1. 開 `/v2`（登入態），找好友綠圈釘
  2. 點之，無任何反應（不開卡不跳頁，Console 待用戶回填有無紅錯）
- **期望**：點好友釘進聊天頁（C.15 改 Sheet 為獨立路由後：跳 `/v2/chat/[userId]`）
- **实际**：無反應
- **初判根因**：待确认 — 可能性：A) `friends` 根本是空（`useLiveFriends(presence === "online")`：匿名／隱身／mode 未載／對方離線／0011 心跳不通即 `[]`，零圓圈可點；用戶點的可能是自釘或啤酒釘）；B) `openChat` 靜默 return（`liveFriends.find` 失配，代碼面 id 同源嫌疑低）；C) 浮層攔截點擊（DEF-012 層級史重演，需瀏覽器實證）
- **排查进展（2026-09-27）**：靜態舉證走完——`mk.on("click")` 接線在（`V2MapView.tsx:810`）、`handleMapTap` 不清 chat（`V2Home.tsx:487`，只清足跡三態）、`.v2friend` 本體無 `pointer-events:none`（僅 `::after` 有）。故如圓圈真的是好友釘且 `friends` 非空，代碼無辜；轉向要用戶回填：①是否登入＋模式（公開／好友才拉得到人）②對方是否在線（`GET /friends/live` 回什麼）③Console 有無紅錯
- **关联 UR**：UR C.15（入口改路由跳轉後，用戶以直接 URL 複驗；pin 鏈路同步跟進）
- **修复验证**：待定
- **回归范围**：好友釘點擊、聊天入口、守衛（隱身仍不可見人）

### DEF-20260927-008 v2 回位按鈕（回到我的位置）點了無反應

- **状态**：Open（2026-09-27 用戶上報當輪落條；代碼層初查回位三段 intact，未定罪）
- **严重度**：P1 主要（回位是地圖逃生口；DEF-005 修的正是此鍵，施工中）
- **发现日期 / 报告人**：2026-09-27 / @yuki
- **复现步骤**：開 v2 地圖 → 拖偏鏡頭 → 點右緣回位鈕（`aria-label="recenter"`）→ 鏡頭不動（待用戶補：完全無反應／飛錯處／console 紅字／有無定位／人在不在中心／他鍵正常否）
- **期望**：有定位飛回自位（z≥15），無定位飛香港中心（DEF-005 修法）
- **实际**：疑似無反應（用戶體感，待確證）
- **初判根因**：待确认。已排除：按鈕接線（`V2Home:1018` 直接調，零 diff）／`ref={mapApi}`（:864 完好）／`recenter→flyTo` 本體（零 diff）／build 綠；C.14 散開改動未進回位路徑。候選：重建 effect runtime 拋錯／DEF-005 施工半成品／已在中心看不出動／陳舊 bundle
- **确诊根因**：待确认（未進 Investigating，等用戶補三問）
- **关联 UR**：待查（若定罪 C.14 波及則併入，不另開）
- **修复验证**：待定
- **回归范围**：回位鈕、鏡頭（recenter／fitHk／fitPoints／flyTo）
