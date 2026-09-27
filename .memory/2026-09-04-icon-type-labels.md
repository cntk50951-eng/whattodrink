# 2026-09-04 icon 类型标注：frame 统一 caption 条

- 用户要求 web＋移动端都在酒名下 Region 酒类类型。做法：frame 加 `typeLabel?`
  prop，y=153 居中深墨微字（var(--foreground)，导出烘焙 #0a0a0a）；30 文件用
  脚本批量插 prop，BEER_WALL 同步加 `type` 字段（两者必须一致），manifest 也带 type。
- 类型词（短中文）：乾拉格／淡拉格×15／皮爾森×6／小麥白啤／拉格×3／淡艾／
  醬香白酒／美式拉格／深色拉格×2／維也納拉格。Negra Modelo 按慕尼黑深色、
  Victoria 按維也納拉格、Indio 按深色拉格归的；以后批次有拿不准的先查再写。
- 抽看 hoegaarden／victoria @3x：caption 清晰，布局无碰撞（y=153 与 rims 142＋redd+11 色条拉开）。
- 门：tsc／lint 0 error；导出重跑 30 套全更新。未 commit。
