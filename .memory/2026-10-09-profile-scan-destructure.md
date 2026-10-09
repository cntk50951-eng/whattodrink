# 2026-10-09 — DEF-20261009-002：扫描解构漏 data＋1000 行截断

## 情境

- iOS 报主页 nights/places 恒 0，checkins 等正常；交接精确到行并建议加单测。

## 问题

1. `profile/route.ts` Promise.all 里两路扫描没解构 `{ data }`（`eat()` 判数组失败恒空）。
2. PostgREST 单次 1000 行上限，重度用户会被静默截断（与 iOS"服务端全算"承诺相悖）。

## 原因

- Promise.all 解构时抄了 count 行的形状，array 行漏了 `data:`；
  类型上 `unknown` 不拦，tsc 也看不出（`eat(rows: unknown)` 照单全收）。

## 修正

- 解构补 `data`＋失败 warn；扫描改分页拉全（1000 页循环，有错即停）；
  `eat` 提纯 `collectNightStats`（lib，可单测）＋mock 行用例锁死"传数组才有数"。
- 判例：Promise.all 混合 {count}/{data} 回包时，逐项核对解构形状；聚合统计禁裸全拉（分页或 SQL 聚合）。
