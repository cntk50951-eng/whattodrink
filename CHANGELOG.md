# Changelog

所有重要修改會記錄在這個檔案。格式借鑑 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/)。

## [Unreleased]

### Added
- **UR 4.1 — 拍照分享排行榜（[WIP]，待用戶本地 build＋瀏覽器驗收）**
  - `lib/posts.ts`（`WallPost`＋6 篇 SVG 種子＋`parseWallPost` 校驗＋`toggleLike`／`sortHot`／`sortLatest`／`hasUnseenWall`／`persistPost`＋15 單測，localStorage stub 沿 node 環境缺口）＋`lib/posts.test.ts`；`post_likes`／`post_reports` 記入 future-schema，`photo-mood.md` 加第三節
  - 相機：`?auto=1` 直達（首用說明卡＋`wtd-camera-consent`，回頭客直開鏡頭）＋預覽改全螢幕拍立得＋拍攝／上傳下採樣 ≤1024px（HEIC 退回 object URL，會話可用 reload 丟）＋分享落盤直達詳情；扇形＋選單拍照入口改 `?auto=1`
  - `/wall`＋`/wall/[id]`：拍立得散牆（定妝旋轉＋獎章＋讚徽章＋類型角標＋新章）＋熱門／最新貼紙頁籤＋首訪守則浮層＋進牆滅紅點（選單牆項紅點）；詳情大拍立得＋正文無襯線＋語音圓鈕波形條＋150ms 輕讚＋檢舉／自刪兩段確認；`wall`＋`nav.wallPick`＋camera 同意／分享三語
  - 107→120 tests／tsc 淨／lint 0 error（3 舊 warning）；`npm run build` 本機 sandbox 被攔（老問題，待用戶側復核）；camera-flow／voice-recorder 內他人未提交轉錄 hunks 原樣保留，提交時另議
  - fix v2（用戶返工：主頁互動榜＋社交 composer）：主頁熱門三卡（行內讚＋回焦重讀）＋分享重排（hero 角落鈕／caption 列／語音 chip／黏底條）；`homeTitle`／`viewAll` 三語；門不變
  - fix v3（用戶返工：互動榜推倒重來）：刪下方區塊改地圖右上收折浮卡 `MapHotBoard`（live 點＋下拉三名＋行內讚＋sheet 自動收；`expandBoard`／`collapseBoard` 三語）；／wall 不動；門不變
  - fix（用戶回報黑屏＋錄音播不出）：雙流 race 三閘＋種子啞徽章退役＋`audioDataUrl` 持久（400KB cap＋配額退化）＋播放器回退鏈；120→123 tests／tsc 淨／lint 0 error
  - fix v4（用戶返工：榜操作留地圖）：`MapHotBoard` 下拉內列表／詳情雙視圖——點貼文切詳情（大圖＋正文＋小尺寸 `VoicePlayer`＋讚＋檢舉／自刪兩段），全程不跳 `/wall/[id]`；`VoicePlayer` 加 `small` 檔；詳情面板 `max-h-[46vh]` 滾動；門不變
  - fix v5（用戶回報：錄音 crash＋發布窗無出口＋圖標土）：`camera.rerecord` 缺 key（全三語補；審計腳本確認唯一缺口——MISSING_MESSAGE 炸整棵樹才是「播不出」真因）＋review 全屏加 X（`restart` 退出）＋成功頁加返回主頁（`router.push("/")`，localePrefix never）＋發布頭像 😎 改手繪徽章（UserRound＋accent＋硬陰影）＋錄音播放鈕改塗鴉風＋`VoicePlayer` 無源 🎙 改 Mic 圖標；`closeReview`／`backHome` 三語；123 綠／tsc 淨／lint 0 error
  - fix v6（用戶返工＋回報：錄音仍播不出＋拍照分享留地圖）：錄音真因＝`VoiceRecorder` 缺 `ondataavailable` 致 0-byte 空包——`lib/audio.ts` 加 `buildRecordingBlob`（空包回 null）＋`lib/audio.test.ts` 4 單測＋空包 `recordEmpty` 三語；拍照分享上地圖——新 `CameraOverlay`（`/?shoot=1` 全屏層，地圖不卸載）＋`CameraFlow` 可選 `onClose`（X／成功回家；overlay 成功留層內，獨立頁照跳詳情）＋扇形／選單／空牆三入口改道＋`/camera` 保留；127 綠／tsc 淨／lint 0 error（build 照例被 sandbox bind-port 攔，非代碼錯）
  - fix v7（用戶回報：榜看全部跳頁＋牆語音 416＋榜詳情圖文音）：榜「看全部」改下拉內加載更多（`loadMore` 三語，初顯 3＋每次 5）；416＝v5 空包已落盤（`parseWallPost` 中和空 dataURL，`isEmptyAudioDataUrl`）＋已發表 URL 被 composer revoke 牽連（`ownPostAudioUrl`＋submit 空包守衛）＋`VoicePlayer` onError 降級鏈；榜詳情加轉錄行；131 綠／tsc 淨／lint 0 error
  - hotfix（用戶回報：點自己帖子榜炸 `wall.deleteOwn` 缺 key）：榜改用現成 `delete`／`reportYes`，零新 key；wall＋camera 全文件審計三語 PASS；131 綠／tsc 淨／lint 0 error
- **UR A.1 — API 架構設計（[WIP]，設計稿待用戶拍板）**
  - 新 `docs/api-architecture.md`（10 節：public／auth 端點清單 16 條＋Supabase Auth JWT 雙通道＋Route Handlers 單體＋三端同一契約＋RLS 矩陣＋替換對照＋未決 5 問）；backlog 掛 [WIP]＋改動記錄；純文檔零代碼
  - 分析師 review 合併：checkins `type`＋`visibility` 行級可見性＋檢舉 1／3 門檻＋境外揭露接 A.3 UI＋語音上限分層；§10 全定案；`future-schema.md` 同步
- **UR A.3 — Supabase 地基（[WIP]，腳手架落地待連通冒煙）**
  - `@supabase/ssr 0.12`＋`lib/supabase/`（env 新舊制兼容／browser／server／middleware）＋proxy 雙中間件＋`/api/v1/health`＋5 單測；136 綠／tsc 淨／lint 0 error
- **UR A.4 — 前端接 beers API（[✓]，用户回 OK，`b0c91a1`＋`32c3922` 已合併 push）**
  - `Beer.icon_url`＋`fetchBeers` 原地換源＋`BeerIcon`（API＞emoji，本地圖退場）＋批量／想喝／換酒／pins／他人卡头＋`beerByName`＋`parseWantRecord` 掉圖 fix；146 綠／tsc 淨／lint 0 error
  - 牌子 26 行進目錄（`0004`＋seed 同步；41 行全驗；茅台 excluded；Hoegaarden 暫進 lager）
- **UR A.5 — 啤酒換一批無反應（[✓]，用户親眼驗收，merged）**
  - `pickNextBatch`（排除當前批優先取新臉，池不夠回退重洗）＋6 單測；L2 換一批接新語義＋按鈕搬 header 可見處＋池見底置灰（零新 i18n key）；152 綠／tsc 淨／lint 0 error
