# 2026-09-05 — UR2.0：mock 身份＋9b 首战

## 情境
- UR2.0 给想喝卡片加头像＋性别，纯 UI（无 DB 阶段）；UR1.9 的 Step 9b
  第一次接受实战检验。

## 问题
- 无登录体系下“我是谁”没有数据源；mock 定男女性别等于替用户定性別，
  定错比不定更糟。

## 原因
- 展示先行不等于数据先行：UI 可以 mock，mock 的语义必须诚实
  （占位即占位的样子）。

## 修正
- `lib/me.ts`：`MOCK_ME` 与 `MOCK_CHECKINS` 同级（mock: true 标记），
  `Gender = male｜female｜secret` 三态 enum，默认 `secret`；
  字段名与 future-schema 的 `users` 桩位同名，直迁无改名。
  `WantRecord` 不加字段（永远是“我”）——旧存档零迁移。
- Step 9b 执行：home-map 加两行（avatar／gender 四列），
  future-schema 桩位改“已落定”。无新单测（静态常量＋纯展示，
  testing.md 口径＋UR1.5／1.7先例，浏览器覆盖）。
