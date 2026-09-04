# 2026-09-04: MediaStream 必須在 video 掛載後才 attach

## 情境

UR2.1 用戶回報：權限已允許，但觀景窗全黑、拍照鍵無反應。

## 問題

`toLive(stream)` 裡直接 `videoRef.current.srcObject = stream`，但 `<video>` 只在 `phase === "live"` 才渲染——賦值時 ref 是 null，被 `if (video)` 靜默跳過，stream 永遠沒接上（黑屏）；拍照鍵檢查 `videoWidth === 0` 也靜默返回（按了沒反應）。同一個病，兩個症狀。

## 原因

條件渲染的元素不能在切 state 的同一拍裡碰 ref——setState 是異步的，ref 要下一次 render 才有。

## 修正

stream 只存 ref＋切 phase；另加 `useEffect(..., [phase])`，在 `phase === "live"` 且兩邊 ref 都齊時才 `srcObject`＋`play()`。另：`muted` 用 property 設（JSX attr 在部分瀏覽器不可靠），否則 autoplay 可能被擋。
