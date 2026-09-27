# 2026-09-27 UR C.11 一鍵足跡（登入續跑＋C.9 分組＋虛線）

## 情境

- 用戶：一鍵看我所有打卡（匿名先登入、登入後不斷）；多點按剛實現的規則 Group；用足跡開發；底部欄足跡↔心情換位。
- 補充拍板：足跡＝我全部記錄＋動態虛線＋飛最佳比例（不另起列表）。

## 問題

- v2 足跡是純開關（不飛鏡頭、無登入門）；`?trail=1` 續跑需經 OAuth 跳轉，參數在 isAuthed 落定前就被清會斷流。
- C.9（錨徽＋fit）在並行線手裡未提交：依賴它但不能碰它。

## 原因

- mount effect 讀參數記 intent（ref）即清參數；登入 effect 只認 intent＋isAuthed，兩步拆開才不斷流。
- C.9 只讀復用（groupByAnchor／v2area／fit 口徑），重複小段 fit 內聯＋註記「合入後合併」，比改它文件的風險便宜。

## 修正

- `fitPoints`＋`onReady`（V2MapApi 加法）；足跡層 z≤11 錨徽（單站退序號釘）＋虛線行軍蟻（`v2trailDash`，reduced 靜止）；`handleTrailTab` 三入口統一；登入浮層＋`?trail=1` 續跑；tab 換位；`parseTrailResume`＋2 測。
- 三閘：test 285 綠／lint 零新增／tsc 淨／build 綠；待用戶親驗。
- 教訓：v2 登入浮層不要复用 LoginPanel（doodle 味＋next 寫死 `/`），OAuth 調用 8 行直寫＋next 帶參更乾淨。

## 追記 round-13（動畫取消，2026-09-27）

- 用戶指令：目錄保留，腳印動畫取消另立需求。
- 修法：渲染调用全撤（序號釘＋錨徽保留）；`interpolateFootprints`（有單測）＋`at`＋CSS 休眠留用；DEF-002 關閉。
- 三閘全綠（test 301／lint 淨／tsc 淨／build 綠）；待用戶複驗靜態足跡（關面板保留＋徽＋釘）。

## 追記 round-6（熱力→腳印流，2026-09-27）

- 用戶：熱力不夠明顯；改按時間順序腳印動畫（組內最新為向），淺色不浮誇，不用虛線。
- 修法：`interpolateFootprints`（相鄰站插腳印＋50km 斷腿＋總量 cap，4 測）＋`V2TrailMarker.at`；z≤11 組內連腿／境外連腿（斷腿擋跨洋），z≥12 全路徑；朝向方位角＋左右交替＋delay 取模循環；`v2heat`／dash／pulse／trailRef 退役刪淨（grep 零殘留）。
- 三閘重綠（test 289／lint 1 舊 warning／tsc 淨／build 綠）；待用戶複驗腳印流。

## 追記 round-5（跨區可見＋熱暈加強，2026-09-27）

- 用戶：跨區（HK＋美國）各一團、任何 zoom 可見；熱暈再明顯。
- 修法：HK 境內站才進錨分組（`isWithinHongKong` 切分，C.9 錨無境外概念錯區）；境外站恒獨立熱暈＋序號釘；尺寸站 76／徽 84＋14n 封頂 160；漸層加濃（.6／.2）。
- 三閘重綠（test 285／lint 1 舊 warning／tsc 淨／build 綠）；待用戶複驗跨區＋濃度。

- 動畫改慢呼吸虛線（3.2s＋opacity .55）＋終點呼吸圈（`v2trailPulse`，reduced 全靜止）；目錄 Sheet（行＝shadcn Button 包，點行即飛＋開 want Sheet；空態＋去記錄 CTA；零新 key）。
- 工具鏈兩坑：① `read` 尾部曾顯示幻影行（`/Sheet>` 等），`sed` 直讀證文件完好——以後凡尾部異常先 `sed` 驗再動手；② `tsc` 報過一次 LayoutRoutes 錯，重跑即淨（`.next/dev/types` 舊噪，batch3 已記過，同類）。
- 三閘重綠（test 285／lint 零新增／tsc 淨／build 綠）；待用戶複驗動畫＋目錄。

## 追記 round-3（目錄↔詳情斷流，2026-09-27）

- 用戶：目錄進詳情後無返回，關詳情也回不去，流程斷。
- 修法：`wantReturnTo` 狀態機（目錄來記 "stops"，地圖釘直開為 null）——返回鈕（沿 C.5 口徑复用 `trailBack` 鍵）＋關詳情自動回目錄；直開詳情永遠不帶返回。嵌套 Sheet 改顯式開關，避免層級玄學。
- 三閘重綠（test 285／lint 淨／tsc 淨／build 綠）；待用戶複驗雙向返回。

## 追記 round-7 誤報：用戶在 :3000 上驗收（2026-09-27）

- 現象：用戶說熱力＋腳印都看不到；我樹上代碼全在、閘全綠。
- 根因：`:3000` 被並行線的 server（pid 68422）佔著，我的實例被擠到 `:3001`——用戶一直在**別人的 server**上驗收，看到的是舊代碼。`curl :3000 → 200` 驗不出服務的是誰，連續誤導三輪。
- 教訓：親驗前必看 dev 日誌首行端口（`using available port XXXX`），給用戶的 URL 必須是**自己實例的真實端口**；`curl 200` ≠ 我的代碼在跑。並行期間端口先到先得，開工先 `ps` 看有無同伴 server。
- 處置：請用戶改到自己實例端口複驗；:3000 的歸同伴，絕不 kill。

