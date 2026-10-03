# 2026-10-03 — 啤酒杯角标＋定时抖（D.5 round-4）

## 情境

- 用户：气泡与好友列表按钮分离（落在按钮右边）；要气泡变啤酒杯形放右上角；按钮依然定时抖。

## 问题

1. round-3 圆徽 `absolute -top-1 -right-1` 相对 wrapper 定位，视觉上飘在按钮右侧空隙，不像角标。
2. 抖动只播一次，用户坐等时无感。

## 原因

1. 圆徽小（h-5）＋偏移全向外，第一眼是“旁边多了个点”不是“杯子”。
2. 一次性动效验证窗口窄（round-3 已记）；用户明确要定时节奏。

## 修正

- `v2beerMug` 迷你啤酒杯：杯身琥珀渐变＋内嵌泡沫顶（收杯内，不顶出）＋`::after` 小把手＋`v2beerCount` 压杯中＋两粒 `v2mugBubble` 杯内上冒；`top:-6px right:-5px` 落 `pt-2` 盒内，把手 1px 级擦过 gap 缝；圆徽 CSS 整段退役。
- 抖动改 5s 定时：`hasUnread` 为真先抖一次＋每 5s 抖 0.9s，读完（或登出）即停并清 flag；`prevBellRef` 沿边逻辑退役；microtask 包＋卸载双清沿 UR1.8。
- backlog＋CHANGELOG 已回写；tsc＋eslint 双净。
