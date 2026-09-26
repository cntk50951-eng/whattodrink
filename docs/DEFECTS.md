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
