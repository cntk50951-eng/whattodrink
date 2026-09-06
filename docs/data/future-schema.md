# 整体回顾：前端应用所需全部数据＋未来表草图

UR1.9 第三步：通盘 audit 后的结论。UI 定稿前本文件是草图，只增不改表；
UI 全确定后按此开工 EPIC 3.0 真表设计。

## 一、全应用数据一句话

| 域 | 数据 | 现在存哪 | 以后存哪 |
|---|---|---|---|
| 我在哪 | 定位七态＋实时经纬 | 会话 watch | 实时位：原则上不存；足迹位：`checkins` |
| 喝什么 | 酒目录 15 条＋候选 1 条 | 静态＋会话 | `beers`＋`checkins.beer_id` |
| 想喝 | 快照（酒／时间／经纬／地名） | localStorage | `checkins` 一行 |
| 别人 | 4 条 MOCK（人／酒／区／位／赞数） | 写死 | `checkins` join `users`＋`beers`，赞数实时算 |
| 乾杯 | 我已送出的 id 表 | 会话 | `cheers` 行 |
| 拍照 | 照片／来源／备注／语音／转录／回执 | 会话（他人 WIP） | `checkins` 列（媒体存对象存储，库只存 URL） |
| 心情 | 无（stub） | — | 输入进 `mood_logs`，结果沿用 `checkins` |
| 我是谁 | 无（未登录） | — | `users`（昵称／頭像／性別见下） |
| 壳偏好 | 主题（锁）／语言／设备（现算） | localStorage／静态 | 可选 `users.theme_id`／`locale` |

## 二、未来表草图（snake_case，命名沿 `coding-standards.md`）

- `users(id, nickname, avatar_url, gender, created_at)` —— 头像＋性别
  **UR2.0 已落定**：`MOCK_ME`（`lib/me.ts`）占位，`gender` enum 三值
  （male／female／secret）与本草图同名，直迁无改名
- `beers(id, emoji, name, category, tagline)` —— 现 15 条静态直迁
- `checkins(id, user_id, beer_id, lat, lng, place_name, photo_url, audio_url, audio_seconds, note, transcript, created_at)` —— 想喝／拍照／心情三流归一
- `cheers(id, from_user_id, checkin_id, created_at)` —— 计数不存列，实时 `count`
- `mood_logs(id, user_id, mood_text, created_at)` —— 心情输入流
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
