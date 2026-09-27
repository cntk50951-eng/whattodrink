# 2026-09-27 UR C.8 高德試水＋edit 誤刪 import 教訓

## 情境

- 用戶指令試水高德底圖（可隨時換回）：新建 `lib/maps/provider.ts`（env 開關＋瓦片工廠＋自動回退）＋`V2MapView` 接線，v2-only，編號 C.8（C.7 被並行線佔用，新人讓路）。
- 工作區是並行髒樹（同伴 batch4＋C.7 未提交）：自建分支 `feat/c8-amap-trial`，只碰自己的文件。

## 問題

- 我的 import 改寫把 `haversineMeters` 一併刪掉（`read` 顯示的行數與實際文件差一行，`oldString` 照樣匹配成功），`tsc` 報 3 錯才發現。
- 另：閉包內用外層 `let map: Map | null`，TS narrowing 失效報 `possibly null`。

## 原因

- `edit` 的 `oldString` 匹配不如想像中嚴格（缺一行也能命中）——不能假設"能匹配即全對"。
- `let` 跨閉包 narrowing 本來就不保留（本站已有同類 lint 經驗，UR2.9 refs 配方）。

## 修正

- `haversineMeters` 原樣補回（diff 逐行驗）；`map` 改 `const created` 凍結非空實例給閉包用，tsc 全淨。
- 教訓：任何改 import 的 edit 後必跑 `tsc`＋`git diff` 逐行自查；commit 前只交自己的文件（`git status` 對名單）。
- 三閘：test 271 綠（含 provider 8 測）／lint 0 error（V2MapView 1 warning 經 stash 驗證屬 HEAD 舊債）／tsc 淨；build 按老問題待用戶側。

## 追記（09:50 推送前）

- 並行線 09:35 的 `a6193d8`（C.7）把我當時未提交的 tracked 改動（backlog C.8 節／.env.example MAP_PROVIDER 段／CHANGELOG C.8 條）整塊吸入——batch3a 鏡像事故（上次是被覆蓋丟失，這次是被吸入他人 commit，內容無丟但歸屬混了；`rtk grep \|` 誤報零命中，改 `git log -S` 才定罪，工具鏈坑再記一次）。
- 教訓：並行髒樹下，tracked 文件的未提交改動＝隨時會被同伴 `commit -a` 吸走；重要里程碑要麼即時 commit 到自己分支，要麼先留 untracked 筆記保底。
- 用戶親驗通過，C.8 置 [✓]；用戶拍板分支合入 main＋push（連同伴 C.7[WIP]＋harness 文檔一起上，Vercel 遠端 amap 變量已配，重部署即生效）。
