# 2026-10-14 — UR G.6 遇見 Sheet（lint 兩坑：effect 寫 state＋purity）

## 情境

- 新組件 `V2MeetSheet`（搜索中進度 tick＋計時起點），沿既有 `set-state-in-effect`／`purity` 門。

## 問題

1. `useEffect` 內 `setElapsed(0)` 重置計時被 `react-hooks/set-state-in-effect` 判 error。
2. 改在 `runSearch` 內 `setSearchStart(Date.now())`，又被 `react-hooks/purity` 判 impure（連事件處理內的 `Date.now()` 都捉；`ChatRoomLive` 同類寫法能過是例外語境，不可依賴）。

## 原因

1. effect 內同步寫 state 即 cascading render，規則不認「計時重置」例外。
2. purity 規則是語法級的：組件內函數聲明裡的 `Date.now()` 一律捉，不分 render／handler。

## 修正

- 計時改無時鐘累加：`setElapsed(0)` 留在事件處理（合法），effect 內只做 `setInterval(() => setElapsed(e => e + 0.5), 500)`，`Date.now` 零引用。
- 判例：新組件要做「經過秒數」提示，一律用 tick 累加，不要碰 `Date.now()`。
