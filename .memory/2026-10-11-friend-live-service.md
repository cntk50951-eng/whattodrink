# 2026-10-11 — friends/live 读不到好友：authed 读 users 被 RLS 静默丢行

## 情境

- iOS 雷达只见自己。iOS 已补上报＋状态条区分三层；web 侧疑点：authed 读 users 策略只返自己＋public 打卡作者。

## 问题

- `GET /friends/live` 与 `GET /friends` 用 authed 读 `users`：无 public 帖的好友行不可读，静默丢掉（不报错，只少行）。
- 同文件 friendships 读也走 authed（线上曾缺 INSERT/UPDATE 策略，SELECT 也可能漂移）。

## 原因

- RLS 过滤静默（DEF-20261010-001 同款）：0129 已有判例「推导对方走 service」，此处重犯。

## 修正

- 两路由 friendships＋users 读全改 service（userId 已验 token；id 集由互好友限定；`toLiveFriend`／`toFriendListItem` 服务端过滤不变；不放开 RLS）。
- 判例重申：凡用成员／好友关系推导"对方行"，一律 service；authed 只做"我是谁"和"我在不在"。
- 未做：真机双人验证（等 iOS；另提醒对方必须用新版上报，且 5min 窗内）。
