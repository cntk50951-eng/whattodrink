# 2026-10-10 — DEF-20261010-001：RLS 下读成员表恒缺对方

## 情境

- D.10 用 authed client 读 `conversation_members` 判 peer；iOS 真机：好友全被判陌生人（3 条＋禁图音）。

## 问题

- `members self read` RLS 只返己行 → `peerIds` 恒空 → 空列表判陌生；
  同文件隐身双验同样只查到自己（对方隐身从未生效）。

## 原因

- RLS 过滤是静默的（不报错，只少行）；"查到行"≠"查全行"。
- 用成员表做"对方是谁"的推导，必须走 service（或 RPC）；authed 读只可做"我在不在"的成员校验。

## 修正

- 成员读改 service；peerIds 空即 500（fail-closed，不静默限流）；
  `peerIdsOf` 提纯＋单测（含空集）；列表 peer 走 RPC 本就对，不动。
- 判例：凡推导"对方"，先问"这表 RLS 返全量吗"；不返全量走 service。
