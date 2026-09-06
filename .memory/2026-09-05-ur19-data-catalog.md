# 2026-09-05 — UR1.9：数据目录＋harness 9b

## 情境
- UR1.9 要一套“前端展示／使用数据”的目录（以后设计表结构用），
  外加 harness 硬规则（每次功能后检查同步），最后整体回顾出未来表草图。

## 问题
- 数据散在六处（hook state／localStorage／mock／静态／外部 API／纯 UI 态），
  没有一张纸能回答“这个字段以后进哪张表”；harness 原来只管 CHANGELOG，
  数据同步靠自觉等于没有。
- 附带抓到：`/auth`＋三个 footer 链接无路由（404），`hero.tsx` 死链残留，
  写文档时才暴露——平时谁也不点。

## 原因
- 功能 UR 只验收看得见的东西，数据归属从没进过验收口；
  audit 必须逐文件 grep state／storage／mock，否则一定漏
  （本轮就靠 grep 抓到 camera receipt、fab 静默戳这些边角）。

## 修正
- `docs/data/` 五文档：四列约定（位置／类型／来源／未来表）写死在 README，
  UI 态明确标“不进库防误收”，mock 逐字段标 MOCK＋替换清单放 future-schema。
- harness Step 9b：有数据变化就同步改文档随 commit，无变化 commit 留痕
  “数据文档无需更新”。下一单（UR2.0 头像性别）就是这条规则的第一次实战。