## 追記 round-7（面板足跡解耦＋地圖點清，2026-09-27）

- 用戶：關面板動畫就沒——要關面板留動畫，地圖點／其他按鈕才清。
- 修法：tab 首點開面板（足跡不動順開），面板關時再點 tab 顯式關；`onMapTap`（地圖本體點，pin 圖標守衛不透）清三態；浮條返回同清面板；直寫解構漏 `onMapTap` 被 tsc 抓（TS18004）即補。
- 三閘重綠（test 297／lint 淨／tsc 淨／build 綠）；待用戶複驗解耦＋地圖點清。

## 追記 round-7 誤操作：pkill 誤殺同伴 server（2026-09-27）

- 重啟 :3002 前 `pkill -f next-server` 把同伴 :3000 一起殺了（同名進程）。
- 教訓：並行期間禁 `pkill -f <通用名>`；要清只清自己起的 PID（`ps` 先認 pid 再 `kill <pid>`）。已重起 `npm run dev` 恢復 :3000（307 正常）。
- 三閘重綠（test 297／lint 淨／tsc 淨／build 綠）；待用戶複驗解耦＋地圖點清（請到 :3002）。

## 追記 round-8（會話持久化，未驗證即暫停，2026-09-27）

- 背景：DEF-002/003 排查＋用戶拍板（統一 :3000、V2MapView 暫停等對齊）。
- 已做（未驗）：`TRAIL_ON_KEY`／`STOPS_OPEN_KEY`＋`readTrailFlag`／`writeTrailFlag`（`lib/trail.ts`）＋3 測；V2Home 讀透寫透兩 effect。**test 301 綠；tsc／lint／build 還沒跑**（用戶叫停中斷）。
- ⏸ 用戶指令：等隊友改完再繼續（防同文件衝突）。暫停前狀態：C.11 全量未提交（V2Home／V2MapView／css／lib／文檔全在髒樹）；V2MapView 凍結；DEF-002/003 續 Investigating。
- 續跑清單（隊友完事後）：① `git status`＋逐文件驗 hunks ② 補跑 tsc／lint／build ③ `:3000` 硬刷新親驗 002／003 ④ 無論結果**立即 commit 鎖定** ⑤ DEF 推进。

## 追記 round-8（DEF-002／003 確診＋DEF-005 同修，2026-09-27）

- 用戶新事實（鏡頭飛＋回位 dead＋整層消失＋無紅錯）定罪：跨區 fit 被 `minZoom: 10` 鉗到 z10 落洋中間——動畫／釘一直在，衹是不在視野裡；隔離止血退役（無重建 bug）。
- 同修 DEF-005：V2Home 回位守衛刪除（無定位直調 `recenter` 飛香港中心；v1 重請求口徑另議）。
- 跨區 minZoom 鬆綁需動 V2MapView（凍結中，已向用戶要例外）；回位是逃生口，先交。
- 三閘全綠（test 301／lint 淨／tsc 淨／build 綠）；待用戶 `:3000` 硬刷新親驗（回位＋重看足跡位置）。

## 追記 round-9（self 防抖＋腳印加顯，2026-09-27）

- 訂正：minZoom 鉗制只適用 HK＋美國極端例；用戶實案 HK＋深圳（z10-11 無鉗制）另有真兇——`watch` 每回調換對象致圖層反覆重掛（動畫永遠重播即「只播一次」；關面板是時間巧合）。
- 修法：`stableSelf` 10m 凍結（v2-only，hook 不動；microtask 沿 UR1.8）；腳印 16px＋slate-500＋峰值 .95。
- 連續兩次 edit 蓋掉鄰行註釋即補回——以後替換含註釋錨點，事後 grep 驗註釋。
- 三閘全綠（test 301／lint 淨／tsc 淨／build 綠）；待用戶 `:3000` 硬刷新親驗。

## 追記 round-10（console 實證修，2026-09-27）

- 用戶貼 console：unmounted 警告即我三處 microtask 缺守衛（round-8／9 留的債），全補 `cancelled`；hydration mismatch 在 layout（同伴文件，不碰，已告知）。
- 虛線時代為何關面板還在：同層同機制，腳印時代碼全在——剩餘變量只剩抖動重掛（round-9 已修）＋用戶端緩存／未重載。
- 三閘全綠（test 301／lint 淨／tsc 淨／build 綠）；待用戶硬刷新→無效則我重啟 `:3000`（需其確認，同伴 server）。

## 追記 ChunkLoadError（2026-09-27）

- 用戶重啟 `:3000` 報 turbopack HMR chunk 載入失敗——`.next` 緩存髒（我多次 `npm run build` 產物與 dev 共用同一目錄，重啟即對不上）。
- 修法：停服＋`rm -rf .next`＋重起（無代碼改動）；教訓：以後 build 驗完即清 `.next`，或固定用完清掉，不留給 dev 用。
- 附：連續三次 edit 蓋掉鄰段（錨點含正文即整段吞）——以後錨點只取標題行，正文另起一段追加，寫完 grep 驗行數。

## 關聯

- UR C.11 [WIP]；DEF-002／003 Investigating（待親驗後確診關）；DEF-004／005 Fixing（待親驗轉 Fixed）