- **UR 1.1 — 首頁互動式頁面重構（WIP，待用戶側 build＋瀏覽器驗收）**
  - 新依賴：`leaflet@1.9.4`（真實地理底圖＋免費 CARTO Voyager 瓦片，免 key）、`vitest@^3`（`@types/node@20` 與 vitest 5 互斥，只能用 v3）＋ `npm test` 腳本
  - `components/map/DrinkMap.tsx` — 地圖＋推薦入口同一組件：geolocation 狀態機、拒絕／失敗→全港視圖、塗鴉 pins（自己／MOCK 他人／「想喝」虛線圈）、自訂縮放＋睇全港按鈕、乾杯卡（本地 mock）、`prefers-reduced-motion` 降級
  - `lib/geo.ts`（全港 bounds＋`isWithinHongKong`）、`lib/checkins.ts`（MOCK 種子，處處標 MOCK）、`hooks/useGeolocation.ts`（idle→locating→success/denied/unavailable/timeout/unsupported）
  - `lib/geo.test.ts`＋`lib/checkins.test.ts` — 8 tests 全綠；`tsc` 全過；lint 無新增 error（僅剩 theme-provider 舊 error）
  - 首頁重排：`Hero variant="slim"`（標題保留，啤酒杯抽成 `BeerMugDoodle` 供地圖角落復用）→ `DrinkMapSection` 置頂主角 → Bento 後移；三語 `map` 文案
  - 選型結論：Remotion 是視頻渲染框架，不做即時互動地圖——只借其設計語言（粗描邊／扁平色／貼紙感）用 CSS＋SVG 實現，未引入依賴（見 memory）
  - 待用戶側跑 `npm run build`＋瀏覽器驗收（sandbox 內 Turbopack／dev server 起不來）：定位允許／拒絕、縮放至全港、隨機推薦→「想喝」落點、乾杯卡三條路徑
  - fix（用戶驗收發現）：React 覆蓋層缺 z-index 被 Leaflet panes（200–700）壓住導致「入口按鈕消失」——`.above{z-index:1000}`；點自己 pin 無反應——改彈 self 卡（含推薦按鈕）；手繪增強：筆記本圓點紙紋、膠帶貼、指南針貼紙、LIVE 跳動點、pins 交錯傾斜（全走 token＋reduced-motion 降級）
  - fix（底圖換源）：CARTO 政策改為匿名瓦片打「API KEY REQUIRED」水印——主源換 Stadia Stamen Watercolor（`NEXT_PUBLIC_STADIA_KEY`，見 `.env.example`），無 key 時自動降級 Esri 淺灰（免 key），水彩原生只到 z16（`maxNativeZoom` 過縮）；attribution 依官方文檔更新
  - fix（底圖再換源，用戶決策）：免 key 優先——主源改 OSM 標準 raster（零註冊，彩色街道／水系／公園，attribution 合規，prototype 規模可用），Stadia 水彩降為休眠備選（builder＋attribution 保留）；手繪皮膚第一版盲調（暖 sepia＋高飽和＋紙紋，待親眼驗收再迭代）；Esri 備用移除
  - fix（定位失敗無入口，用戶回報）：定位失敗卡片加「重新定位」按鈕（接 hook 既有 retry）＋拒絕重開指引（Chrome／iPhone 路徑＋微信／IG 轉 Safari／Chrome 提示），三語；未提交，等驗收一併處理
  - fix（手機無彈框，用戶回報）：Permissions API 預檢（已拒絕直接進指引，不再靜默失敗；不支援的瀏覽器走原路徑）；指引擴到 unavailable（系統總開關步驟放第一位）；超時 10s→15s 照顧手機冷啟動；未提交
  - fix（權限指引卡，用戶回報）：定位失敗改底部指引卡——`lib/device.ts` 純函數 UA 辨平台／瀏覽器（Safari／Chrome iOS／Chrome Android／內置瀏覽器，單測覆蓋），步驟精確到瀏覽器（iOS Chrome 是「設定→Chrome→位置」，不是 Safari）；Android 附一鍵直達系統定位 intent，iOS 無網頁可達的設定 deep-link 只給手動步驟；卡片可關，關後剩小 pill 點即重試＋重開卡；未提交
- **UR 1.2 — 首頁地圖小屏交互重做（WIP，待真機驗收）**
  - 推薦面板改底部抽屜：收起 pill／半高 sheet（拖拽手柄下滑關閉＋X＋safe-area），落「想喝」自動收成 chip；`lib/geoWatch.ts` 純函數 watch 可測化，hook 加 watch 模式（切後台／卸載自動停，報錯凍結末點）
  - self 改無字閃動 teal 圓點（watch 實時跟，只動點不動鏡頭）；新增回位十字鈕（無位置時退化為請求定位）；開 sheet／回位時鏡頭上移 180px 讓位；地圖手機改 62svh
  - 16 tests 全綠；tsc 全過；lint 無新增 error；待用戶手機真機驗收（走動跟隨＋抽屜手感＋回位）後再進 commit 流程
  - fix（先拒後允 stranded，用戶回報）：一次性的 settle gate 在重試時不重置，先拒後允會永遠停全港視圖——重試入口統一走 `handleRetryLocate`（重置 gate），settle 改冪等（marker 只建一次、鏡頭只飛一次）；抽屜再調透（bg-card/70＋blur-lg＋max-h 42%）；未提交
- **UR 1.3 — 手機沉浸地圖與面板免下滑（[✓] 用戶已驗收，待合併）**
  - 手機地圖佔滿首屏（`100svh-header`，桌面 560px 不變）；首頁 slim Hero 退役、標題縮成地圖頂部浮條（`Hero` 元件保留備用）；推薦 pill 移到底部、任一卡片展開時隱藏防打架
  - 結果區緊湊橫排＋雙鈕一行兩格，抽屜 max-h 50%，避讓高度同步；16 tests／tsc／lint（無新增）全綠；未提交
  - fix（滑動陷阱未根除＋入口收斂，用戶回報）：證實 Leaflet 自帶 `touch-action:none` 常贏過 CSS 覆寫——改 init 內 `!important` 直寫（根治）；舊縮放組／回位鈕／pill 全併入 `MapFab` 單一 speed-dial（扇形錯峰彈簧、label pills、Esc／拖圖收起、紅點語義態），縮放加減退役（雙指＋雙擊保留）；16 tests／tsc／lint（無新增）全綠；未提交
  - fix（頁面滾動被地圖吞掉，用戶回報）：沉浸式高地圖下整屏手勢被 Leaflet 獨佔——`scrollWheelZoom: false`（桌面滾輪還給頁面）＋容器 `touch-action: pan-y pinch-zoom`（手機豎滑滾頁面、橫拖動地圖、雙指縮放）；未提交
  - fix（縮放退役錯＋主鈕太醜，用戶回報）：縮放加減返嚟（扇形第 1、2 格，共 5 格：放大／縮小／睇全香港／回位／隨機推薦）；主鈕換手繪啤酒（杯內三氣泡無限上升，reduced-motion 靜止）＋首訪提示 pill「㩒我揀嘢飲！」（localStorage 睇過即收，三語）；附帶修掉 theme-provider 舊 lint error（localStorage 改 lazy initializer，同 pattern 修 MapFab）；16 tests／tsc 全綠、lint 0 error（3 舊 warning）；本機 `npm run build` 被沙盒 EPERM 擋（同 CSS 無關，postcss 單驗 OK），build 交 Vercel 驗；未提交
  - fix（泡沫太素＋看不出可点＋扇形不该收，用户回报）：泡沫重画（溢出盖＋淌下两道＋质感点＋酒液高光），按钮 56px→64px，红色呼吸光环＋行动指向提示 pill（首点前），按钮上移到 bottom-24 让开右下角拥挤区；相机类操作（缩放±／回位／全港）点后扇形保持展开可连点，只有选酒收起让位抽屉；16 tests／tsc 全绿、lint 0 error；未提交
  - fix（闲置无提示＋按钮搬左下，用户回报）：3 秒无点击杯子摇晃一次（有限遍数，不循环），20 秒无操作弹漫画气泡（带尾巴，取代小 pill），任意点击重置计时；点开后时间戳存 localStorage，12 小时静默；按钮搬左下（MOCK badge 让位搬左上），扇形标签镜像到按钮右侧；16 tests／tsc 全绿、lint 0 error；未提交
