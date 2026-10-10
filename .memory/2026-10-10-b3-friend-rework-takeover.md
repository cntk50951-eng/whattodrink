# 2026-10-10 — UR B.3 联调返工：禁言拆表＋badge 补请求数＋403 可区分

## 情境

- 同事做到一半停工：`DELETE /friends` 已改写 `chat_mutes`（工作区未提交）＋`0041_chat_mutes.sql` 已建（未跟踪），其余 §六事项未动。
- 交接在 iOS 仓（`whattodrink_ios/docs/WEB_HANDOFF_FRIEND_REQUESTS.md` §六），本仓无该文件。

## 问题

1. `computeBadge`／openapi 声称含请求数实际无字段（iOS 被迫 30s 轮询兜底）。
2. 解除写双向 `cheers_blocks`＋POST 任一方向即 404＋unblock 只删己行 → 重加死结；且连坐碰杯。
3. 前好友发消息 404 与"会话不存在"不可分。

## 原因

- commit 说明与实现脱节（badge 无第五数）。
- 自动禁言与手动屏蔽共用一表，语义混淆（mute 该只禁聊天，block 禁全部）。
- 禁言分支复用"不泄存在性"404，iOS 无法给精准提示。

## 修正

- `sumBadge` 第五参（默认 0 向后兼容）＋`BadgeCounts.friend_requests_pending`＋`computeBadge` 计 incoming pending；openapi 1.26.0。
- 拆表收尾：DELETE 写 `chat_mutes`（同事已改，补注释）；POST／accept 拉黑门只认 `cheers_blocks`；accept 成功成对删 mute；messages 双表查→403 `conversation_muted`（envelope 新码）。
- 旧 `cheers_blocks` 自动行不迁移（无法区分手动，误解绑风险更大）；conversations 建会话门不动（复用既有会话无害，发送门兜底）。
- 判例：自动语义与手动语义共表即定时炸弹，拆表优先于打标记。
- 接手驗（2026-10-10 晚）：逐条按 §六重走验出两缺口——POST 互发翻转不清 mute
  （成好友仍永久禁言，已补；已好友分支顺手自愈）＋DELETE 非好友调用误写禁言
  （已改为删行零条直接回）；tsc 零错复验通过。
- 推送：inline token（GITHUB_TOKEN）本仓 `.env` 无且猜错 org 失败；
  `git push origin main` 走本机存根一次成功。判例：先看 `git remote -v`＋本机存根，
  不硬拼 inline URL。
