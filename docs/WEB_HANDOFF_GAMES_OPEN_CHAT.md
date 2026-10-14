## web 回复（2026-10-14，(b) 批已实现未提交）

> iOS 输入：`whattodrink_ios/docs/WEB_HANDOFF_GAMES_OPEN_CHAT.md`（想法 #7）。
> (a) 批已合入 `c87de94`（0055 四表一列＋join 202 申请流＋审批＋counters＋openapi 1.54.0）。
> 本轮为 (b) 批：房内聊天＋举报＋kick-block＋friend origin＋admin 队列页，**契约 1.55.0**（以 `docs/api-openapi.yaml` 为准，iOS 不自创契约可开工）。
> 本輪 web 側 `npm run build` 過（含兩條新 admin 路由）、`npm test` 71 文件 678 綠、eslint 零錯（9 個 (b) 相關文件）。

### 端点（全 🔒 需登录）

- `GET /api/v1/games/rooms/:id/messages?since=&limit=`（`listGameMessages`）：仅 **active 在座**可读（left/kicked 403 `not_allowed`）；拉黑／静音**任一方向**有关系即过滤（自己的照回）；撤回行只回 `{id, created_at, removed:true}`；`user` 仅昵称头像；`limit` 1–50 默认 50，`next` 为末条 `created_at`；房 `ended` 24h 后 touch 即清消息。
- `POST /api/v1/games/rooms/:id/messages {kind, body?, quick_key?, client_msg_id}`（`sendGameMessage`）→ 201 `{id, created_at}`：text 1–60 字（trim 后）；禁言 403 `muted_in_room`；限频同人 2s 1 条＋1min 20 条（429 `chat_rate_limited`）；同内容 10s 去重（200 `{duplicate:true}`）；`client_msg_id` 幂等（撞唯一键收敛 200 `{duplicate:true}`）；房已结束 409 `wrong_phase`。
- `POST /api/v1/games/rooms/:id/report {target_user_id, category, detail?, message_id?}`（`reportGamePlayer`）→ 201 `{id}`：资格为双方**都曾 active**（left/kicked 亦算）；不可举报自己；**同房同对一次**（409）；`category`＝harassment／cheating／inappropriate／other／**safety**；`detail` ≤200。
- `POST /api/v1/games/rooms/:id/kick` 加可选 `block: boolean`：`true` 即写 `cheers_blocks`（房主拉黑，之后互不可见／互不可入）＋被踢者站内通知 `game_kicked`（不说原因）。
- `POST /api/v1/friends` 加 `origin: "game"`：须 24h 内同房且双方都曾 active，否则 403（防冒认陌生人；iOS 在游戏结束页调）。
- 后台 `/innerharbour/game-reports`（队列，`ai_flagged` 置顶）＋`/innerharbour/game-reports/:id`（详情＋标记）：快照匿名（甲乙…）；moderator 可标 reviewed／actioned／dismissed＋禁玩 N 天（写 `users.game_banned_until`）；viewer 只读；审计先写＋TOTP step-up。

### `quick_key` 全枚举（24，服务端只认 key，文案 iOS 本地化；快捷语不走任何过滤）

`ready, hurry, again, drink, cheers_all, nice, oops, good_luck, well_played, rematch, brb, waiting, go_go, haha, wow, cheer_up, my_turn, your_turn, toast_host, thanks, sorry, gj, lol, cheers_back`

### 与 iOS 需求的差异（第一版 scope，用户已拍板「只记录不扣分」；下述未做留后续）

1. **词表完整版未做**：无 `chat_wordlist` 表、无 mask 打码、无 NFKC／简繁／AC 归一化、无热更新。实现为两个**默认关**的环境开关：`GAME_CHAT_WORDLIST`（逗号分隔 block 词，命中 422 `message_rejected`「內容不合適」）＋`GAME_CHAT_BLOCK_CONTACTS=true`（URL／电话／微信等正则，命中 422「內容含站外聯繫方式」）。**发送路径零外部调用**（单测静态断言：不 import moderation／openai／minimax／推送／fetch）。
2. **举报每人每日 ≤10 未做**：仅同房同对唯一约束（409）。
3. **`detail` 未过审核管线**（原样存，≤200 字）。
4. **`safety` 无 `safety_alerts` 通道**：enum 已收 `safety`，走同一队列＋同样 AI 复核。
5. **快照无 7 天 TTL**：随举报单保留；消息 24h 懒删不影响已存快照。
6. AI 复核（`after` 异步，不阻塞 201）：只审**被举报人**最近 10 条 text（`moderateCheckin`，OpenAI 主＋MiniMax 兜底）；命中即撤回（`removed_reason=ai_flagged`）＋举报单 `ai_flagged` 置顶；**同房同人只复核一次**；AI 不可用／未命中不撤回照常进队列；**≥2 不同玩家举报→禁言到本房结束**（`game_mutes`）。

### iOS 可开工对照（§9 所列均已入 yaml）

join 202、`requests` 三接口、`join-requests` 两接口（(a) 已有）、`messages` GET／POST、`report`、`kick.block`、`me.counters.game_requests_pending`（badge 不含）、错误码 `chat_rate_limited／message_rejected／muted_in_room／game_banned`、通知 `game_join_request／game_join_result／game_kicked`。

### 预存问题（本轮发现，与 H.2 无关，未修）

- `docs/api-openapi.yaml` 用严格 YAML 解析器（js-yaml）在 E.7 留言行失败：`description: 發表成功（匿名首評帶 Set-Cookie: wtd-anon）` 内含 `": "`。HEAD 即坏（本轮 5 处新增均已 `grep` 确认层级无误），iOS 以 operationId／版本为准不受影响。修它需另开 UR（改契约文件整文件，需全回归），本轮不搭车。