- **UR 1.4 — 扇形加拍照入口＋按钮沉底（[✓] 用户已验收）**
  - 扇形加第 6 格「拍照推荐」（accent 高亮主入口，选酒上一格），点后跳 `/camera` 整页（和 Bento 拍照卡一致，不碰 CameraFlow）；心情合并只做扇形侧，Bento 心情卡不动
  - 啤酒按钮 bottom-24→bottom-14；扇形展开时底部状态 pill 自动隐藏让位，收起即回；16 tests／tsc 全绿、lint 0 error（3 旧 warning）；未提交
  - fix（沉底不生效的根因，用户回报）：沉底的 max＋env 任意类被 Tailwind 扫描器静默丢弃（编译产物查无此规则，兄弟规则正常）——定位改纯 CSS Module（`.fabDock`／`.fabLifted` 互斥），扇形动态 delay 类同病，改 CSS 变量 `--fan-delay`（错峰动画至此才真正跑起来）；16 tests／tsc 全绿、lint 0 error；未提交
  - fix（hydration 崩＋卡片展开时按钮浮空，用户回报）：静默期 localStorage 懒读致服务端／客户端首屏分叉——改 useSyncExternalStore（server 快照恒 false）；dial 行为改隐藏：卡片展开时整个 dial 不渲染（删 fabLifted），关卡即回左下角；16 tests／tsc 全绿、lint 0 error；未提交
  - fix（沉底屡修不生效的真根因，用户定位）：关闭的扇形格 opacity-0 但仍在流内占位，column-reverse 把啤酒垫高约 360px——扇形格改绝对定位（CSS 变量逐格定高，脱流），关闭态容器只剩啤酒，真正贴角；16 tests／tsc 全绿、lint 0 error；未提交
- **UR 1.6 — 全港找人＋双人同框＋实时距离（[✓] 用户已验收）**
- **UR 1.7 — 首页地图独占＋顶部菜单（[✓] 用户已验收）**
- **UR 1.8 — 想喝打卡回看面板（[✓] 用户已验收）**
- **UR 1.9 — 前端数据目录＋harness 数据检查规则（[✓] 用户已验收）** `[docs-only]`
- **[harness]** Step 1 加開工門禁（記憶回顧未報備不許進 Step 4）＋ Step 7 加改動回寫 UR（`改動記錄`＋CHANGELOG fix 行＋memory 三处互索引）；UR1.8／UR2.0 已按新规则补改動記錄 `[docs-only]`
- **UR 2.0 — 想喝卡片加头像性别（[✓] 用户已验收）**
- **UR 2.1 — 打卡面板锚定到 pin 旁（[✓] 用户已验收）**
- **UR 2.2 — 顶部菜单弹出重设计（[✓] 用户已验收）**
- **UR 2.3 — 酒类品牌大目录（[SKIP]，用户决定先跳过，目录保留未提交）** `[docs-only]`
- **UR 2.4 — 品牌去重＋手绘 icon（[✓] 用户已验收，merged＋pushed `b7aad54`）**
- **UR 2.5 — 搖一搖找附近酒友（[✓] 用户已验收）**
  - `lib/shake.ts` 纯函数选中（haversine＋24h 窗口，mock 加 `checkedInAt`）＋4 单测；`hooks/useShake` 双跃变判定＋3s 冷却＋iOS 权限；MapFab 卫星圆钮（card 底＋品牌色图标）＋5min 抖（独立 quiet key）；声纳三层（软闪＋双环追逐，1250ms 卸载）＋toast 三态；设计返工走 design-taste-frontend（redesign-preserve）；44→48 tests／tsc 全绿、lint 0 error
- **UR 2.6 — 随机推荐面板接入品牌插畫（[✓] 用户已验收）**
- **UR 2.7 — 结果面板插畫主角化（[✓] 用户已验收，含 pins 追加＋想喝 pin 修漏，merged）**
- **UR 2.8 — 睇全港视图防挤＋数据点动态适应（[✓] 用户已验收，merged）**
- **UR 2.9 — 摇一摇手感：触发 rattle＋prime tick＋真震动（[WIP]，待手机验收）**
- **UR 3.8 — 随机推荐两层面板（[✓] 用户已验收，merged）**
  - `lib/beers.ts` 精簡七大類＋`BEERS.category` 映射（`BEER_CATEGORIES`／`beersInCategory`／`categoryOfBeer`／`pickRandomBeerIn`，rand 可注入）＋`lib/beers.test.ts` 8 單測（映射全覆蓋無孤兒／類內抽取／未知類 null）；`pickCategoriesTitle`／`pickSameCategory`／`pickChangeCategory`／`pickDirectWant`／類名×7 三語
  - 面板三態：CTA → L1 七類二列貼紙格（主鈕進 L2＋每類＋鈕直接想喝＝隱性補全，背後抽真品牌走同一 `dropWant`）→ L2 品牌結果（大類眉題＋有圖手繪主角位沿 UR2.7＋想喝／同類換一款／換品種三鈕）；`handleWant` 拆 `dropWant(beer)` 核心，UR3.7 換酒維持全域不動，`handleSelfPick` 改開 L1
  - 90→98 tests／tsc 淨／lint 0 error（3 舊 warning）；`npm run build` 本機 sandbox 被攔（老問題，待用戶側復核）；數據文檔無需更新（`WantRecord` 形狀不變，零新增持久化）
- **UR 3.9 — 批量推薦網格（[✓] 用户已验收，merged）**
  - `lib/beers.ts` 新增 `pickRandomBatch(categoryId, count, rand)`（Fisher-Yates 洗牌取前 N，未知類回退全局，不重複，不改原數組）＋ `lib/beers.test.ts` ＋5 單測（批量去重／長度 capped／未知回退／可注入／不改源）；`pickNextBatch` 三語
  - 面板 L2 單品牌結果改批量網格：進 L2 即見一批（默認 6＝3 列×2 行，小類如紅酒 1 款就顯示全部）＋「換下一批」同類內重洗（查重試 3 次盡量不全等）／「換品種」回 L1；點格即 `handleBatchWant`→`dropWant` 落真品牌釘（RAW：不再有單獨想喝按鈕，L2 內點即落釘）；沿塗鴉 border-2＋硬陰影卡片，有圖 h-16 手繪／無圖 emoji
  - 98→103 tests／tsc 淨／lint 0 error（3 舊 warning）；`npm run build` 本機 sandbox 被攔（老問題，待用戶側復核）；數據文檔無需更新（`WantRecord` 形狀不變，零新增持久化）
