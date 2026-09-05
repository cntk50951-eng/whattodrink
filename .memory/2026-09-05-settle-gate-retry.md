# 2026-09-05: one-shot settle gate 必須跟著重試重置

## 情境

用戶回報：localhost 點過拒絕後再允許，地图仍停在全港視圖、無圓點，
看起來像「開了定位也沒用」。

## 問題

settle effect 用 `settledRef` 保證只飞一次鏡頭；但重試成功不重置它，
marker 建立＋flyTo 全在 gate 後面——先拒後允的用戶永遠到不了那段代碼。

## 原因

「只做一次」和「重試再做一次」是同一狀態機的兩條邊，卻只寫了一條邊的
轉移條件。凡 `useRef` 做的 one-shot gate，必須同時回答「什麼事件重置它」。

## 修正

1. 所有重試入口收斂到 `handleRetryLocate()`（重置 gate＋調 hook retry），
   指引卡按鈕／小 pill／回位鈕退化路徑全走它，不再直調 `retryGeo`。
2. settle 內部冪等化：marker「無才建」＋鏡頭「未 settle 才飛」，
   watch 後續更新只動點（follow effect 本來就這樣）。
3. 此模式檢查清單：新加任何 one-shot ref gate，先寫重置點。
