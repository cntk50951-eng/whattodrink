# 2026-10-10 — UR H.1 第二批：房间端点（边界吞行＋别名＋包络无带数）

## 情境

- H.1 第二批：8 个房间端点＋ yaml 7 路径＋`GameRoom` schema。

## 问题

1. yaml 大段插入把 `  /api/v1/presence:` 头吞了（oldString 含头、newString 漏）。
2. `lib/games/rooms.ts` 用 `@/lib/api/envelope`，vitest 无该别名，rooms.test 整文件挂。
3. 409 `already_in_room` 按交接应带 room_id，但失败包络无带数通道。

## 原因

1. 多行 edit 只比对目标行，没验首尾边界（party-edit 判例再犯，当轮读回验出）。
2. 本仓 vitest 无 `@/` 别名（badge 旧判例：跨包引内联），新文件重犯。
3. `{error:{code,message}}` 形状冻结，加字段即破三端契约。

## 修正

1. 补回 presence 头＋grep 验 operationId 计数（9 Game）。
2. 改相对路径 `../api/envelope`；tsc 照过（tsc 有别名，vitest 无）。
3. 409 不带数，yaml 注明"拿 409 后调 GET /active 回去"（active 即为此而生）。
- 判例：yaml 大段 edit 后必 grep 边界 path 头；lib 新文件禁 `@/` import（用相对）。
