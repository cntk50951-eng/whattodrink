# 2026-09-13 URC 1.0 toolbar absolute 跳出 flex 流（重疊 bug）

## 情境
URC 1.0 把地圖工具列收進地圖組件（A1：城市卡下同列堆疊）。我寫了
`MapToolbar` + 在 `DrinkMap` 包了 `flex flex-col items-start gap-2` 容器，
城市卡與 toolbar 是其兩個 flex 子項。Toolbar 的 CSS 寫了
`position: absolute; left: 0.75rem` 想自己錨左邊。

## 問題
瀏覽器實測：城市卡 + toolbar 都渲染在同一個 y 座標（重疊），不是垂直堆疊。

## 原因
`position: absolute` 把元素從 normal flow 抽走，flex 容器對它就當不存在——
不會被父 flex 排進 row/col，也不參與 gap 計算。我寫的 `left: 0.75rem` 把
toolbar 釘在地圖容器左邊，但 top 沒指定，落到 flow 起點 (top: 0)，
跟城市卡完全重疊。

DOM 驗證：
- 城市卡：`top: 84, height: 84`（被 flex 排在第一個）
- toolbar：`top: 84, height: 60`（absolute 跳脫，top 預設 0，疊在城市卡上面）

## 修正
toolbar CSS 改 `position: relative`，left/top 都拿掉，讓父 flex 排它。
位置完全由 flex 容器的 `items-start gap-2` 決定——城市卡在上、gap-2、
toolbar 在下。

memory 點：flex-col / flex-row 容器內**不要**對子用 absolute。
要 absolute 就要把 absolute 子另開一層（自己的 wrapper），不要當 flex 子。