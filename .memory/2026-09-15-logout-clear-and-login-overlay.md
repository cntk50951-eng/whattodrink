# 2026-09-15 登出残留＋未登录浮层

## 情境
用戶報 3 個 bug：1. 登出後 UI 沒刷新，`wtd-*` 私帖仍在直到手動刷新；2. 登入後打卡，下次登入看不見（API 沒做）；3. 未登入打卡應彈登入浮層。

## 問題
- `lib/auth/clear.ts` 的 `clearUserLocalCaches()` 只清 `localStorage`，`DrinkMap` 的 `wantHistory/wantRecord/picked/sentIds` 與 `WallGrid` 的 `posts` 仍緩存在 React state（`useState`），`HeaderAuth` 僅 `signOut + router.refresh()`，state 不會因 `router.refresh` 而丟，導致登出瞬間地圖釘/牆私帖仍在。
- `DrinkMap.dropWant` 無未登入守衛，直接 `saveWantHistory` 寫 `wtd-want-history`，與「已集成登入+DB」預期不符。
- `lib/auth/clear.test.ts` 的 `window` stub 僅 `{localStorage}`，無 `addEventListener/dispatchEvent`，導致 `wtd:logout` 事件單測掛。

## 原因
- 之前修登出可見性（UR A.7）只想到 storage，沒想到 client state 需同步事件驅動清空；Next.js `router.refresh()` 只重渲染 server component，不會清空 client `useState`。
- `vitest` 在 `node` 環境下 `window` 需手動 stub，未補事件系統就加事件測試，掛。

## 修正
- `lib/auth/clear.ts` 新增 `LOGOUT_CLEAR_EVENT = "wtd:logout"`，`clearUserLocalCaches()` 最後 `window.dispatchEvent(new CustomEvent(...))`（try/catch 包）。
- `components/wall/WallGrid` 監聽 `wtd:logout` → `setPosts(loadWall())`（storage 已空，私帖 `me:true` 即消失）。
- `components/map/DrinkMap` 監聽清空 9 項 state（`wantHistory/wantRecord/picked/wantSaved/selectedId/swap/confirm/sentIds/cheersFx/loginOverlay`）＋ ref 同步；`dropWant` 改 `supabase.auth.getUser()` 判空→ `setLoginOverlayOpen(true)` 不寫 `localStorage`，否則走原邏輯；新增 `handleLoginFromOverlay` 直調 `signInWithOAuth → /auth/callback?next=/`；新增品牌浮層（`role=dialog`，doodle 杯＋膠帶＋硬陰影，取消/登入雙鈕，三語 `map.loginRequired*`）。
- `messages/{zh-Hans,zh-Hant,en}.json` 補 4 鍵；`lib/auth/clear.test.ts` 用 `new EventTarget()` 作 `window` stub 並掛 `localStorage`，單測加 `wtd:logout` 派發斷言。
- `docs/PRODUCT_BACKLOG.md` 拆 UR A.9/A.10/A.11（A.10 仍為 `POST /api/v1/checkins` todo），A.9/A.11 置 [WIP] 並補實現記錄；`CHANGELOG.md` 補 Unreleased 條目。

## 驗收
- `npm test` 187/187 綠（新增 1 事件單測），`npx tsc --noEmit` 淨，`npm run lint` 0 error（3 warning 舊文件），`npm run build` 綠 27 頁。
- 下一步：A.10 `POST /api/v1/checkins`（🔒）＋ `GET /api/v1/checkins/mine`，前端打卡改調 API，匿名讀不回 `private`。

## 關聯
- 涉及：`lib/auth/clear.ts:8`、`components/wall/WallGrid.tsx:8,47`、`components/map/DrinkMap.tsx:40,195,602,1301,1450,2680`、`messages/*.json`
- 測試：`lib/auth/clear.test.ts:3`