- **UR 4.0 — 推薦面板拋光（[✓] 用户已验收，merged）**
  - 承接 UR3.9 v1之後四輪返工，用戶指令正名為 UR4.0；代碼見 `97d89f8`／`d0936c6`，本次零代碼改動
  - fix v2（用戶返工：L1 類別列改橫向手繪輪詢卡＋自己紀錄換酒改批次自選）：`shuffleTake` 共用核心＋`pickSwapBatch`＋2 單測，`laneCount` 三語；103→105 tests／tsc 淨／lint 0 error
  - fix v3（用戶返工：開板空 CTA／輪詢無滑動感／打卡卡被下緣遮擋）：`openPickSheet` 直達 L1（啤酒鈕／深鏈／空足跡 CTA，空 CTA 留兜底）；L2 批量改照片輪詢（主角卡＋peek＋箭頭／點點＋`batchIn`／`laneIn` 進場，reduced-motion 關）；錨定卡 `ResizeObserver` 量高＋內層 `maxHeight` 滾動兜底（根因：開批後高度變了錨點仍用舊值）；`pickPrev`／`pickNext` 三語；105 tests／tsc 淨／lint 0 error
  - fix v4（設計師評審＋用户确认＋號退役）：`category-art` 七類手繪代表圖（L1 零 emoji；品牌級缺口待 UR2.3／2.4 管線）＋`laneCardSize`＋定妝旋轉／膠帶＋彈簧按壓／交錯進場／待機浮動＋＋號退役（刪 `handleLaneWant`／`pickDirectWant`）；105→107 tests／tsc 淨／lint 0 error
  - fix v5（用戶返工：L2 卡太大頂出面板）：卡面壓小＋間距收緊，整組落回一屏；107 tests／tsc 淨／lint 0 error
  - fix v6（用戶返工：二級格子還是太大）：再壓一檔（w-70%／h-20／去 tagline 行）；107 tests／tsc 淨／lint 0 error
- **UR 3.7 — 我的打卡可编辑（[✓] 用户已验收，merged）**
  - `swapWantBeer`（同条只换 beer，时间位置不动）＋`removeWantAt`（按 at 删）＋3 单测；面板编辑行：换酒副钮（摇到不同为止）＋删除两段确认（删后看最新、删光关卡清状态）；`swapBeer`／`deleteEntry`／`confirmDelete` 三语；87→90 tests／tsc 净／lint 0 error；`npm run build` sandbox 老问题
- **UR 3.6 — 他人打卡面板重构（[✓] 用户已验收，merged）**
  - 根因：X 绝对定位右上＋名字行 flex 不换行无右避让；X 升级贴纸＋名字/meta 行 `pr-10`＋flex-wrap＋在线态下沉 meta 行；头像水彩 blob（`.waterWash`）＋和纸胶带（`.tape`）＋波浪分隔线；约喝酒副钮降级＋动作区换行；纯排版零新逻辑、无新单测；tsc 净／lint 0 error／87 tests；`npm run build` sandbox 老问题
- **UR 3.5 — 左上城市状态卡（[✓] 用户已验收，merged）**
  - `lib/visit.ts`（`wtd-last-visit` 本地 mock：`touchVisit`／`patchVisitArea`／`shouldShowLastPlace`＋5 单测）＋左上城市卡（Building2 瓷砖＋城市名／上次在线／登录态三色＋条件上次地点行）＋删 hero 顶双 pill；`cityName`／`meOnline`／`meLocating`／`meOffline`／`lastSeenAt`／`lastPlaceAt` 三语
  - 80→82 tests（visit 2 单测）／tsc 全绿、lint 0 error（3 旧 warning）；sandbox 禁监听 dev server 跑不起来，待用户本地 `npm run dev` 亲眼验收后再 commit
  - 追加工（用户要手绘城市图标＋三端资源）：`public/city-icons/` 港京沪穗深 5 枚＋`lib/city.ts` 判定＋`CityIcon` 按需加载＋`docs/city-icons.md` 规范；82→87 tests／tsc 净／lint 0 error；`npm run build` 本机 sandbox 被拦（老问题，tsc／lint／test 全绿照常合）
  - 返工（用户：凭印象画全错）：Wikimedia 实拍对照重绘 v2→v3（中銀退台 X 撑／祈年殿红 tier 相连／明珠大下球三足／小蠻腰极瘦銀針／春筍竖肋倒 V 撑）；香港改维港全景（96 格：太平山＋天際線＋海＋天星小輪）＋瓷砖放大到 64px 压过字；门不变
