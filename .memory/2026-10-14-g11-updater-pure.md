# 2026-10-14 — UR G.11 updater 內套 setState（StrictMode 炸）

## 情境

- 烘焙撤销：初版 `setBake(prev => { setHist(...); return ... })`（updater 內再調 setState）。

## 原因

- updater 必須純：StrictMode 雙調 updater 即入棧兩次，历史翻倍。lint 不捉，全靠手感。

## 修正

- 事件側直寫：讀 render 域當前值，先 `setHist([...h, cur])` 再 `setBake(next)`，updater 只做純拼接。

## 判例

- 凡「A 變順手記 B」，一律事件處理裡兩行寫完，永不把第二個 set 藏進第一個的 updater。
