# 2026-10-10 — UR H.1 第四批：RLS 零表走 service＋脚本批量改单测翻车

## 情境

- H.1 第四批：邀请端点＋游戏计数＋推送。

## 问题

1. counters 用 authed 读 `game_invites`（零 policy）恒空，计数永 0。
2. python 批量改 prefs.test.ts 只命中 4／8 处（B.3 已加行导致形状漂移）。

## 原因

1. RLS 静默少行（DEF-20261010-001 同款）：game_* 全零 policy，authed 读不到。
2. 脚本按"旧形状"匹配，文件已被前一批改过，半数 pattern 对不上；无断言即收工。

## 修正

1. counters 切 service（全部查询已按 userId 限域，安全）＋注释沿判例。
2. 剩余 4 处改用 edit 逐个补；以后批量脚本必须打印命中数并 grep 复验。
- 判例：凡读零 policy 表，先问"调用方是 authed 还是 service"；批量改测试先跑一遍再收工。
