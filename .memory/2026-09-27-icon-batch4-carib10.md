# 2026-09-27 icon batch4：中美加勒比 10＋收編

## 情境

- 上輪收尾：61d5ea0（icon 15 枚）cherry-pick 上 main＋合遠端 C.5＋push，
  遠端 main＝a8e28c2 已確認，用戶令繼續下一批。
- 本批：Aguila 起 10（→Red Stripe），10 整批＋同步收編（用户前批已拍板此模式）。

## 問題

1. 參照強度不均：Aguila／Balboa／Imperial／Toña／Gallo／Red Stripe 有官網＋
   包裝報道級細節；Poker 只有酒標博客（naipes 花色為核）；Regional 只有官網
   產品頁（5°＋馬拉開波為核）；Carib 只有官網品牌色（海藍為核）。
2. 雙鷹撞名：Imperial（CR）暱稱 Aguilita vs Aguila（CO）本名。
3. `rtk grep "a\|b"` 按字面處理 `\|`（沿 batch3 教訓，關鍵結論改直讀驗）。

## 原因

- 沙盒 curl 斷網延續，只能多源文字交叉；薄弱項如實標，不硬畫細節。
- bounded 正則下 `aguilita` 含 `aguila` 子串但後接字母，不會誤中；排序最長優先。

## 修正

- 10 枚：黃鷹飛／綠牌同花／白熊藍標／紅白5度／紅衣探險家／黃黑鷹／紅字火山／
  黑金雞頭／藍海金浪／斜紅帶 stubby（type 全淡拉格；Toña 轉寫 `to-a`）。
- 別名 10 組：裸 `regional`／裸 `polar` 不收（防泛詞）；Imperial 別名避 `aguila`，
  收 `aguilita`＋雙鷹歸屬單測鎖死；`imperial` 裸收（stout 流派撞名風險已記，
  沿 Kaiser 泛詞先例）；Gallo 收出口名 Famosa。
- 收編 BEERS 51→61（lager lane，tagline 港味）。
- 三閘：256 綠（wall 18＋beers 27）／lint 0 error／tsc 全淨／filterId 55 唯一
  （node 直驗）／export:icons 55 圖（manifest 抽 5）。
- 台賬：100 目標剩 60（隊頭 Presidente 起）、全隊列剩 1079；backlog 補 batch3
  欠記＋batch4；CHANGELOG 待用戶驗收後（本批未驗收不先寫）。

## 關聯

- 管線 UR2.4（[✓] 不動）；靜態缺口仍 7（杯組＋酒杯組待續，與隊列並行）。
