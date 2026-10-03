# 2026-10-03 — edit 锚点吞签名行重演（D.5 Bell）

## 情境

- D.5 P1：给 `lib/chat.ts` 追加 `sumUnread` 纯函数，锚点取了 `export function mergeFriendList(` 上方的注释结尾行。

## 问题

- `edit` 把 `mergeFriendList` 签名行整段吞掉，文件一度残留孤立参数行（`friends: ...` 无函数头）。
- 同款已在 2026-09-27 发生过（`server.ts` edit 切断注释头，CHANGELOG 有记），本次重蹈。

## 原因

- `oldString` 以注释块结尾＋函数签名首行开头时，替换后签名行丢失——锚点跨越“注释→代码”边界即高危。

## 修正

- 锚点只取最小代码行（本次应只锚 `export function mergeFriendList(` 一行，不带注释）。
- 写后即读回验证（本次 grep＋read 121–170 行即发现即修）；教训：共用层 edit 后必读回被锚函数全貌。
