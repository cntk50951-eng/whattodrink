# 2026-09-27 EPIC D 建檔＋D.1 migration（純文檔＋SQL 零碼）

## 情境

- 用戶：先建 D.1–D.6 UR，再從 D.1 開工（表＋RLS）。

## 修正

- `0012_chat_tables.sql`（沿 0010 可重放口徑：DO 塊包枚舉＋IF NOT EXISTS＋DROP IF EXISTS 全套；uuid＋gen_random_uuid 沿 0001；`direct_key` 跨表去重鍵是正統解（唯一索引跨不了表）；90d 懶刪沿 invites；隱身應用層攔沿 live 三刀）。
- backlog 立 EPIC D＋D.1[WIP]／D.2–D.6[]（D.5a 含於 D.3 註明，不單獨驗收）；future-schema 同步三表＋EPIC 映射待 D.2 補端點行。
- 無單測（SQL 口徑，CHANGELOG 留痕）；tsc／lint 照跑零影響（零代碼文件動）。
- 待用戶動作：Dashboard SQL Editor 執行 0012（沿 0011 口徑，agent 到不了）。

## 關聯

- UR D.1 [WIP]（待用戶執行回填轉下一步）；設計定案見 `2026-09-27-chat-arch-decisions.md`
