# 2026-10-10 — UR H.1 §九發骰器（范围并行改动教训＋null 类型涟漪）

## 情境

- iOS 联调发现 web 按收窄前完整版交付，面对面场景开不了盅；§九要 `deal_only`＋`reveal`。

## 问题

1. `RoundResult` 加 null（不判输赢）后，starter 两处 `includes(loser_id)` tsc 红。
2. standard 房必须零改动（iOS 已按 1.29.0 集成，只差 reveal）。

## 原因

- 可空污染调用方：凡读 `loser_id` 做动作的都要 typeof 守卫。
- 并行开发范围改动（收窄面对面）没同步到 web，开工时 iOS-0.84 修订已写"我已记教训"。

## 修正

- 两处 starter 加 `typeof === "string" && !== ""` 守卫（null 即座位最小）；
  settle／GET／next_round 逻辑不变（deadline null 即跳过，confirmations 照旧）。
- standard 房：reveal 进房回 409（反向门，防误调）；deal_only 房 bid／challenge 409。
- 判例：结果类型加 null 即全仓 grep 读者（本轮 4 处，两处自动红、两处手查）。
