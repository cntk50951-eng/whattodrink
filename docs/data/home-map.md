# 首页地图面板数据（UR1.1–1.8＋UR2.5–2.6 落地现状）

对应组件：`components/map/DrinkMap.tsx`、`MapFab.tsx`、`DrinkMapSection.tsx`。

## 一、我的定位（Geolocation watch）

| 字段 | 页面位置 | 类型 | 当前来源 | 未来表映射 |
|---|---|---|---|---|
| `status`（idle／locating／success／denied／unavailable／timeout／unsupported 七态） | 定位 pill、指引卡、镜头决策 | `GeoStatus`（`hooks/useGeolocation.ts`） | state，会话 | 不进库（运行时态） |
| `position.lat`／`position.lng` | self 蓝点、回位、双人同框、想喝落点 | `LatLng`（`lib/geo.ts`） | state＋`watchPosition` 实时跟 | 按需：`users.last_lat/lng`（实时位置是否存库待定，不默认存） |

## 二、随机推荐（候选酒）

| 字段 | 页面位置 | 类型 | 当前来源 | 未来表映射 |
|---|---|---|---|---|
| `picked.id`／`emoji`／`name`／`category`／`tagline` | 选酒抽屉结果区 | `Beer`（`lib/beers.ts`，15 条静态） | state，会话（`pickRandomBeer()` 现摇） | `beers` 静态表（id／emoji／name／category／tagline）；`checkins.beer_id` 外键引用 |
| 结果卡配图（`pickId`→手绘／无则 emoji） | 同上 emoji 位 | 静态映射（`BEER_WALL.pickId`，UR2.6，现 3 命中） | 静态（`iconForPickId()` 现算） | 不进库（展示映射，有图加一行 `pickId` 即可） |

## 三、想喝打卡快照（UR1.8）

| 字段 | 页面位置 | 类型 | 当前来源 | 未来表映射 |
|---|---|---|---|---|
| `beer`（酒快照，含 emoji＋名） | 想喝 pin、回看卡片 | `Beer` | `localStorage("wtd-want-history")` 数组（UR3.4 单槽改史槽，上限 30，legacy `wtd-want-record` 自动迁移后删） | `checkins.beer_id` |
| `at`（打卡毫秒戳） | 回看卡片时间行 | `number` | 同上 | `checkins.created_at` |
| `position.lat`／`lng`（打卡瞬间定位，冻结） | pin 位置、回看卡片坐标行 | `LatLng` | 同上 | `checkins.lat`／`checkins.lng` |
| `placeName`（逆地理地名，异步回填） | 回看卡片地名行 | `string?` | 同上（无则在线查 Nominatim＋memoize） | `checkins.place_name` |
| `MOCK_ME.avatarEmoji`（我头像占位） | 回看卡片头圈 | `string`（emoji） | `mock`（`lib/me.ts`，UR2.0） | `users.avatar_url` |
| `MOCK_ME.gender`（我性别三态） | 回看卡片性别 pill | `Gender`（male／female／secret，`lib/me.ts`） | 同上，默认 `secret` | `users.gender`（enum 同名三值） |

## 四、他人打卡（MOCK，EPIC 3.0 替换）

