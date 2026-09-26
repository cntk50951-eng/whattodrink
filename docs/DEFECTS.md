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
