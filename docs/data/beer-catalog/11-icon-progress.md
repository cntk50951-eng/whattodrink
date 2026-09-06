# Icon 绘制进度（UR2.4 插畫管线，skill `beer-icon`）

- 全库：1144 行 → 家族去重排除 25 行（已画 10 品牌＋15 个同 livery 产品变体：
  Tsingtao×5／Kirin×2／Yebisu×2／Young Master×2／Blue Girl Draft／Heineken Silver／
  Moutai Prince／Moutai Yingbin）→ 待画队列 **1119**。
- 家族规则：英文名去括号后整词匹配（asahi／corona／tsingtao／blue girl／
  hoegaarden／heineken／kirin／yebisu／young master／moutai＋maotai）。
  注意獭祭／久保田／麒麟山是独立清酒品牌，不算 Asahi／Kirin 家族。
- 队列顺序＝目录文件顺序（01→10），100 个目标＝队头 100。

## 已完成（20/1119＋25 家族覆盖）

- 首批 10：Asahi／Corona／Tsingtao／Blue Girl／Hoegaarden／Heineken／
  Kirin Ichiban／Yebisu／Young Master／Moutai
- Batch1（10）：Budweiser／Carlsberg／Sapporo／Snow／Yanjing／Harbin／
  Bud Light／Coors Light／Miller Lite／Modelo Especial
- Batch2（10）：Negra Modelo／Pacifico／Tecate／Dos Equis／Sol／Bohemia／
  Victoria／Indio／Skol／Brahma

## 待画

- 本次 100 目标剩余 **80**（队头继续：Antarctica 起）。
- 全队列剩余 **1099**。

## 移动端导出（每批顺带跑）

- `npm run export:icons` → `exported/beer-icons/`：纯 SVG 30＋iOS 三件套＋
  Android 五密度＋manifest.json（RGBA 透明）。iOS 拖进 Assets.xcassets，
  Android 拷 `drawable-*` 进 `res/`。新 icon 只需进 BEER_WALL。
