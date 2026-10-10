# 2026-10-10 — UR H.1 第三批：状态＋动作（一版本一事件铁律）

## 情境

- H.1 第三批：GET 状态＋POST 动作＋settle 懒超时。

## 问题

1. 初版每动作写两个同 version 事件（主事件＋ack 携幂等键）→ 撞
   `UNIQUE(room_id, version)`，第二个 23505 丢，幂等键随之丢。
2. `deriveOnesBroken` 在 actions 路由 import 未用；`countMatching` 在 rooms
   helper import 未用（lint warning）。

## 原因

- 版本即事件序是 0042 的设计本意（一版本一事件）；ack 分离事件违了本意。
- apply 层已内聚推导（challenge 内调 derive），路由层不需再引。

## 修正

- 幂等键直接挂主事件（applyBid／applyChallenge／round_started／
  next_round_confirmed 加可选 `clientActionId` 参；auto 事件 null）。
- 删两处未用 import；lint 回 7 既有。
- 判例：一版本一事件——同 version 第二写必撞，携键需求用列不用行。
