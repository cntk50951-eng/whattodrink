# 2026-10-03 — Bell 落点纠正（挂好友列表 pill 右上角）

## 情境

- DEF-20261003-002 修完待验时用户纠正：铃铛不应是顶部独立钮，要直接显示在“好友列表”pill 按钮右上角做提示。

## 问题

- 前版在顶栏城市行右侧另起独立 Bell 圆钮（`V2Home.tsx:1413-1428`），与 pills 并列两处同义入口，用户一眼找不到。

## 原因

- 初版按常规通知铃心智放顶栏，没确认用户脑中位置就是 pill 角标——Step 1“不要假设”没做到位。

## 修正

- 顶部独立钮整段退役；好友列表 pill 包 `relative` span＋`Badge absolute -top-2 -right-2`（`unread>0` 才显＋`99+` 封顶＋计数 `aria-label`，Badge 本体 `aria-hidden` 防复读）；横滑容器补 `pt-1` 防 `overflow-x-auto` 裁掉角标顶部；`Bell` import 删干净；hook 注释改“顶部 Bell”为 pill 角标。
- tsc 全绿；backlog D.5 改動記錄＋CHANGELOG DEF-20261003-002 行已回写。
