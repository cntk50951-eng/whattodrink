# 2026-09-26 icon batch3a：靜態缺口首批 5 枚（啤酒 lane 收尾＋威士忌＋清酒）

## 情境

- 30 枚拉格畫完後，靜態目錄（`lib/beers.ts` 41 枚）剩 12 枚無圖，v2 選酒 Sheet／地圖釘露 emoji。
- 用戶拍板：補靜態缺口 12 枚，分 5 枚小批；首批 Guinness＋IPA＋山崎12＋角嗨＋獺祭45。

## 問題

1. 本機 `curl` 全斷（`FAILED: curl`，裸調／`rtk` 前綴皆死）——skill 第 1 節要逐張看 Wikimedia 參照直圖，做不到。
2. 舊單測寫死 `yamazaki-12`／`角嗨 Highball`／`本地精釀 IPA` 為 null，畫完即紅。
3. `精釀` 泛稱映射：首個非品牌精確映射（IPA 通用杯），自由文本含精釀即中。

## 原因

1. 沙盒斷網是已知坑（2026-09-04 去重篇已記）；v3 教訓原文允許「搜圖描述、官網、包裝報導」三種參照，不只直圖。
2. UR2.6 舊斷言只 cover 當時 3 命中，屬預期內翻轉。
3. BEERS 的 `ipa` 本就是泛稱（本地精釀 IPA），圖只能是演繹版；Young Master 有演繹先例。

## 修正

- 參照改多源文字 livery 交叉：Guinness 官網（黑罐金豎琴白字弧）／Suntory 官網
  （Kaku 方瓶龜甲紋＋黃標無角字，角嗨認黃方瓶剪影）／Dassai 官網（45 取代 50，
  2019 起標準款）＋包裝報道＋搜圖描述；backlog 如實記「未看直圖」，送審由用戶定奪。
- 文件：`guinness-draught.tsx`／`craft-ipa.tsx`／`yamazaki-12-year.tsx`／
  `kaku-highball.tsx`／`dassai-45.tsx`（filterId `*-wobble` 無撞車，grep 驗過；
  typeLabel 世濤／印度淡艾／單一麥芽／高球／大吟釀）＋barrel＋`wall.ts`
  （pickId＝`stout`／`ipa`／`yamazaki-12`／`highball`／`dasai-45`，與 BEERS id
  逐字對，覆蓋鎖單測即驗）＋別名 5 組＋`wall.test.ts`（2 新增，2 舊翻轉）。
- 三閘：250 綠（全庫 30 文件）／lint 0 error／tsc 源碼淨（僅 `.next/dev/types`
  生成物舊噪，stash 前後一致，非本輪引入）。
- `export:icons`：35 圖（svg＋@4x＋iOS 三件＋Android 五密度＋manifest type 全對）。
- 預覽頁零改（自動讀牆）；v1／v2 共用層純加法，舊行為零動。
- 教訓：開工前 `git status` 先看髒樹——本輪樹上有他人未提交改動（v2／messages／
  lib/beers.ts 等），提交時只揀自己 7＋導出物，不碰他人文件。

## 關聯

- 管線 UR2.4（[✓] 不動，加版本註記）；靜態缺口 12→7（杯組 4＋酒杯組 3 待續批）。