| 字段 | 页面位置 | 类型 | 当前来源 | 未来表映射 |
|---|---|---|---|---|
| `id` | pin key、乾杯去重 | `string`（`mock-*-01`） | `mock`（`lib/checkins.ts`，4 条写死） | `checkins.id`（UUID） |
| `nickname` | pin title、乾杯卡 | `string` | 同上 | `users.nickname`（join） |
| `avatarEmoji`（他人头像占位，UR2.0） | 乾杯卡头圈 | `string`（emoji） | 同上 | `users.avatar_url`（join） |
| `gender`（他人性别，UR2.0） | 乾杯卡性别 pill | `Gender`（male／female，`lib/me.ts`） | 同上 | `users.gender`（join） |
| `drinkEmoji`／`drinkName` | pin 图标、乾杯卡“飲緊” | `string` | 同上 | `beers` join（emoji＋name） |
| `area`（銅鑼灣／中環…） | 乾杯卡副标题 | `string` | 同上 | `checkins.place_name`（真数据不再手写区名） |
| `position` | pin 位置、双人同框、实时距离 | `LatLng` | 同上 | `checkins.lat`／`lng` |
| `cheers`（被乾杯数） | 乾杯卡计数 | `number` | 同上 | `count(cheers where checkin_id=…)`（不存数，实时算） |
| `checkedInAt`（打卡毫秒戳，UR2.5） | 摇一摇 24h 窗口过滤（不直接展示） | `number`（种子相对模块加载时） | 同上 | `checkins.created_at` |
| `onlineAt`（上线毫秒戳，UR3.3） | pin 绿点、在线 pill、邀约按钮显隐 | `number`（种子相对模块加载时，全员 5min 窗口内） | 同上 | `users.last_seen_at`（心跳，建索引） |
| `declinesInvite`（mock 剧本，UR3.3） | 决定 mock 接受／婉拒（Mandy 婉拒） | `boolean` | 同上 | 无（真后端由对方点按钮，字段不迁移） |
| `invites`＋`inviteFx`（邀约态，UR3.3） | 按钮四态＋结果条 | `Record<id, sent／accepted／declined>`＋`{id,key}｜null` | state，会话 | `drink_invites` 行（sent／accepted／declined／expired 同行更新） |
| `sentIds`（我已乾杯 id 表，UR3.2 按天） | “已送出”态＋额度 UI | `string[]` | state＋localStorage（`wtd-cheers-daily`＝{day（HK 日期键）, ids}，跨天归零，坏数据归零） | `cheers(from_user_id, to_user_id, checkin_id, created_at)`（UR3.0 加 `to_user_id`，一行双读；UR3.2 加服务端按天 15 次拒绝口径） |
| `cheersFx`（碰杯特效中，UR3.0） | 特效层显隐＋计数乐观＋1 | `{id,key}｜null` | state，会话 | UI 纯状态，不进库（1.3s 后提交 `sentIds` 即拆） |

## 五、UI 纯状态（不进库，列出防误收）

`selectedId`／`sheetOpen`／`fabOpen`／`guideDismissed`（会话 state）、
`wtd-fab-tap`（localStorage 静默期戳）、双人同框距离（render 现算）。
地理常量（`HK_BOUNDS`、zoom、超时）是配置，不是数据。

## 六、搖一搖（UR2.5，会话＋一枚戳，不进库）

| 字段 | 页面位置 | 类型 | 当前来源 | 未来表映射 |
|---|---|---|---|---|
| `wtd-shake-used`（上次有效摇动戳） | 摇摇 pill 5 分钟抖动的静默开关 | 时间戳 `string` | `localStorage`（`markShakeUsed()` 写，按钮和真机共用） | 不进库（UI 节流偏好；用户级可进 `users` 偏好，待定） |
| 涟漪坐标＋toast 文案（`ripple`／`shakeToast`） | 地图声纳／顶部提示 | 会话 state（1.25s／3.5s 自散） | render 现算＋定时器 | 不进库（运行时态；UR3.1 涟漪退役，换 `shakeSearch` 晃杯罩，时序不变） |
| 动作权限态（`permission`） | iOS 首次点摇摇按钮的系统弹窗 | `ShakePermission`（unknown／granted／denied，`hooks/useShake.ts`） | state，会话（拒绝只剩按钮触发） | 不进库（运行时态） |

## 七、我的足迹（UR3.4，MOCK，EPIC 3.0 替换）

| 字段 | 页面位置 | 类型 | 当前来源 | 未来表映射 |
|---|---|---|---|---|
| 我的足迹站（`trailStops(wantHistory)`，UR3.4 返工后） | 聚光圈＋酒名签＋浮条计数（≥2 站连虚线） | `TrailStop[]`（`lib/trail.ts`，想喝史即足迹，无则空态） | render 现算（无记录不编数据） | `checkins where user_id＝我 order by created_at`（字段直迁，无新表） |
| `trailMode`（足迹模式开关） | 他人置灰＋浮条＋返回 | `boolean` | state，会话 | 不进库（运行时态） |
