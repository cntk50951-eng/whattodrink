# 2026-10-11 — MapPin 加 userId（fallback 查询漏列＋跨文件 fixture）

## 情境

- iOS 要打卡列表头像进主页，MapPin 缺作者 id。

## 问题

1. 未迁移库回退查询（42703 fallback）没选 `user_id`，userId 必有后整批掉行。
2. `v2Pins.test.ts` 手写 PinJson 字面量，类型加必填即三处红。
3. `pins.test.ts` 手造行全缺 `user_id`。

## 原因

- 回退查询是"最小列"思维，与主查询列集分叉。
- 跨文件的手写 fixture 与类型无联动，只能靠 tsc 抓。

## 修正

1. fallback 补 `user_id`（0001 既有列，回退库也有）。
2. 两处测试补列＋主映射断言＋缺席 null 用例。
- 判例：mapper 加必填，先 grep 全部 select 列集（含 fallback）＋全部手写 fixture。
