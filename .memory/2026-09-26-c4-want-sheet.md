# 2026-09-26 UR C.4 v2 自打卡底部 Sheet（DEF-013／014）

## 情境

v2 自家想喝釘浮動小卡只有 emoji 圓＋酒名＋時間：不能換酒、無品牌圖。用戶要底部 Sheet 式 snapshot，對標 v1 欄位＋用戶資訊，未來放圖片。

## 問題

- DEF-013：v2 want 卡無換酒入口（v1 UR3.7／3.9 有完整配方）。
- DEF-014：卡片寫死 emoji 圓；快照直用，DB 回退行（name＝beer_id、emoji＝🍺）錯得更徹底。
- round-2 追加：地圖釘仍 emoji（v1 自釘亦 emoji，但用戶要 v2 更進一步）。

## 原因

- C.1 只做了唯讀文字正規形（`V2Card` 無 beer 字段），`BeerImg` 只用在選酒 L2。
- divIcon 拼字串，URL 不可信，需轉義＋scheme 限。

## 修正

- want 釘改開底部 Sheet（自帶 `v2scope`；浮動卡只留他人；關層重置態）；主角位 `BeerImg key={fresh.id}`；換酒批／點格即換／兩段刪全搬（共用純函數只讀調用；離線寫本地／登入走 session，server 換酒另開 UR）；用戶行＋距你 km＋圖片佔位槽（`v2.wantPhotoSoon`×3）。
- 地圖釘：`V2WantMarker.iconUrl`，有圖白底琥珀環，`escAttr`＋`^https?://` 限。
- 合規收尾：`resolveWantBeer` 下沉 `lib/beers.ts resolveFreshBeer`（加法，v1 未用）＋4 單測（id 取新／名兜底／原樣返回／換源跟新）。
- 三閘：245綠／lint 0 error／build 39頁；用户浏览器验收通过。
- 教訓：同文件連續 edit 兩次吞舊函數（`esc`、`beerByName`），皆即時補回——大 edit 後先 grep 驗舊符號還在，再跑 lint。

## 關聯

- 缺陷：DEF-20260926-013／014（Closed）；關聯 UR C.4 [✓]，已合入 main
