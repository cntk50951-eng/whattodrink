# 2026-09-05 — UR2.2：菜单弹出重设计（skill 二轮）

## 情境
- UR2.2：汉堡下拉被指“不现代不流行”，重做弹出设计。
  UR1.7 同一菜单做过一轮 skill 论证（形式），本轮是第二轮（质感）。

## 问题
- 旧版犯 skill 明禁“ship default state”：普通浮层＋三行纯文本＋100ms
  淡入，动效无性格，行无层次。

## 原因
- 第一版只解决“有没有入口”，没解决“像不像产品”；shadcn 默认态
  直接上等于把模板当设计交付。

## 修正（design read：地图 App header 菜单 redesign-preserve，V7／M6／D3）
- 行：icon tile（44px）＋font-hand 大字＋右箭头去向示意，行高 56px；
  容器 min-w-60，圆角／阴影品牌锁不动。
- 动效：行 stagger cascade 60ms（easeOutExpo 体感曲线），触发钮
  Menu↔X 旋转交叉变形；transform／opacity only，reduced-motion 全降级。
- 工程约束：stagger 延迟走 CSS 变量（动态 delay-[nms] 类扫描器不生成，
  见 09-05 任意类 memory）；不碰 popup 层动画（两套 animation 简写
  cascade 不可预测）；tile 图标显式 size-[19px] 躲 shadcn svg 覆盖；
  无新文案、无 backdrop、z-1100 不动。
- Step 9b：纯视觉零数据，文档无需更新。
