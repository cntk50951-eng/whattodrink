# 酒類品牌大目錄（UR2.3，EPIC 繪圖＋推薦底料）

目标 3000–5000，本轮第一批打底 1000（用户拍板：全酒类世界覆盖）。
直连未来 `beers` 表（`name`≈品牌原文，`category`≈分类）。

## 约定

- 只收确信存在的品牌；存疑标 `待验证`，不硬写。
- Logo 列记**品牌官网首页**（画师找 logo 的最稳入口，不是 hotlink）。
  官网吃不准的记 `待验证`，不猜 URL。
- 中文名：有通用译名就写，没有就填原文（不造假译名）。
- 状态 `✓`＝品牌＋网址高置信；`待验证`＝需第二批复核。

## 分类索引（`00-taxonomy.md` 为纲，品牌文件按纲归位）

| 文件 | 类别 | 条数 |
|---|---|---|
| `00-taxonomy.md` | 分类总纲（十二大类，品牌随后） | 纲 |
| `01-beer-mega-lager.md` | 工业拉格（全球） | 114 |
| `02-beer-wheat-abbey.md` | 小麦／修道院／欧陆特色啤酒 | 100 |
| `03-beer-craft-ale.md` | 精酿 IPA／世涛／艾尔（英美＋新派） | 93 |
| `04-beer-asia-hk.md` | 亚洲＋香港本地（含精酿） | 95 |
| `05-wine-old-world.md` | 葡萄酒旧世界（法意西德） | 104 |
| `06-wine-new-world.md` | 葡萄酒新世界（美澳智阿南非） | 74 |
| `07-whisky.md` | 威士忌（苏格兰／日本／美国／爱尔兰等） | 162 |
| `08-spirits-clear.md` | 伏特加／金酒／朗姆／龙舌兰 | 156 |
| `09-brandy-liqueur.md` | 干邑／白兰地／利口酒 | 124 |
| `10-asia-spirits.md` | 清酒／烧酒／烧酒（韩国）／白酒／黄酒 | 122 |

合计：**1144**（去重后；脚本复核真重复归零，剩余 14 簇均为不同产品）。

## 抽查验证（AC2，2026-09-05，12 条）

200 OK：Budweiser、Chimay（正典 chimay.com）、Corona（年龄门后存活）、
BrewDog（正典 brewdog.com）、Young Master（正典根域）、Penfolds、
Moutai、Tanqueray、Asahi（正典 asahisuperdry.com）。
403 反爬（品牌无误，浏览器可开，已注行内）：Lafite、Macallan、Absolut。
结论：`✓` 档可信，`待验证` 档留第二批。
