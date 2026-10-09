# 2026-10-09 — DEF-20261003-003 复发：migration 修补覆盖同函数

## 情境

- 用户报会话列表 500"修复了又失败"。本地 dev 日志：`42804 structure of query does not match function result type` 连刷。

## 问题

- 修法文件分裂：`0016` 有 `lm.kind::text`，`0014` 文件无；
  用户按"重贴 0014（含 DROP）"指示执行 → DROP 删掉修好的函数 → 重建无 cast 版 → 复发。

## 原因

- migration 修补开了新文件覆盖同一个函数，旧文件即定时炸弹；
  任何一次重贴旧文件（DROP 先卸更彻底）都复活 bug。

## 修正

- cast 合入 `0014` 为唯一真相（`0016` 留档，功能被包含，不删历史）；
  用户重贴 0014 整份，`GET /conversations` 200 即 Verified。
- 判例：修函数只改本体 migration 文件；补丁文件只许做本体没有的新东西；
  注释里写明"唯一真相"，防后人另起文件。