- **UR 3.0 — 碰杯特效＋乾杯双边记录（[✓] 用户已验收含 v2 返工，merged）**
- **UR 3.1 — 摇一摇毛玻璃晃杯时刻（[✓] 用户已验收含溢泡 v2，merged）**
- **UR 3.2 — 每日乾杯 15 次上限（[✓] 用户已验收，merged）**
- **UR 3.3 — 附近在线＋约喝酒（[✓] 用户已验收含在线去 pill 化，merged）**
- **UR 3.4 — 我的足迹模式（[✓] 用户已验收含史槽＋同店顶替，merged）**
  - 四子任务：`lib/footprints.ts` MOCK 6 站＋3 单测；MapFab 第 7 动作（Footprints）；同图叠层（红虚线＋序号钉＋永久酒名签，他人 `wtd-others` 置灰，进场飞全轨迹）；浮条＋显式返回＋空态 CTA；`footprints`／`trailTitle`／`trailBack`／`trailEmpty` 三语
  - 数据文档：home-map 七、我的足迹节＋六节涟漪残留行修正；未来直读 `checkins`，无新表
  - 72→75 tests／tsc 全绿、lint 0 error（3 旧 warning）；`npm run build` 本机 sandbox 被拦（老问题，待用户侧复核）
  - fix（用户纠正）：足迹 6 站换我自己的 venue（离他人钉 300m＋，单测锁死）；75→76 tests
  - fix（用户再纠正：只有 1 个点）：删编造站，足迹直读 `wantRecord`（`lib/trail.ts`＋2 单测，无则空态）；74 tests／门禁全绿
  - fix（用户报 bug：加酒清旧数据）：`wtd-want-history` 史槽（上限 30＋迁移＋3 单测），pin 层一史一钉可点回看，`trailStops` 改吃数组；77 tests／tsc／lint 0 error
  - fix（用户报 bug：同位置叠钉）：`upsertWantHistory` 10m 同店顶替（新替旧，不叠）；80 tests／门禁全绿
  - 在线：`lib/nearby.ts`＋4 单测（5min 窗＋5km，含未来心跳 skew）；`Checkin` 加 `onlineAt`＋`declinesInvite`；pin／头像绿点＋在线 pill；`checkins.test.ts` 循环断言补两行，`shake.test.ts` fixture 补字段
  - 邀约四态：副按钮→已发出（有限跳）→成局条＋震／婉拒条＋可再约（Mandy 拒）；`onlineNow`／`inviteCta`／`inviteSent`／`inviteAccepted(+Detail)`／`inviteDeclined` 三语
  - 数据文档：`users.last_seen_at`＋`drink_invites` 同行状态机＋替换清单；home-map 三行同步
  - 68→72 tests／tsc 全绿、lint 0 error（3 旧 warning）；`npm run build` 本机 sandbox 被拦（老问题，待用户侧复核）
  - fix：render 内 `Date.now()` impure→now 快照＋调用点传参；en ICU 单引号坑（It's→Deal!）
  - fix（用户验收返工）：在线 pill 去 pill 化（区名后绿点＋绿字）；门禁不变
  - `lib/cheers.ts`＋5 单测（HK 日期键／上限／剩余额／服务端无 window）；DrinkMap 按天 hydrate＋提交持久化＋额度小字＋满额 disabled＋守卫；`cheersLeft`／`cheersLimitReached` 三语
  - 数据文档：future-schema 服务端按天拒绝口径（429＋created_at 索引＋不加计数列）；home-map `sentIds` 行同步按天
  - 63→68 tests／tsc 全绿、lint 0 error（3 旧 warning）；`npm run build` 本机 sandbox 被拦（老问题，待用户侧复核）
  - 雷达涟漪退役：毛玻璃罩（bg-card/40＋backdrop-blur-sm，pointer-events 关死）＋w-40 大杯 ±14° 猛晃 7 下＋速度线＋两粒飞沫＋`shakeSearching` 三语；`SHAKE_SEARCH_MS = 1250` 时序不变，到点拆罩聚焦
  - 63 tests／tsc 全绿、lint 0 error（3 旧 warning）；`npm run build` 本机 sandbox 被拦（老问题，待用户侧复核）；Step 9b：零新增数据字段，数据文档无需更新
  - fix（用户验收返工）：速度线改杯两侧交替闪（跟摆动节拍对齐＋向外冲），不再是杯下静态横线；门禁不变
  - fix（用户验收返工 v2）：速度线整组删除，杯体慢摆 3 下＋三股溢泡（左右错峰淌＋泡顶涌起）；63 tests／tsc／lint 0 error
  - 卡内碰杯时刻：两杯摆入＋冲击环＋泡沫粒＋“乾杯！”大字（1.3s＝CHEERS_FX_MS，纯 transform／opacity，reduced-motion 不渲染直接收据）＋BUZZ_CHEERS 双叮震；提交走 `cheersFx` effect 定时，计数乐观＋1，连点守卫＋按钮 disabled
  - 数据文档（以后实现）：future-schema `cheers` 加 `to_user_id`＋一行双读口径（发送方 sent／接收方 inbox 各＋一条，不做镜像双行）；home-map `sentIds` 行同步＋`cheersFx` UI 纯状态行
  - 62→63 tests／tsc 全绿、lint 0 error（3 旧 warning）；`npm run build` 本机 sandbox 被拦（老问题，待用户侧复核）
  - fix（lint）：mount effect 同步读 matchMedia 写 state 撞 set-state-in-effect，包 microtask（UR1.8 配方）
  - fix（用户验收返工 v2）：特效更大更久更手绘——杯放大＋星形冲击＋速度线＋5 泡沫＋碰杯颤动＋贴纸大字，1.3s→2.2s 结尾淡出；门禁不变（63 tests／tsc／lint 0 error）
  - 卫星钮 `.fabRattle` 0.5s 横向衰减抖（`shakeBurst` 计数＋key 重挂，600ms 归零还槽位给 idle wobble）；`useShake` 加可选 `onPrime` 第一晃确认；`lib/haptics.ts`＋3 单测（成功／失败两套震型，无 API 回 false）
  - 59→62 tests／tsc 全绿、lint 0 error（3 旧 warning）；`npm run build` 本机 sandbox 被拦（老问题，待用户侧复核）；Step 9b：零新增数据字段，数据文档无需更新
  - fix（lint）：React 19 refs 规则——cleanup 读过的 ref 别处不许写，burst 归零改 `shakeBurst` effect 自清理；注意 iPhone Safari 无 vibrate API，只能动画补偿
  - 聚合优先（用户定方向）：`lib/clusters.ts` 纯函数 `clusterPoints`＋`clusters.test.ts` 4 单测；他人 pin 层 `renderOthersPins` 首帧＋zoomend 重建，单成员原样单钉、多成员 `.pinCluster` 数字簇（点之 zoom＋2 散开，reduced-motion 降级）；`clusterTitle` 三语；`OTHERS_CLUSTER_PX = 64`
  - 55→59 tests／tsc 全绿、lint 0 error（3 旧 warning）；`npm run build` 本机 sandbox 被拦（老问题，待用户侧复核）；Step 9b：聚合是纯视图派生、零新增数据字段，数据文档无需更新
  - fix（工具链踩雷）：JSON 脚本 `json.dump` 参数写反把 `messages/en.json` 截断归零——`git checkout` 恢复后重做，diff 逐文件验干净
  - design-taste-frontend redesign-preserve：结果卡／想喝卡／别人卡同构左图右信息（有图 h-28／h-24 主角＋key 入场，无图保持默认；别人卡头像 h-16）；`.pickArtIn` 300ms 唯一动效，reduced-motion 回显；tsc 全绿、lint 0 error、51 tests
  - `BEER_WALL` 加 `pickId`＋`iconForPickId()`（第一顺位，无则 null）；结果卡命中（heineken／asahi／tsingtao）渲染 h-16 手绘图，其余 12 种原 emoji；`BEERS` 不增删，pin marker 和想喝行不动；`wall.test.ts` 3 命中＋唯一性；48→51 tests／tsc 全绿、lint 0 error
  - 去重：脚本掃 18 簇＋人工判定，真重复 4 组（Asahi／Suntory／Harbin 小麦／Wusu 残行）合并，7 个错文件真品牌转正归位；全库 1144，脚本复核归零，标题数＝实际行
  - icon：`beer-icons/` 手绘 SVG 10 品 v3（共享框＋独立 filter id，墨线主题色＋品牌定色填色）＋临时预览路由 `/preview-beer-icons`（[locale] 段内）；v1 凭印象失真，v2 起逐品看真实产品图重画（Wikimedia 9＋官网 packshot 1，看完删参照）：Asahi 巨黑字生字八角框／藍妹米白罐椭圆章／Corona 对开标金章／青島椭圆章栈桥徽／Hoegaarden 刻面杯／Heineken 颈星椭圆绿标／Kirin 银罐金麒麟／Yebisu 金罐／少爺红功夫裤／茅台红标白斜带；画法沉淀为 skill `beer-icon`；44 tests／tsc 全绿、lint 0 error
  - icon batch1＋2（各 10，预览墙共 30）：按目录顺序＋家族去重（1144－25＝1119 待画，台账 `11-icon-progress.md`）；batch1 拉格组／batch2 墨巴组，逐品看图；frame 加类型 caption 条（`typeLabel`，BEER_WALL `type` 同步，manifest 带类型）；`npm run export:icons` 顺带产移动端（纯 SVG＋iOS 三件套＋Android 五密度＋manifest，resvg＋sips，无需浏览器）；44 tests／tsc 全绿、lint 0 error
  - 追加（用户 follow-up，待浏览器验收）：他人 pins 有图→方形 `.pinArt` 放大钉（56px，设计稿内联 divIcon）无图→原 emoji 圆钉；别人卡有图→酒图 h-24 主角＋头像角标；`iconForDrinkName`＋`BRAND_ALIASES`（最长优先，修 Negra Modelo 错配）；`wall.test.ts` 加 4 matcher 单测；51→55 tests／tsc 全绿、lint 0 error；fix（用户验收：自己选青島 pin 仍是 emoji）——想喝 pin 从未接映射，补 `iconForPickId(picked.id)` 有图款（`.pinArtWant` 红框＋声纳圈，和他人墨色钉区分），想喝卡存的就是 picked 本体映射本就对；`npm run build` 在本机 sandbox 被 Turbopack 起子进程绑端口拦掉（CSS 经 postcss 独立校验通过），待用户侧 build 复核
  - `docs/data/beer-catalog/`：分类总纲 12 大类（`00-taxonomy.md`，用户修订：类别先行）＋品牌 10 文件合计 1148 条（官网首页 logo 来源，`待验证` 隔离存疑）
  - 抽查 12 条：9 个 200（含 4 个正典域名纠正），3 个奢侈品牌 403 反爬已注行内；lint 0 error；未提交
  - 同架构进化：icon tile＋大字＋右箭头，行高 56px；行 stagger cascade（CSS 变量错峰，避扫描坑）；触发钮 Menu↔X 变形；零新文案、无 backdrop、z-1100 不动
  - Step 9b：纯视觉，零新增数据，数据文档无需更新；44 tests／tsc 全绿、lint 0 error；未提交
  - 三种卡改锚定浮层（pin 上方＋尾巴指向，贴边翻面／收边，拖图即关）；内容三分支原样搬迁，镜头逻辑不动；`lib/anchor.ts` 纯几何＋5 单测
  - Step 9b：零新增数据字段，数据文档无需更新；44 tests／tsc 全绿、lint 0 error；未提交
  - 回看卡片头：`MOCK_ME`（`lib/me.ts`，avatarEmoji＋gender 三态，默认 secret）头圈＋性别 pill，酒 emoji 并入酒名行；三语文案；无新单测（静态常量＋纯展示，同 UR1.5／1.7 口径，浏览器覆盖）
  - Step 9b 第一次实战：`docs/data/home-map.md`＋`future-schema.md`（users 桩位落定）同步；39 tests／tsc 全绿、lint 0 error；未提交
  - fix（用户纠正两处）：① 他人乾杯卡漏头像性别——`Checkin` 加 `avatarEmoji`＋`gender`（mock 四人男／女），卡片头圈换人、性别 pill、酒 emoji 并入饮酒行，单测加新字段断言；② 上轮 9b 不全——他人新字段补进目录＋替换清单＋backlog 推翻“另开 UR”；39 tests／tsc 全绿、lint 0 error；未提交
  - 新建 `docs/data/`（README＋home-map＋photo-mood＋app-shell＋future-schema）：每字段四列（页面位置／类型／当前来源／未来表映射），MOCK 逐字段标，附未来表草图＋MOCK→真替换清单＋UR2.0 头像性别桩位
  - harness 加 Step 9b：每次功能后检查数据文档是否同步，无变化 commit 留痕；未提交
  - 落「想喝」瞬间快照 `{beer, at, position}` 进 localStorage（POC，用户决策：逆地理留到 native）；「想喝」marker 加点击，复用底部卡片新分支显示酒＋时间＋经纬度＋冻结说明
  - `lib/wantRecord.ts` 纯函数（parse 校验＋HK 时区时间＋坐标格式化）＋9 单测；刷新后 pin＋记录自动回来；新一轮推荐退役旧快照；31 tests／tsc 全绿、lint 0 error（3 旧 warning）；未提交
  - fix（用户验收反馈）：时间补年份并按语言定式（中文 `2026年9月5日 14:32`／英文 `2026-09-05 14:32`，formatToParts＋HK 时区）；地点联机逆地理真名（Nominatim＋memoize＋存回 storage，断网回落经纬度）；39 tests／tsc 全绿、lint 0 error；未提交
  - fix（bug：点圆圈没反应＋旧记录消失，用户回报）：两根因——① `handleSelfPick` 从 UR1.1 起就没开过 sheet，UR1.2 抽屉化后这条路静默无反应，补 `setSheetOpen(true)`；② UR1.8 退役旧快照放错地方（re-roll 即清），改只在新想喝落下时覆盖，旧 pin＋记录同生共死；39 tests／tsc 全绿、lint 0 error；未提交
  - 首页删 `BentoGrid` 整段（4 文件 `git rm`，git 历史可找回）；header 加汉堡菜单（Base UI dropdown，涂鸦重皮肤：border-2＋硬阴影＋font-hand＋44px 触点）
  - 三项：今晚喝什麼→`/?pick=1` 深链（回地图＋飞当前位置＋展扇形＋自动开选酒面板，手動终态一致）、拍照→`/camera`、心情→`/mood`（删 Bento 后心情唯一入口）
  - 深链跨导航状态同步：`useState` 初始化＋`false→true`  transition effect 双保险；开面板／飞镜头双闩（定位后到不吞镜头）；22 tests／tsc 全绿、lint 0 error（3 旧 warning）；未提交
  - 点他人 pin：`fitBounds(self, TA)` 两人同框＋开卡（任何视图都触发）；无定位时只飞对方单点，卡片显示开定位提示（用户已确认两点）
  - 卡片加距离行：render 内纯算 `haversineMeters(selfFix, TA)`，随 watch 实时更新；`lib/geo.ts` 新增 `haversineMeters`＋`formatDistance` 纯函数＋6 单测，三语文案；22 tests／tsc 全绿、lint 0 error（3 旧 warning）；未提交
  - fix（顶部下拉被地图盖住，用户回报）：Leaflet panes z-200–1000 > dropdown 预设 z-50，下拉被瓦片压住——`components/ui/dropdown-menu.tsx` 的 Positioner＋Popup 统一 `z-50` 改 `z-[1100]`，UI primitive 层一次修，下拉任何使用点都受益；注解标明 Leaflet pane 范围，下次维护不再凭直觉写回 `z-50`；build／lint 全绿、`.z-\[1100\] { z-index: 1100; }` 已验证进 compiled CSS；未提交
