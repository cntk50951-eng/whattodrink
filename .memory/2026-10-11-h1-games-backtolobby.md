# 2026-10-11 — UR H.1 §十二留守重开（重开撞号前置修）

## 情境

- iOS 真机：2 人 deal_only 局朋友一走即 ended，房主被踢回入口。§十二要回 lobby 留守重开。

## 问题

- `start` 局号写死 `no:1`：回 lobby 重开即撞 `UNIQUE(room_id,no)`，重开 500。
- §十二只点名 applyDeparture 段，不修 start 则修了等于没修。

## 原因

- 首版假设"一房只 start 一次"；回 lobby 语义打破该假设（next_round 早已用 no+1，start 漏了）。

## 修正

- `start` 取最新局 no+1（无局即 1）；applyDeparture 剩 <2 人：deal_only→lobby＋留守 ready=false＋`back_to_lobby`（standard 照旧 ended）。
- 旧局保留但 GET lobby 不下发（§十二允许保留）。
- 判例：凡 insert 有 UNIQUE 的地方，问"重入语义下会撞吗"。
