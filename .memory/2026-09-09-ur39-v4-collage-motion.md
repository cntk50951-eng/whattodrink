# 2026-09-09 UR3.9 v4 設計評審返工（拼貼＋全手繪＋微互動）

## 情境
- 設計師書面評審五點：均勻網格機械感；貼紙太齊無手工感；插畫覆蓋不均（僅啤酒真圖）；零動效（要彈簧按壓／交錯進場／待機浮動／慣性）；＋號語義不明。用戶讓繼續改；＋號去留問過用戶，定案拿掉。

## 問題
1. L1 七卡等大、等角、等膠帶，紅酒等類只有 emoji —— 排面像「啤酒認真做、其他隨便」。
2. L1／L2／換酒批全靜態（進場僅整條淡入），無按壓回饋、無待機生命感。
3. `handleLaneWant`（L1 直打）隨＋號退役，`Plus`／`pickRandomBeer` import 變 dead。

## 原因
1. v2 只求「有圖」，用品牌代表圖＋統一版式，沒做品類級視覺。
2. 動效只做到「有」，沒做到「觸感」。
3. 入口收斂的連帶清理，漏了就變 lint error。

## 修正
- 新 `components/marketing/beer-icons/category-art.tsx`：七類通用器皿手繪（杯／壺／缽，沿 BeerIconFrame＋wobble＋主題墨線＋固定 canonical  fills），各唯一 filterId，無 typeLabel（卡已印名）；`CATEGORY_ART` 全覆蓋，L1 零 emoji。品牌級缺口（L2 仍有 emoji 回退）記缺口待 UR2.3／2.4，不管線外硬畫（skill：品牌圖須照實拍）。
- `laneCardSize`（lg≥4／md2–3／sm≤1，單測鎖含當前極值）＋`LANE_SPIN`（±3–6）／`LANE_TAPE`（7 位）／奇偶 `mt-2` 錯落，全 index 定死。
- 微互動：卡鈕彈簧 `ease-[cubic-bezier(0.34,1.56,0.64,1)]`（hover 放大＋陰影加深，active 縮；觸控無 hover 自動退化 press）；`lane-in` 改彈簧 easing；`laneFloat` 待機 ±2px／5s／相位錯開（浮層掛內層圖，與進場動畫不同元素，UR2.5 單動畫教訓）；L1 strip 加 `overscroll-x-contain`（防鏈式滾動搶手勢，原生 momentum／rubber-band 保留）；reduce 全關（沿文末慣例）。
- ＋號退役：刪 `handleLaneWant`＋`Plus`／`pickRandomBeer` import＋`pickDirectWant` 三語 key；`pickRandomBeerIn` 留 lib（有單測，無 dead 問題）。
- 門：105→107 tests／tsc 淨／lint 0 error（3 舊 warning）。9b：零新增數據，無需更新。

## v5 追記（L2 卡太大頂出面板）
- 用戶：二級主角卡太大、高度與面板不配。修法：卡 w-78%→72%、圖 h-36→h-24、名 text-lg→base、膠帶縮小、雙鈕 mt-3→mt-2，整組落回半屏一屏。純排版零邏輯，門不變（107／淨／0 error）。教訓：半屏 sheet 內容件要先算總高（眉題＋卡＋點點＋雙鈕 ≤ 50% 屏），大圖先給小尺寸再放大，不要反過來。

## v6 追記（二級格子還是太大）
- 用戶：v5 後格子還是大（且 sandbox 起不了 dev／瀏覽器，無法親眼對照，只能憑估算再壓）。修法：w-70%、圖 h-20、名 text-sm、整行 tagline 移出卡面（tagline 仍在落釘後想喝卡可見，零數據損失），單卡約 116px。門不變。若用戶屏上仍無變化，首查其 dev server 是否跑在舊代碼（重啟＋hard refresh），因工作樹 diff 確認 v5／v6 皆已落地。
