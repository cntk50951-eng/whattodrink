# 2026-10-03 — Bell 门禁用户纠正（任何模式都提醒）＋列表一次性

## 情境

- DEF-20261003-002：远端 `GET /conversations` 200 且 `unread:1`（HK Trash 公开发送），但首页顶部 Bell 不出、列表红点不翻。首页 Network 全程无该请求（用户实证），列表只在点入时拉一次。

## 问题

1. Bell 数据门与渲染门对不齐：渲染认 `isAuthed===true && bellTotal>0`（模式无关），数据认 `useChatBell(presence==="online")`（`mode===null` 加载窗 fail-closed 为 stealth，隐身恒挡）——公开用户也可能在加载窗内永无请求。
2. 列表一次性：mount 拉一次，无 `messages` 订阅、无回焦刷新，坐列表页等消息永不翻红点。

## 原因

- D.5 初版“匿名／隐身门内挡”是拍脑袋沿 `useLiveFriends` 口径抄的，消息提醒与在线状态本质无关（隐身是不让人见，不是自己不见消息）。
- 列表沿 D.4 首版一次性思维，没跟 D.3 Realtime 同一条线。

## 修正

- 用户定案：任何模式都提醒，只挡匿名——`V2Home` 改 `useChatBell(isAuthed===true)`；心跳／live 好友仍走 presence 门不动。hook 注释同步。
- 列表加 `chat-list` 频道（`messages` INSERT，沿 D.3 同一条，不新增 publication）＋`focus` 回焦重拉（`friendsRef` 缓存好友，会话重排；`useCallback` 包 `refreshConvos` 喂 effect deps，lint 净）。
- 教训：门禁抄口径前先问“这个门挡的是隐私还是体验”；渲染门与数据门必须同条件，写完 grep 对一遍。
