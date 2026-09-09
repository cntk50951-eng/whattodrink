# 2026-09-09 UR4.1 拍照分享排行榜（開工，全四畫面一輪）

## 情境
- 用戶：開始 UR4.1，功能＋UI 需求都給了（raw 四畫面＋AC＋UI 規範＋協作流程），要求整理分析並實現。
- 按 Step 1–2 先重述＋三路徑（A 分三批／B 一大單／C 等後端），三問全按推薦拍板（分批／mock／選單＋路由）後置 [WIP]；raw 內「UR 3.9」按編號規則正名 UR4.1。

## 問題
1. vitest 跑 node 環境無 localStorage，新 posts 覆寫測試兩掛。
2. lint：autoStart effect 在 begin 聲明前調用（TDZ＋memoization 雙錯）；render 期 Date.now.（WallGrid hot 排序）。
3. PostDetail 多餘 jsx-a11y disable（規則未啟用，變 unused 警告）。

## 原因
1. 舊測試全繞開 storage，新 lib 第一個吃 storage。
2. effect 放錯位置；now 快照順手寫 render。
3. 照抄別處 disable，沒核規則開關。

## 修正
1. 測試檔頂最小內存 stub（lib 懶讀，頂層定義即生效）＋beforeEach 清。
2. effect 搬 begin 之後＋microtask；now 收進 state（mount 取一次）。
3. 刪 disable。
- 本輪實現備忘：`lib/posts.ts`（種子時間相對加載／讚覆寫／檢舉藏／20 篇 cap／audio 內存 Map）；相機 `?auto=1`＋首用說明卡（`wtd-camera-consent`）＋全螢幕預覽＋≤1024 下採樣＋分享直達詳情；`/wall`＋`/wall/[id]`＋選單牆項紅點；150ms 輕讚（`likePop`）vs 乾杯重儀式；轉錄 hunks（他人未提交）原樣保留。
- 門：107→120 tests／tsc 淨／lint 0 error（3 舊 warning）。9b：future-schema＋photo-mood 雙邊同步。

## v2 追記（主頁互動榜＋社交 composer，design-taste skill 已載）
- Design Read：redesign-preserve（塗鴉貼紙語言不動），dials 沿用 Variance 7／Motion 5+1／Density 4；CSS-only 不裝依賴，reduced-motion 全守；新文案零 em-dash。
- `HomeHotBoard`：主頁地圖下方熱門三卡橫滑（名次章＋行內讚＋看全部進牆；空牆不渲染）。「實時」＝掛載＋視窗回焦重讀，不偽造讚跳動（mock 誠實口徑）。
- 分享 composer：照片 hero（重拍／換源收角落圓鈕）＋頭像＋行內 caption（sr-only label 留可及性）＋語音收成附件 chip（有錄音才展開，刪回 chip）＋黏底分享條；`MOCK_ME.avatarEmoji` 單源。
- 門不變（120／淨／0 error）。

## v3 追記（互動榜推倒重來，地圖收折件）
- 用戶：榜要是地圖的一部分（可收折、入口清晰、有動效、點開放大），下方區塊方案作廢。
- 修正：`HomeHotBoard.tsx` 整檔刪（同輪未合併、無殘留）＋`page.tsx` 還原；新 `MapHotBoard` 掛地圖容器右上（羅盤下方 `top-24`，城市卡／FAB／sheet 全避開；`z-[1000]` 對齊 `.above` 語義）。
- 收起＝#1 縮圖＋榜名＋live 點（animate-ping＋motion-reduce 關）＋chevron；展開＝grid-rows 動畫下拉三名＋行內讚＋看全部；sheet 蓋上 microtask 自動收（effect 內同步 set 會撞 set-state-in-effect，沿既定口徑包 microtask）。
- 門不變（120／淨／0 error）。
