# 2026-10-14 — UR G.10c 客戶端禁引服務端模塊（node:crypto 炸包）

## 情境

- G.10b `V2GameBidPanel` 直引 `@/lib/games/liars` 的 `isValidBid`；tsc 過、vitest 過，但該模塊頂層 `import { randomInt } from "node:crypto"`，進客戶端包即炸（G.10b 已 push，隱患帶漏）。

## 原因

- tsc／vitest 跑在 node，不捉瀏覽器打包問題；只有 `npm run build` 會現形。G.10b 只跑三閘沒跑 build。

## 修正

1. 叫骰合法性改客戶端鏡像 `clientBidCheck`（lib/gameRoom.ts），文案逐字同，單測 fuzz 逐案對齊服務端 `isValidBid`。
2. `lib/gameChat.ts` 常量（24 快捷鍵＋60）本地鏡像，不引 `@/lib/games/rooms`（服務端大模塊）；單測斷言兩邊相等防漂。
3. 補跑 `npm run build` 全過。

## 判例

- 客戶端組件禁引 `lib/games/*`、`lib/api/*` 路由側模塊（頂層多半有 node／supabase 依賴）；要複用一律鏡像＋對齊單測。
- 凡首引服務端純函數進客戶端，當輪必跑 `npm run build`（tsc 綠不代表能打包）。
