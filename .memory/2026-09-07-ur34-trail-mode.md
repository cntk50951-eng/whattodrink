# 2026-09-07 UR3.4 我的足迹模式（用户拍板转盘＋同图）

## 情境
- 用户要求极其重要＋复杂：深度调研＋设计＋拆子任务，三问全答，
  拍板后开工（AskUserQuestion：按此开工／序号钉开卡／独立页）。

## 问题
- 调研最大发现：自己名下零历史（wantRecord 只有最新一条）——
  足迹无米下锅，3.4.1 先补 MOCK。
- backlog 编辑事故：append 後續时吞掉 UR3.3 範圍首行——发现即补回，
  并顺手修 UR3.3 两处 pill 残留行（去 pill 化返工的尾巴）。

## 原因
- 大段 find／replace 前没先读全段锚点，凭截断行定位撞车。
- 文档返工只改代码不改 backlog 旧行，AC 行会撒谎。

## 修正
- 铁律：改 backlog 先读目标段上下 10 行；返工收尾 grep 该 UR 旧关键词
  （本轮：pill／涟漪），有残留即清。
- 本轮实现备忘：`lib/footprints.ts`（beerId 落目录单测锁＋升序）；
  转盘第 7 动作（fan 位自动算）；trail 叠层（`trailLayerRef`＋teardown，
  进场 flyToBounds／reduced 走 fitBounds）；他人置灰走 CSS
  （`wtd-others` 钩子＋trailDim，divIcon className 替换默认即去白底，
  视觉不变）；tooltip 双类名提权盖 leaflet 白签；浮条＋toggle 双退路；
  空态分支备真后端。
- 门：75 tests／tsc 净／lint 0 error。9b：home-map 七节＋六节残留修正。
- 纠正（用户：足迹用了别人坐标）：图省事复用他人坐标，轨迹压钉上＝
  张冠李戴。以后“我”的 mock 数据必须独立选点，且用单测锁死和他人
  数据的最小间距（本轮 300m），不能靠肉眼验收。
- 再纠正（用户：我的足迹只有 1 个点）：连独立选点都是错的——“我的”
  不是“多编几个我的”，是“我真实打卡的”。无数据源即无数据：
  `trailStops` 无记录回 []（空态已有去处），禁编 mock 凑数。
  教训升级：mock 只能占位“未来有的数据”，不能发明“现在没有的数据”。
- bug 修（用户：加推荐酒清旧数据）：单槽模型是根因（存一＋画一＋覆盖写）。
  修法：存储史槽化（迁移＋上限＋过滤）＋pin 层循环化＋提交 ref 读最新；
  附带退役 `wantAt`（pin 层改读史后无读者）。旧钉点开即 `setWantRecord`
  回看，卡片零改——数据源一切换，旧功能变历史浏览。
- bug 修（用户：同位置叠钉）：追加无条件即错，同店必须顶替。口径 10m
  而非坐标全等（GPS 漂移下全等拦不住）；`upsertWantHistory` 纯函数＋
  3 单测，`handleWant` 唯一写入口，存储＋state 同调它。
