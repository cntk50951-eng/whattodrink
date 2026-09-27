# 2026-09-04 UR2.7 结果面板主角化（design-taste-frontend redesign-preserve）

- Design Read：redesign-preserve，VARIANCE 沿用 7，MOTION＋1 到 3，DENSITY 沿用。
  只加一个 hero 时刻，不动 IA／文案／品牌色。
- 三处同构（左图右信息）：结果卡有图 h-28＋key 入场；想喝卡 h-24（avatar 让位
  给酒图，无图回 emoji）；别人卡头像 h-11→h-16（用户拍板不猜酒）。
- 动效唯一：`.pickArtIn` 300ms 缩放淡入（transform／opacity），key 换 id 触发；
  reduced-motion 下 opacity 必须回 1（和声纳归零不同——自查抓到的 bug）。
- svg 尺寸：frame 默认 width 100%，外层 span 固定高＋`[&>svg]:h-full w-auto`
  覆盖 presentation 属性，viewBox 保比例。
- 门：tsc 净／lint 0 error／51 tests。待用户浏览器亲眼确认（三语都要扫一眼）。
