# 2026-09-27 icon batch3：隊列南美拉格 10＋收編＋改動被吞事故恢復

## 情境

- 用戶拍板隊列下一批：Antarctica 起 10 個（→Club Colombia），10 整批＋同步收編進 BEERS。
- 開工發現 batch3a 在 `wall.ts`／`wall.test.ts`／`CHANGELOG.md` 的改動全部消失
  （BEER_WALL 退回 30 條，單測退回舊斷言），而同批 `.tsx`×5／`index.ts`／
  台賬／backlog 註記／memory／導出 SVG 完好。

## 問題

1. 改動被吞：髒樹下他人改寫同文件（`wall.ts` diff 56 行含他人改動），
   batch3a 的三處改動被覆蓋。另 `rtk grep "a\|b"` 疑似按字面處理 `\|`
   （backlog 明明有 batch3a 卻報 0 命中），一度誤判災情更大。
2. 收編手誤：`andes` 一行 category 打成 `"larger"`（孤兒類，映射鎖必紅），
   另首版只寫 6/10 行。

## 原因

1. 未提交的 tracked 改動在多人同樹下無保護；untracked 文件（.tsx／memory）
   反而安全。教訓：未驗收批次的 tracked 改動＝易失，重要里程碑先問用戶
   commit 保底，或至少保留可重放記錄（本次靠 memory＋行文記錄原樣重放）。
2. `rtk grep` 先用基本串，`\|` 轉義不可靠——關鍵結論改直讀文件驗。

## 修正

- 重放 batch3a（wall.ts 5 import＋5 entry＋5 別名；test 2 新增＋2 翻轉；
  CHANGELOG 條）＋ batch3 新畫 10 枚（9 瓶＋Kaiser 罐；filterId 45 唯一，
  node 直驗；type 全淡拉格）＋收編 BEERS 10 行（41→51，lager lane；
  `larger` 手誤＋漏 4 行在跑閘前即修）。
- 別名 10 組：ñ 走 beerSlug 轉寫（`pace-a`／`cusque-a-dorada`，逐個驗算）；
  Cristal 只收啤酒義（latin 無裸 `cristal`，`Louis Roederer Cristal` 回 null
  單測鎖死；cjk 水晶沿目錄中文名）。
- 三閘：253 綠（wall 15＋beers 27）／lint 0 error／tsc 全淨（batch3a 時的
  `.next/dev/types` 舊噪已消失）；`export:icons` 45 圖（manifest 驗 5 抽）。
- 台賬：100 目標剩 70（隊頭 Aguila 起；Red Stripe 是第 50 行非隊頭，首版寫錯即改）、
  全隊列剩 1089；backlog batch3 註記；CHANGELOG batch3a＋batch3 雙條。

## 關聯

- 管線 UR2.4（[✓] 不動，加版本註記）；靜態缺口仍 7（杯組 4＋酒杯組 3 待續）。
