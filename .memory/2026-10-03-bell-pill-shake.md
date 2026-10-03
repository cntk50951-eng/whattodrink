# 2026-10-03 — pill 角标裁剪＋新消息抖动（D.5 round-2）

## 情境

- pill 角标版用户亲验：气泡头部被截断只见半圆；另要新消息到时好友列表按钮抖一下。

## 问题

1. `overflow-x-auto` 下 overflow-y 按规范强制算 auto——角标 `-top-2`（8px）顶出内容盒，`pt-1`（4px）只垫一半，仍裁 4px。
2. 原只有 toast 文字提示，按钮本身零动效，用户坐首页注意不到。

## 原因

1. 只按 Badge 尺寸估 padding，没算“裁剪线在 padding 盒边”——角标顶必须落在 padding 盒内（`pt ≥ 顶出量`）。
2. 初版把动效 scope 定小了（以为 toast 够），用户心智要的是入口级提示。

## 修正

- 容器 `pt-1`→`pt-2`、角标退 `-top-1 -right-1`（顶出 4px ≤ 8px padding，落盒内；右 4px 吃进 `gap-2` 缝）。
- `bellTotal` 上跳沿边触发 `pillShake`（`v2-pill-shake` 0.9s rotate±6°＋±1px，播完 950ms 收 flag；含首载 0→N，卸载清 timer；microtask 包沿 UR1.8；reduced-motion 全关，沿站内配方）。
- tsc＋eslint 雙淨；backlog＋CHANGELOG 已回写。
