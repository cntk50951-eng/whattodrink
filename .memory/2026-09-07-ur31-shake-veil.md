# 2026-09-07 UR3.1 摇一摇毛玻璃晃杯（涟漪退役）

## 情境
- 用户：雷达涟漪不符合真实体验，要啤酒杯左右晃动＋线条感＋动态，
  可遮地图但必须非侵入透明玻璃、背后可见。

## 问题
- 无（一次做对）。沿用的旧经验：mug 气泡不传空串（传 "…"）、罩子走
  现成 `.above` 层（不开新 portal 就没 z-index 事）、时序数沿用 1250。

## 原因
- 不适用（新功能，非修正）。

## 修正（实现备忘）
- `shakeSearch {key}｜null` 代替 ripple；罩子 bg-card/40＋backdrop-blur-sm
  （标准 utility，扫描器安全），pointer-events 关死；
  大杯 w-40 复用 BeerMugDoodle，transform-origin 杯底 88% 晃 7 下；
  速度线＋两粒泡沫＋`shakeSearching` 三语（JSON 脚本断言＋diff 验，
  UR3.0 截断教训已内化）；`SHAKE_SEARCH_MS = 1250` 常量化；
  reduced-motion 走原直接聚焦分支（复用 reducedMotion state）。
- 涟漪 tsx＋CSS（含 reduced-motion 段条目）删干净，grep 零残留。
- 门：63 tests／tsc 净／lint 0 error。9b：零新增数据，无需更新。
- 返工（用户：杯下横线不像震动）：静态装饰线一次淡入＝没动机；改左右
  交替闪＋峰值对齐摆动转向拍＋向外冲，线自己抖才是震感。位置也从杯下
  移到杯两侧（放射状才像发力方向）。
- 返工 v2（用户：去线＋慢＋溢泡）：线再怎么调也是“画上去的动”，不如
  删掉；液体感靠两层分离——杯转、泡不转顺重力淌。左右股冒头错峰对齐
  摆向极值（左 18%／右 38%），中股只涌不起淌。
