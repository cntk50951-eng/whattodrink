# 2026-09-05 — UR1.8：快照校验＋断言写错＋老规则再撞一次

## 情境
- UR1.8 落「想喝」快照进 localStorage，面板回看；纯函数单测覆盖。

## 问题
- 三连击：1）单测断言凭想象写 `Sep 5`，实际 `month: numeric` 在 en 下
  输出 `9/5`；2）hydrate effect 同步 setState 撞 `set-state-in-effect` error；
  3）差点把断言改成和实现一样的逻辑（同构断言零价值）。

## 原因
- Intl 输出靠脑补不靠跑：`node -e` 一行就能看实际，写断言前没跑。
- 老规则（toolchain-pits 的 microtask 解）记在 memory 里，但开工 24h
  重读时没内化成“写 effect 先问能不能同步 setState”的条件反射。

## 修正
- 断言先跑后写：`node -e` 看 Intl 实际输出再落断言；断言测的是
  “ contract”（含 HK 时区 14:32），不是和实现同构的复述。
- mount 读存储的 effect 固定配方：state 首屏 null（两端一致）＋
  `void Promise.resolve().then()` 包 setState（和 useGeolocation 同 pattern）。
- localStorage 内容当不可信输入：`parseWantRecord` 逐字段校验，
  坏 JSON／缺字段一律当无记录，不炸不脏读。
