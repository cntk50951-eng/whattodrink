# 2026-09-04: 設計 skill 怎麼用在既有品牌上（UR2.2 review 重設計）

## 情境

用戶批評相機補充頁的筆記／錄音／送出「不符合現代 UI、體驗差」，要求調 skill 重想。

## 問題

taste 系列 skill 的預設值（禁手繪裝飾 SVG、禁 emoji、現代中性）跟本專案已定品牌（07 手繪 doodle、Stitch 原稿）直接衝突——照單全收會洗掉品牌。

## 原因

兩邊 skill 自己都寫了：用戶明確要求勝過預設。品牌層（奶油紙、墨線、手寫字、塗鴉）是 PM 定案不可動；能動的是產品做工層（表單、按鍵、層次、動效）。

## 修正

1. 先輸出 design read 再動手，之後的新設計需求都照做。
2. 採用（做工層）：lucide 替 emoji（Mic/Square/Play/RotateCcw/PencilLine/ArrowRight，專案本來就依賴 lucide）；單一圓角規則（卡片圓角、按鍵全藥丸）；真實進度軌（60 秒刻度＋圓點，不畫假波形）；按壓動效（active 位移＋陰影收）；EN 文案去 em-dash（CJK 的——是正規標點，保留）。
3. 不採用：禁手繪 SVG（品牌即手繪，原稿 Stitch 亦然）、中性色（品牌色是 benefit 不是 debt）、dark mode 雙測（單一樣式階段，鎖死 doodle）。
4. 細節坑：`bg-(--x)/15` 這類 var＋透明度要獨立編 CSS 確認有生成（escape 後 grep）；textarea 橫線紙的行高必須跟背景梯度週期一致（28px 對 28px）；拿掉 focus ring 前先補替代可見焦點。
