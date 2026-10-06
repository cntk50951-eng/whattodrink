# 2026-10-06 — pins 补 note 读链（iOS pill 走馬燈，DEF-20261006-002）

## 情境

- iOS 同事转述：好友视角钉上 pill 无走马灯，只剩"快贴"两字；作者本人正常。同事修了一半（写链早有 note），读链 pins 漏了。

## 问题

- `PINS_COLUMNS` 无 `note` 列 → `toPinJson` 无映射 → openapi `MapPin` 无字段。作者走 mine／详情故有字，好友走 pins 故无字——不对称是读链缺字段，非 iOS bug。
- `PinJson` 加必填键炸 `v2Pins.test.ts` 三处字面量（tsc 实锤）。

## 原因

- E.20 只补了 photoThumb 链；note 是另一列，无人顺手带。加必填键不改构造方（消费方全是只读），只炸测试字面量。

## 修正

- select 加列 → `toPinJson.note` 原文透传（空／空白／非串／缺席即 null，截断 iOS 侧 0.38）→ `PinJson` 类型 → openapi 补字段句 → `pins.test` 新用例＋主映射断言 → `v2Pins.test` 三处补 `note`。
- 零 migration（0001 已有）；42703 回退 select 不动（缺列即 null，沿旧链）。
- `vitest` 23 绿＋`tsc` 零错；DEF 落条＋backlog／CHANGELOG 回写。
