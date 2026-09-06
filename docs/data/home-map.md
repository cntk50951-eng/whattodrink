# 首页地图面板数据（UR1.1–1.8 落地现状）

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

## 三、想喝打卡快照（UR1.8）

| 字段 | 页面位置 | 类型 | 当前来源 | 未来表映射 |
|---|---|---|---|---|
| `beer`（酒快照，含 emoji＋名） | 想喝 pin、回看卡片 | `Beer` | `localStorage("wtd-want-record")` | `checkins.beer_id` |
| `at`（打卡毫秒戳） | 回看卡片时间行 | `number` | 同上 | `checkins.created_at` |
| `position.lat`／`lng`（打卡瞬间定位，冻结） | pin 位置、回看卡片坐标行 | `LatLng` | 同上 | `checkins.lat`／`checkins.lng` |
| `placeName`（逆地理地名，异步回填） | 回看卡片地名行 | `string?` | 同上（无则在线查 Nominatim＋memoize） | `checkins.place_name` |

## 四、他人打卡（MOCK，EPIC 3.0 替换）

| 字段 | 页面位置 | 类型 | 当前来源 | 未来表映射 |
|---|---|---|---|---|
| `id` | pin key、乾杯去重 | `string`（`mock-*-01`） | `mock`（`lib/checkins.ts`，4 条写死） | `checkins.id`（UUID） |
| `nickname` | pin title、乾杯卡 | `string` | 同上 | `users.nickname`（join） |
| `drinkEmoji`／`drinkName` | pin 图标、乾杯卡“飲緊” | `string` | 同上 | `beers` join（emoji＋name） |
| `area`（銅鑼灣／中環…） | 乾杯卡副标题 | `string` | 同上 | `checkins.place_name`（真数据不再手写区名） |
| `position` | pin 位置、双人同框、实时距离 | `LatLng` | 同上 | `checkins.lat`／`lng` |
| `cheers`（被乾杯数） | 乾杯卡计数 | `number` | 同上 | `count(cheers where checkin_id=…)`（不存数，实时算） |
| `sentIds`（我已乾杯 id 表） | “已送出”态 | `string[]` | state，会话 | `cheers(from_user_id, checkin_id, created_at)` |

## 五、UI 纯状态（不进库，列出防误收）

`selectedId`／`sheetOpen`／`fabOpen`／`guideDismissed`（会话 state）、
`wtd-fab-tap`（localStorage 静默期戳）、双人同框距离（render 现算）。
地理常量（`HK_BOUNDS`、zoom、超时）是配置，不是数据。
