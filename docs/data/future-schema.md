# 整体回顾：前端应用所需全部数据＋未来表草图

UR1.9 第三步：通盘 audit 后的结论。UI 定稿前本文件是草图，只增不改表；
UI 全确定后按此开工 EPIC 3.0 真表设计。

## 一、全应用数据一句话

| 域 | 数据 | 现在存哪 | 以后存哪 |
|---|---|---|---|
| 我在哪 | 定位七态＋实时经纬 | 会话 watch | 实时位：原则上不存；足迹位：`checkins` |
| 喝什么 | 酒目录 15 条＋候选 1 条 | 静态＋会话 | `beers`＋`checkins.beer_id` |
| 想喝 | 快照（酒／时间／经纬／地名） | localStorage | `checkins` 一行 |
| 别人 | 4 条 MOCK（人／酒／区／位／赞数／打卡时刻） | 写死 | `checkins` join `users`＋`beers`，赞数实时算，打卡时刻进 `created_at` |
| 乾杯 | 我已送出的 id 表 | 会话 | `cheers` 行 |
| 拍照 | 照片／来源／备注／语音／转录／回执 | 会话（他人 WIP） | `checkins` 列（媒体存对象存储，库只存 URL） |
| 心情 | 无（stub） | — | 输入进 `mood_logs`，结果沿用 `checkins` |
| 我是谁 | 无（未登录） | — | `users`（昵称／頭像／性別见下） |
| 壳偏好 | 主题（锁）／语言／设备（现算） | localStorage／静态 | 可选 `users.theme_id`／`locale` |

## 二、未来表草图（snake_case，命名沿 `coding-standards.md`）

- `users(id, nickname, avatar_url, gender, created_at)` —— 头像＋性别
  **UR2.0 已落定**：`MOCK_ME`（`lib/me.ts`）占位，`gender` enum 三值
  （male／female／secret）与本草图同名，直迁无改名
  **UR3.3 加 `last_seen_at`**：APP 前台心跳（~30s 写一次），查 5km 内
  `last_seen_at >= now - 5min` 即在线（口径与前端 `isNearbyOnline` 一致，
  mock 用 `Checkin.onlineAt` 相对时间戳占位）；建索引（范围查）
- `drink_invites(id, from_user_id, to_user_id, checkin_id, status, created_at)` ——
  **UR3.3 新增（EPIC 3.0 实现，UI 先行 mock）**：`status` enum
  （sent／accepted／declined／expired），发出写 sent 行，对方点接受／拒绝
  更新同行（不另起行）；过期由定时任务扫（sent 超 24h→expired）。前端
  mock（`invites` state＋`declinesInvite` 剧本＋3s 定时）届时整块删
- `beers(id, emoji, name, category, tagline)` —— 现 15 条静态直迁
- `checkins(id, user_id, beer_id, lat, lng, place_name, photo_url, audio_url, audio_seconds, note, transcript, created_at)` —— 想喝／拍照／心情三流归一
- `cheers(id, from_user_id, to_user_id, checkin_id, created_at)` —— 计数不存列，实时 `count`
  **UR3.0 双边记录口径（EPIC 3.0 实现，UI 先行 mock）**：点一次乾杯只写**一行**，
  但双方记录各＋一条——发送方 sent 列表多一条（`from_user_id = 我`），接收方
  inbox 多一条（`to_user_id = 对方` 的这同一行）。不做镜像双行（一行双读足够，
  计数 `count(cheers where checkin_id=…)` 不变）。`to_user_id` 为 UR3.0 新增列
  （原草图只有 from）。前端 `sentIds`＋乐观＋1 届时改读“`from_user_id = 我` 的行”。
  **UR3.2 每日 15 次上限（EPIC 3.0 在 API 层强制执行）**：写入前查
  `count(cheers where from_user_id＝我 and created_at >= 当天 00:00 HKT) >= 15`
  即拒（429＋剩余额度 0），口径与前端 `canCheers` 一致；`created_at` 建索引
  （按天范围查），不另加计数列（计数实时算，沿本表既有原则）。前端 mock
  （`wtd-cheers-daily`／HK 日期键）届时整块删，换读服务端剩余额度。
- `mood_logs(id, user_id, mood_text, created_at)` —— 心情输入流
- `post_likes(post_id, user_id, created_at)` —— UR4.1 公開牆讚（唯一鍵防重讚，
  計數實時 `count`，不存列；24h 熱門＝`created_at` 範圍查＋索引）。前端
  mock（`wtd-wall-my-posts`＋`wtd-wall-overrides`）屆時整塊刪
- `post_reports(post_id, reporter_id, reason, created_at)` —— UR4.1 檢舉
  （V1 口徑：被檢舉即前端隱藏；多檢舉升級走 EPIC 3.0 審核隊列，不在 V1 設計）
- （暂缓）`bars`、`friendships`、`game_*` —— EPIC 4.0 前不设计

## 三、MOCK→真替换清单（EPIC 3.0 开工即执行）

1. `lib/checkins.ts` 整文件删，`DrinkMap` 改读 Supabase（markers 已走 state，
   只换数据源，UR1.1 预留）。
2. `nickname`／`avatarEmoji`／`gender`／`drinkEmoji`／`drinkName` 改 join（`users`＋`beers`）。
3. `area` 手写区名删，以 `place_name` 为准。
4. `cheers` 数字段删，以 `count(cheers)` 为准。
5. `wtd-want-record`（localStorage）删，以登录用户 `checkins` 最新一行为准。
6. `pickRandomBeer()` 保留作推荐引擎 fallback，目录来源切 `beers` 表。

## 四、EPIC 映射

- EPIC 1.0（UI）：只产出本文档，不建表。
- EPIC 2.0（AI 推荐决策时刻）：读 `beers`＋`mood_logs`＋`checkins` 历史。
- EPIC 3.0（足迹／社交／地图壁垒）：上表＋`users`＋`cheers`，护城河在此。
- EPIC 4.0（本地策展／酒桌游戏，暂缓）：`bars`＋`game_*` 到时再议。
