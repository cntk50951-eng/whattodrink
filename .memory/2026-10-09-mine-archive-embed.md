# 2026-10-09 — DEF-20261009-001：/mine 归档 embed 无 FK 静默丢行

## 情境

- iOS-0.68 足迹页看不到旧快贴，iOS 已自证回包无旧行；交接点名 `/mine` 归档段＋附 4 条确认 SQL。

## 问题

- 归档查询共用 `MINE_COLUMNS`（含 `beers(...)` 内嵌），但 `checkins_archive` 零 FK
  （0026 刻意审计不断链）→ PostgREST 无关系即整查失败 → 失败分支＋catch 双静默零日志。
- 另有帮凶：`slice(0, limit)` 主表满额即挤掉旧行。

## 原因

- 内嵌联查依赖外键关系是 PostgREST 铁律，无 FK 的表只能平列＋二次查手拼；
  静默跳过让排查无从下手（交接能定案全靠读代码）。

## 修正

- 归档只选平列＋`beer_id` 集一次查 `beers` 手拼（缺酒留 null，toMineRow 容错）；
  失败 `console.warn` 带 code/message；合并双段全返（bounded 2*limit，不再 slice）。
- 不给归档表加 FK（0026 本意）；DEF 落条＋E.22 回链；用户跑交接 SQL a–d＋验收构造。
