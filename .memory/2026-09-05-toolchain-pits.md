# 2026-09-05: 工具鏈三坑（npm 緩存／vitest 版／set-state-in-effect）

## 情境

UR1.1 需裝 leaflet＋vitest，並寫 `hooks/useGeolocation.ts`（mount 即請求定位）。

## 問題

1. `npm view/install` 報 EPERM：`~/.npm/_cacache` 混入 root-owned 文件。
2. `vitest@5` 與專案 `@types/node@20` ERESOLVE 互斥（vitest 5 要 node types ^22/24）。
3. mount 內同步 `request()` 觸發 `react-hooks/set-state-in-effect` error。

## 原因

1. 歷史某次 sudo npm 留下的髒緩存，與專案無關。
2. vitest 大版本 peer 收緊，舊 types 跟不上。
3. 規則只允許 effect 內的 async continuation 調 setState；idle→locating
   的同步遷移正好撞線（DrinkMap 內 async init 的 setMapReady 反而沒事）。

## 修正

1. 本機所有 npm 命令加 `--cache /tmp/npm-cache`（任務結束已刪），根治要
   `sudo chown -R $(id -u):$(id -g) ~/.npm`（留給用戶在自己終端跑）。
2. 釘 `vitest@^3`（相容 @types/node 20），`npm test` = `vitest run`。
3. mount 請求改 `void Promise.resolve().then(() => request())` 包一層 microtask，
   state 初始值 server／client 統一 "idle"（防 hydration mismatch），註解寫明原因。
