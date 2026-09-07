# 2026-09-07 UR3.2 每日乾杯 15 次上限

## 情境
- 用户：每天 15 次乾杯，服务端以后控；先记数据库设计＋文档，页面 mock。

## 问题
- 无（一次做对）。全程沿旧配方：storage 校验（UR1.8）、ref 同步放
  effect（UR2.5）、hydrate 走 microtask（UR1.8）、JSON 断言＋diff 验
  （UR3.0），零 lint 债。

## 原因
- 不适用（新功能，非修正）。

## 修正（实现备忘）
- `lib/cheers.ts`：LIMIT＝15＋`hkTodayKey`（HK 时区，可注入 today）＋
  `canCheers`／`cheersRemaining`＋`load/saveSentToday`（{day,ids}，
  坏／异日归零，隐私模式吞错从严）；5 单测。
- DrinkMap：mount hydrate＋`sentIdsRef`（effect 同步）供 FX 提交读最新，
  提交时 persist；额度小字常显，满额句＋disabled，守卫双保险。
- 服务端（EPIC 3.0）：按天 count≥15 拒（429），`created_at` 建索引，
  不加计数列；mock 届时整块删换读服务端额度。
- 门：68 tests／tsc 净／lint 0 error。9b：future-schema＋home-map 双边同步。
