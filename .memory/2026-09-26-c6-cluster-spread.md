# 2026-09-26 UR C.6 v2 簇釘散開看每枚（五輪收斂）

## 情境

用戶上報：數字簇（如 9）一點只會 zoom，看不到每一枚。

## 問題（五輪）

- round-1 蜘蛛圓：用戶否（不要圓形畫面）。
- round-2 fitBounds：仍是圈（同坐標 fit 到頂也分不開）。
- round-3 散 pin：實現完改問設計，未驗。
- round-4 列表 Sheet：用戶否（要在地圖上散開）。
- round-5 定稿：fit＋散 pin＋酒圖釘面；用戶又報「還是圈」。
- round-6 真根因：markers 只跟數據不跟 zoom——zoom 到頂徽凍著不散；另 40m 門檻把疏簇擋在散 pin 外。修為 `zoomend` 重建＋門檻保留。
- round-7 釘面：散開的枚顯示人名首字，用戶要酒圖標。

## 原因

- 簇是像素概念：同一地理分佈在不同 zoom 下聚散不同，不跟 zoom 重算就永遠看不全。
- 釘面首字是 C.1 唯讀卡時代的殘留；酒字段 pins API 現成（drinkName／drinkEmoji），本地 SVG 注入沿 A.20 配方。

## 修正

- 簇徽 fit 最佳視野（padding＋maxZoom＋同點 pad；reduced-motion 關動畫）。
- `zoomend` 重建 markers（疏簇自然散，密簇留徽再點）。
- 同點（<40m）散 pin ~20m 地理真 pin；空地／切簇／失配收攏。
- 他人釘面：本地SVG注入＞酒emoji＞首字（`V2Marker` 加 drink 兩字段＋v2Pins 單測）。
- agent-browser 實測：9→4+5→單枚鏈通；釘面品牌瓶圖＋emoji，字母消失。
- 三閘：257綠／lint 0 error／build 39頁；用户手機驗收通過。

## 關聯

- 關聯 UR C.6 [✓]，已合入 main（插畫並行施工，只交 C.6 hunks，拆車見 A.20／C.5 memory）