- **UR 1.5 — 扇形整行可点（[✓] 用户已验收）**
  - 扇形每行 `div＋button＋span` 改单个 `<button>`：图标退为纯视觉 span，文字和图标同一点击区、单个 tab stop，行为沿用既有 `action.run`（keepOpen 连点规则不变）；按压缩放反馈走 `group-active:` 平移到圆形上；16 tests／tsc 全绿、lint 0 error（3 旧 warning）；未提交
- Muse Code harness 對應（與 Claude / opencode 同步）
  - `.agents/skills/` — `harness-workflow` / `code-review` / `github-api`（內容同 `.opencode/skills/`，查 API 改用 `web_search` + `web_fetch`）
  - `AGENTS.md` 新增 Muse 工具 / 插件對應段（Muse 讀本檔為專案規則；不另建 `.muse/settings.json`）
- Stitch MCP：key 存 `.env`（`STITCH_API_KEY`，gitignored），`.env.example` 加佔位；Muse 側配 `~/.config/muse/settings.json` → `mcp_servers.stitch`（streamable_http，見 `.memory/2026-09-04-stitch-mcp-setup.md`）
- **UR 1.5 — 首頁正式開發（doodle 單風格，WIP 未驗收）**
  - `lib/themes/presets/doodle.ts` — 07 POC 精確色票 token 化，註冊為預設（其他 preset 保留無入口）
  - `app/[locale]/layout.tsx` — 移除主題／語言切換器 UI（基建保留）；`components/marketing/hero.tsx` — 筆記本 hero＋程序化塗鴉杯（token 驅動）；標題字換 Caveat 手寫體（`<link>` 載入，見 memory）
  - 待用戶側跑 `npm run build`＋瀏覽器驗收（sandbox 內 Turbopack／dev server 起不來）
  - fix：`LOCKED_THEME_ID` 鎖死 doodle（殘留的 flat-illustration 深底曾劫持首頁）；次卡 teal／粉實底、全卡 2px 墨線、hero 補酒花麥穗氣泡（貼近 07 POC）
  - detail pass：hero 加膠帶、手寫旁注、星星愛心、杯上粉色 W·D 徽章、標題紅波浪線；三卡片加迷你塗鴉（瓶杯／手機／心形氣泡）
