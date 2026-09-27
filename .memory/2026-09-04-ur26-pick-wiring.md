# 2026-09-04 UR2.6 推荐面板接 icon

- 接法：`BEER_WALL` 加 `pickId?`＋`iconForPickId()`（第一顺位，无则 null），
  结果卡有图渲染 h-16、无图原 emoji；`BEERS` 不增删，pin marker 和想喝行不动
  （divIcon 塞 SVG 另开 UR）。
- 命中只有 3 个（heineken／asahi／tsingtao），其余 12 种走默认——符合"部分使用"。
- 单测 `wall.test.ts`（3 命中＋3 未命中＋pickId 唯一），51/51 全绿。
- 门：tsc 净／lint 0 error／8 文件 51 tests。待用户浏览器亲眼确认。
