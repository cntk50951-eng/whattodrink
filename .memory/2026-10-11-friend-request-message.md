# 2026-10-11 — 好友请求附留言（只新建写入＋具名结构）

## 情境

- iOS 要发请求时附 50 字留言，接收者可见。

## 问题

- 列表 `items` 是裸 object，无具名结构；iOS 不敢私自加字段。
- 附言写入时机：幂等重发／已好友分支不能覆盖旧留言。

## 原因

- 旧三分支只有"是否新建"在 insert／stale-reset 两处，留言挂 requestFields 即天然只新建写入。

## 修正

- 0045 `message` 列；`parseRequestMessage`（trim＋空 null＋50 字按 code point，超长 400）。
- requestFields 带 message（insert＋stale-reset 复活视为新建）；myPending／flip 不碰。
- 列表 select＋回显（空串归 null）；`FriendRequestItem` 具名；openapi 1.38.0。
- 未做：敏感词过滤（建议项，50 字＋长度门先行，另议）、推送正文带留言（另议）。
- 注意：0045 未跑之前列表 select 会 500（未知列），部署前先贴跑。
- 判例：测试改动只改目标行——本轮误把 `parseRequestOrigin("nope")` 覆盖行顶掉，即时读回发现，已恢复。