- **UR 2.1 — 拍照喚起與權限處理（WIP，待真機驗收）**
  - `components/camera/camera-flow.tsx` — 單屏 entry（用途＋PDPO 同意＋雙入口，一次點即同意，仍獨立於原生彈窗）；拒絕→重試＋上傳，永久封鎖→設定指引，無相機→直接上傳；拍攝止於縮圖＋重拍（後續屬 UR2.2）
  - `lib/camera.ts` — 純函數錯誤分類＋能力偵測（待 vitest 落地補 test）
  - 待用戶真機驗收（sandbox 無相機）：允許／拒絕／封鎖／上傳四條路徑
- **UR 2.2 — 拍照後輸入補充（WIP，待真機＋咪驗收）**
  - `CameraFlow` 加 `review` 階段（同頁延續，免跨路由傳圖）：大預覽＋重拍／換源、選填文字（500 字＋計數）、`VoiceRecorder`（錄音鍵＋計時＋60 秒自動停＋回放重錄，轉文字留 UR2.3）、可空送出→收到確認＋再來一張
  - 無障礙：錄音中文字＋跳動點＋aria-live，全原生 button／textarea；待用戶真機驗（相機＋咪）
- **UR 2.3 — 語音轉文字（WIP，待訊飛 key 實測）**
  - 訊飛 IAT v2（`lib/iflytek.ts`，由舊專案實證模式移植，Node 原生 WebSocket 免新依賴）＋`app/api/transcribe`（粵→普→英順序兜底，key 全放 server）
  - 瀏覽器側 `lib/audio.ts`（webm 解碼→16k 單聲道→WAV base64）；錄完自動轉、可改、可重試、失敗回打字；送出 bundle 帶 note＋transcript
  - 待訊飛 APP_ID／API_KEY／API_SECRET 做粵語實測（AC1–AC4 全要真錄音驗）
  - redesign（taste skill）：筆記改橫線紙＋膠帶＋手寫計數；錄音改圓形錄音鍵＋計時＋60 秒真實進度軌＋自訂播放（去 emoji，換 lucide）；送出改全幅藥丸＋硬陰影＋按壓動效；EN 文案去 em-dash

- harness：新增 `workflow.md` Step 3.5——UI 設計相關改動（新頁面／redesign／tokens／動畫／layout primitives）寫 code 前先調設計 skill（`stitch-design`／`design-taste-frontend`／`taste`），品牌層（doodle）不可動；同步 `.harness/README.md`、`harness-workflow` skill（`.agents/`＋`.opencode/`）、`AGENTS.md` 工具對應表

### Planned
- 等用戶從 20 張風格圖選定方向，把更多 theme preset 填進 `lib/themes/presets/`
- 用戶會在 backlog 補首頁詳細需求，屆時替換 sections 的 placeholder 內容
- 裝 vitest，補 theme registry 的 unit test（呼應 `.memory/2026-09-01-skipped-unit-tests-before-commit.md`）

## [0.7.0] — 2026-09-02

### Added
- **UR 1.2 — 語言與主題切換元件**
  - `components/language-switcher.tsx` — segmented control（3 按鈕：繁/简/EN），常駐顯示、`aria-pressed` 狀態
  - `components/theme-switcher.tsx` — 雙軌：桌面 Popover（anchored）+ 手機 Sheet（bottom）
  - `components/theme-preview-card.tsx` — 主題視覺縮圖，**局部套用 theme tokens** 確保預覽反映主題實際樣貌
- **shadcn 新元件** `components/ui/popover.tsx`（base-ui Popover）+ `components/ui/sheet.tsx`（base-ui Dialog）

### Changed
- `app/[locale]/layout.tsx` — 用 `LanguageSwitcher` 取代 `LanguagePicker`（dropdown）、用 `ThemeSwitcher` 取代 `ThemePicker`（dropdown）
- 移除 `components/language-picker.tsx` 與 `components/theme-picker.tsx`（被取代）

### Memory
- `.memory/2026-09-02-base-ui-popover-sheet-pattern.md` — 同 trigger 不同 viewport 行為的雙軌設計、local CSS vars 預覽手法

## [0.6.0] — 2026-09-02

### Added
- **i18n architecture (next-intl 4.x + Next.js 16)**
  - `i18n/routing.ts` — `defineRouting({ locales: ["zh-Hant","zh-Hans","en"], defaultLocale: "zh-Hant", localePrefix: "never" })`
  - `i18n/request.ts` — `getRequestConfig` loads messages per locale
  - `proxy.ts` — Next.js 16 renamed from `middleware.ts`, runs `createMiddleware(routing)`
  - `messages/{zh-Hant,zh-Hans,en}.json` — translation files for all 3 locales
