# 壳层数据（顶栏／菜单／页脚／主题／语言／设备）

## 一、顶栏＋菜单

| 字段 | 页面位置 | 类型 | 当前来源 | 未来表映射 |
|---|---|---|---|---|
| 品牌字 `whattodrink` | header 左 | 静态 | 写死 | 不进库 |
| 登入按钮 → `/auth` | header 右 | 静态链接 | **死链：无此路由**（见缺口①） | 登录落地后进 `users` |
| 菜单三项（今晚喝什麼→`/?pick=1`／拍照→`/camera`／心情→`/mood`） | 汉堡下拉 | 静态链接＋`nav.*` 文案 | 写死 | 不进库 |
| `nav.bars`／`moods`／`about` 文案 | 无处使用 | `messages/*.json` | 静态（无路由） | 路由落地前不动（见缺口②） |

## 二、页脚

`about`／`privacy`／`terms` 链到 `/about`、`/privacy`、`/terms`（**均无路由**，
见缺口①），`contact` 是 mailto，`copyright` 含 `{year}`＋理性飲酒声明。
落地页前全部是静态文案，不进库。

## 三、主题＋语言＋设备（UI 偏好，不进业务库）

- 主题：`Theme{id, name, tokens}`（`lib/themes/`）＋当前选择（localStorage，
  现被 `LOCKED_THEME_ID` 锁单涂鸦风）。用户级偏好未来可进
  `users.theme_id`，POC 不记。
- 语言：`routing.locales`（zh-Hant／zh-Hans／en）＋`messages/*.json` 全量文案。
  文案不是业务数据，不进库；`users.locale` 可选。
- 设备：`detectPlatform`／`detectBrowser`（UA 现算，无存储）＋Android
  setting intent 常量。指引卡逻辑用，用完即弃，不进库。

## 四、已知缺口（非数据问题，记录防忘）

1. `/auth`、`/about`、`/privacy`、`/terms` 四个链接无路由（点即 404）。
2. `nav.bars`／`moods`／`about` 文案无对应页面（UR1.7 已决议：另开 UR）。
3. `hero.tsx` 退役残留（含死链 `#cards`），`BeerMugDoodle` 仍被地图复用。
