# 2026-10-11 — UR H.1 §十三停住等房主（只改一半的后账）

## 情境

- `ffb556f` 只落地 §十二，§十一（§十三重申）没改：亮骰 8s 后轮询即被带进新局。

## 问题

- 自动开局有两处：settle revealed 分支（8s／集齐）＋next_round 集齐即开；iOS 轮询停不下来。

## 原因

- 上轮按"§十二单"收工，§十一顺延但无追踪，iOS 真机才暴露。

## 修正

- settle revealed：deal_only 直接返回；next_round：deal_only 仅房主、调用即开（starter 座位最小）。
- standard 房两处照旧；§十一第 3 条（revealed 改骰数，可选）未做。
- 判例：联调"只改一半"必须当轮记待办（backlog 行），不能靠 iOS 再报一次。
