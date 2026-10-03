# 2026-10-03 — PG 函数 RETURNS TABLE 遇 enum 必须显式 ::text（DEF-20261003-003）

## 情境

- `GET /conversations` 恒 500，终端 `code=42804 structure of query does not match function result type`。

## 问题

- `messages.kind` 是 `message_kind` ENUM（0012），`get_conversations`（0014）声明 `last_kind text` 却直出 enum 值——uuid/text/timestamptz/int/bigint/boolean 全对版，唯独 enum 这一列炸整查询。

## 原因

- PG 函数结果类型检查要求可赋值转换：varchar→text 有，enum→text 没有（只有显式转换）。逐列对版时 enum 列最易漏——声明 text、源是 enum，肉眼极难发现。

## 修正

- `0016_conversations_kind_text.sql`：输出侧 `lm.kind::text`（CREATE OR REPLACE 可重放）。
- 教训：凡 `RETURNS TABLE` 含 text 列而源表对应列是 enum/domain，写 migration 当场逐列标注源类型；`42804` 首查 enum。