- **`app/[locale]/` route segment** — required by next-intl for URL routing; was ` (marketing)` before (didn't work — proxy rewrites to `/zh-Hant` with no matching route)
  - `layout.tsx` — `NextIntlClientProvider`, `ThemeProvider`, header (theme picker + language picker + sign-in CTA), Footer
  - `page.tsx` — Bento Grid (UR 1.1)
  - `camera/page.tsx` — stub
  - `mood/page.tsx` — stub
- **`components/language-picker.tsx`** — header dropdown; switches cookie + `window.location.reload()`
- **Theme + language i18n** — `useTheme()` + `useTranslations()` integration across nav, footer, Bento cards, metadata title
- **Bento Grid (UR 1.1)** — 3 cards in asymmetric CSS Grid
  - `RandomPickCard` (client, in-place expand with state machine: idle → loading → result / timeout)
  - `PhotoPickCard` (server, Link → /camera)
  - `MoodRecCard` (server, Link → /mood)
- **`lib/beers.ts`** — 15-entry mock beer catalog + `pickRandomBeer()` pure function

### Changed
- **Route structure** — all pages moved into `[locale]/` segment (was `(marketing)` + `(app)`)
- **`components/ui/button.tsx` style** — `buttonVariants` now imported directly into ThemePicker / LanguagePicker instead of using Button wrapper (base-ui's `render` prop doesn't pass children)
- **`components/ui/dropdown-menu.tsx`** — wrapped Label/Items in `DropdownMenuGroup` per base-ui's MenuGroupContext requirement

### Memory
- `.memory/2026-09-02-next-intl-requires-locale-segment.md`
- `.memory/2026-09-02-base-ui-dropdown-patterns.md`

## [0.5.2] — 2026-09-02

### Changed
- `.harness/workflow.md` — Step 10 拆成 10a-10d，明確「含 UI 變更的開發完成後必須啟動瀏覽器讓用戶親眼確認才 commit」；純文檔/config/refactor 例外
- `CLAUDE.md` — 硬規則區塊新增此條，並列 Step 10 摘要

### Memory
- `.memory/2026-09-02-user-must-verify-ui-in-browser.md` — 用戶糾正：vision tool 不是用戶確認的替代品

## [0.5.1] — 2026-09-02

### Fixed
- `<Button render={<a>}>` 在 5 處加 `nativeButton={false}`，消除 Base UI 的 5 條「nativeButton expected」console warning（影響 accessibility 與表單語意）

### Changed（防禦性，順手加）
- 字級 mobile 從 `text-4xl` 降到 `text-3xl`（hero h1）/ `text-3xl` 降到 `text-2xl`（section h2）— 窄螢幕更穩
- `text-balance` / `text-pretty` → `break-words` — 對未知長度更 robust
- `<body>` 加 `overflow-x-hidden` — 兜底防意外
- `<Stack>` 加 `min-w-0` — flex container 防 overflow 通用守則

### Memory
- `.memory/2026-09-02-skipped-playwright-step-6.md` — 漏執行 Step 6 的紀錄
- `.memory/2026-09-02-chrome-headless-screenshot-unreliable.md` — Chrome headless `--screenshot` 在 CJK 字型渲染不可靠，視覺回報可能是 false alarm；改用 playwright

## [0.5.0] — 2026-09-02

## [0.4.0] — 2026-09-02

### Changed
- `.harness/workflow.md` 重寫為完整 10 步流程：理解需求 → 思考確認 → 工具查 API → 寫碼 → 驗證 → 瀏覽器測試 → 修正 → memory → 日誌 → 確認提交。每步有 input/output 與降階條件。
- `CLAUDE.md` 加入硬規則摘要：未確認不 commit / 新 lib 先查 API / 邏輯錯立即修並重走 step 3-7 / 每次修正要寫 memory

### Added
- `.memory/2026-09-02-workflow-10-step-process.md` — 記錄這次 workflow 升級的決策與理由

## [0.3.0] — 2026-09-01

### Added
- **`.harness/` 目錄** — 團隊開發規範，分五個面向：
  - `README.md` — 索引與讀取時機
  - `workflow.md` — 任務流程、提交前檢查清單
  - `coding-standards.md` — TypeScript / React / 檔案結構 / 命名 / import 順序 / 不做清單
  - `testing.md` — 何時必寫 unit test、commit gate、例外標記
  - `git.md` — 分支策略、commit 格式（type/scope/subject/body/footer）、不可做清單
  - `architecture.md` — 技術棧決策與原因、theme 系統設計、待補 ADR
- **`.memory/` 目錄** — 教訓紀錄，初始 5 條：
  - `README.md` — 格式規範（四段：情境/問題/原因/修正）
  - `2026-09-01-skipped-unit-tests-before-commit.md` — 跳過 unit test 的疏漏
  - `2026-09-01-git-post-buffer-large-commit.md` — git 2.15 push 7MiB commit 失敗
  - `2026-09-01-shadcn-uses-base-ui-not-radix.md` — shadcn 新版用 base-ui 不是 Radix
  - `2026-09-01-node-version-pinning-required.md` — Node 22 是 hard requirement
  - `2026-09-01-co-authored-by-apostrophe-shell-escape.md` — Bash commit message 含 apostrophe 報錯
- **`CLAUDE.md` 補上** — Claude Code 啟動時必讀 `.harness/workflow.md` + `.memory/`，每次開發任務開始前先檢查
- **`.nvmrc`** — 寫入 `22`，讓 `nvm use` 自動選對版本
- **`package.json` engines** — `node: ">=22"` 明確聲明最低版本

### Changed
- 沒有改既有功能，純加規範基礎建設

## [0.2.0] — 2026-09-01

## [0.2.0] — 2026-09-01

### Added
- **Theme system 骨架** — `lib/themes/` 下建立 registry + 4 個 preset：
  - `nova`（shadcn Nova 預設，留空 tokens 用 globals.css 預設值）
  - `flat-illustration`（深 navy + 暖琥珀 + 圓角）
  - `neo-brutalism`（白底 + 酸黃 + 紫紅 + 零圓角 + 粗黑邊）
  - `watercolor`（米白 + 淡彩 + 大留白 + 大圓角）
- `components/theme-provider.tsx` — client component，把 theme tokens 套到 `<html>` 的 inline style，存 localStorage
- `components/theme-picker.tsx` — header 右上角下拉選單，用 `render` prop（base-ui API，不是 Radix asChild）切換 theme
- `app/layout.tsx` — 包 `<ThemeProvider>` + `<ThemePicker>`，標題改為 `Whattodrink — 今晚喝咩？`
- `app/page.tsx` — 改成 Tonight's Pick landing prototype：標題、CTA、active theme 預覽卡（列出每個 token）、token 規則說明
- `.env.example` — 列出 `github_key` / `minimaxi_api_key` / Supabase / Claude / Google Places 的 placeholder 與申請連結

### Changed
- `package.json` — Next.js 16.3.4（原本想裝 15，環境是 Node 18 太舊，改升級 Node 22 後裝 16）+ React 19.2.8 + Tailwind v4 + `@base-ui/react` (shadcn 新 base 庫)
- `.gitignore` — 保留 Next.js 預設，加上 `.claude/`、`!.env.example` allowlist

## [0.1.0] — 2026-09-01

### Added
- 初始化 Next.js 16 + React 19 + Tailwind CSS v4 + TypeScript + ESLint scaffold
- 建立 `docs/PRODUCT_BACKLOG.md`（原 `product backlog.md` 移入）
- 建立本 `CHANGELOG.md`
- `.gitignore` 排除 `.env*`、`.claude/`、`.staging/`、`node_modules/`、`.next/`
- `.gitignore` 允許 `.env.example` 提交（給團隊協作的環境變數範本）
- `README.md` 寫入專案概覽、文檔索引、技術棧、開發指令、設計原則
- GitHub repo 建立：`https://github.com/cntk50951-eng/whattodrink.git`

### Notes
- Node 版本要求 22+（`nvm use 22`）
- `UI style/` 目錄保留 20 張風格探索圖（MiniMax image-01 生成），作為 design system 選型參考
