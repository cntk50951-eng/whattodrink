# 2026-09-26 UR A.20 酒圖本地優先（local-first）

## 情境

用戶拍板：酒圖漸多，API 取圖鏈太長；源頭本就在本地（`BEER_WALL`＋exported 移動端已落地），web 應同源直讀。方向 local-first＋fallback、React SVG、全覆蓋。編號 A.20（動 v1＋共用層，不進 EPIC C）。

## 問題（犯過的錯，本輪重點記）

1. **無語義 edit**：順手把 C.1 註釋換行格式改了，立刻還原——不做無語義 edit（C.1 教訓重蹈未遂）。
2. **連吞舊函數兩次**：加 `resolveFresh Beer` 時吞 `beerByName`、加 `escAttr` 時吞 `esc`——大 edit 後必 grep 驗舊符號還在，兩次皆即時補回。
3. **edit 殘尾**：WallIcon 替換 `return (` 留下舊 JSX 尾巴，lint 前自查發現即刪——替換塊含開口時必讀驗尾部。
4. **eslint-disable 貼錯行**：`static-components` 報在使用處（JSX 行）不在定義處，連貼錯兩次——先讀報錯行號再下筆。
5. **vitest 無 `@/` alias**：之前全綠是因 type-only import 被擦掉沒真解析，value import 才爆——被測檔直引的源文件一律相對路徑。
6. **硬編碼池尺寸兩處**：`beers-api.test` 的 `15` 改 `PRISTINE.length`；`pickNextBatch` 耗盡池斷言改回 `count`（A.20 後池 31＞count，舊斷言只在池＜count 時成立）。
7. **rule 誤判要繞不要壓**：`static-components` 在有 hooks 組件裡禁一切動態 tag——解為無 hooks 的 `WallIcon` 靜態殼（`doodle.tsx`），不再各寫 disable。
8. **陳舊 `.next` 毒 build**：dev server 跑著時 prod build 報 `routes.d.ts` 一堆錯——`rm -rf .next` 重建即綠，與代碼無關。

## 原因（round-4 真根因，DEF 級）

- 選酒格圖小：初判框的問題（tall 3:4），改完用戶仍說小。agent-browser 量出 svg 實Render 16×16——shadcn Button 自帶 `[&_svg:not([class*='size-'])]:size-4` reset，無 size- 類的 svg 一律壓 16px；v1 手搓 button 無此規故正常。修為三處品牌 svg 改 `size-full`（自帶 size- 即豁免），實測 96×128。
- 教訓：跨層問題（CSS 層壓倒想當然的 class）靠猜三輪不如直接量一次；`getBoundingClientRect`＋分層查 stylesheet 定罪最快。

## 修正

- 靜態 15→42＋baijiu lane＋catBaijiu×3；wall 全 30 pickId＋覆蓋鎖；BeerIcon／BeerImg／地圖釘 local-first；`resolveFreshBeer` 共用加法＋4 單測；DEF-015 microtask 卸載；DB／API 零動。
- 並行 batch3a（另 dev，未驗收）纏在 wall.ts／wall.test.ts／CHANGELOG——備份混合檔→checkout→只重做我的 hunks→提交→原樣恢復，零碰對方工作（用戶指令不管新圖）。
- 三閘（我的子集，扣 batch3a 2 測）：248綠／lint 0 error／build 39頁；用户 v1＋v2 雙端驗收通過。

## 關聯

- 缺陷：DEF-20260926-015（Closed）；關聯 UR A.20 [✓]，已合入 main
