# 2026-09-17 URC 1.2 A3 Link no-op bug（Tonight's pick 重複點擊沒反應）

## 情境
URC 1.2 A3：beer → L1，Tonight's pick → L2 全域隨機抽。
實作：BottomNav 的 Tonight's pick 用 `<Link href="/?pick=any">`，page.tsx 接
`pick === "any"` 後傳 `initialPickRandom=true` 給 DrinkMap，effect 開 sheet。

## 問題
用戶回報：tap 啤酒 → L1 開 → 關 L1 → tap Tonight's pick，**沒反應**。

## 原因
雙重陷阱：
1. **Next.js Link 同 href no-op**：用戶已在 `/?pick=any`（先前測試留下），再 click
   同一 href 的 Link，Next.js 視為 no-op、不重 render、不重新觸發 page.tsx。
2. **effect latch 死鎖**：`pickAnyOnce.current` 初始 false，第一次 effect 跑 → set true；
   後續 URL 沒變 → effect 不重跑 → latch 卡 true → 即使再觸發也跳過。

兩者疊加：用戶 click Link → URL 沒變 → effect 不跑 → 不開 sheet。

## 修正
Tonight's pick 從 `<Link>` 改成 `<button onClick={onRandomPick}>`：
- `onRandomPick` 直接呼叫 `handleRandomPick()`（DrinkMap 內），內部 setSheetOpen +
  pickRandomBeer + pickRandomBatch + setPicked 等
- 不走 URL，每次 click 都觸發
- `/?pick=any` deep-link 仍保留給初次訪問者（effect path 還在）

## 教訓
**action trigger 不要依賴 URL 變化**：用 `<button onClick>` 而非 `<Link>`。
- Link 適合跨頁跳轉（`/wall`、`/mood`、`/camera`）
- 同頁 action 應該用 button + state（避免 Next.js 同 href no-op + latch 死鎖）
- deep-link 留給「可分享的初始狀態」（如 `?pick=any` 給外部連結），不是為了按鈕觸發