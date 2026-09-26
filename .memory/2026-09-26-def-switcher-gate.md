# 2026-09-26 切換器門檻過嚴無聲消失（DEF-20260926-001）

## 情境

UR A.16 城市卡三檔切換器上線後，用戶在 dev（已登入、已展開工具列、終端正常）看不到按鈕，按 Step 7b 落條 DEF-20260926-001。

## 問題

切換器渲染條件是 `toolbarExpanded && isAuthed === true`：`isAuthed` 是 browser `getUser()` 快照，只要延遲／失手，入口就無聲消失、零反饋，用戶無法區分「沒登入／沒展開／真 bug」。

## 原因

把「可見性」和「權限態」綁在同一個 `&&` 里：可見性應該只跟用戶的展開動作，權限（匿名不可切）應該在點擊時分流。沿打卡既有口徑（未登入點打卡彈登入浮層），切換器同理。

## 修正

- 可見只跟 `toolbarExpanded`；`mode` 改 `useMyMode(true)` 由 `GET /me` 直讀，不依賴 `isAuthed` 快照；匿名點擊走登入浮層（`handleModeSwitch`）。
- 教訓：任何「條件渲染＋無空態」的入口，條件只能跟用戶動作，不能跟異步快照；異步態一律在點擊時處理並給反饋。

## 關聯

- 涉及：`components/map/DrinkMap.tsx`（切換器條件＋`handleModeSwitch`）、`hooks/useMyMode.ts`（直讀）
- 缺陷：`docs/DEFECTS.md` DEF-20260926-001（Fixing，待用戶复验後合 main 置 Fixed）
